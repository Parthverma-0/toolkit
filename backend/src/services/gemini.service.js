// Thin client for the Gemini REST API (generateContent). Uses Node's built-in fetch, no SDK.
// Docs: https://ai.google.dev/api/generate-content
const config = require('../config');
const ApiError = require('../utils/ApiError');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const isConfigured = () => Boolean(config.gemini.apiKey);

const notConfigured = () => new ApiError(503, 'Report generation is not set up yet. Please try again later.')
  .withCode('AI_NOT_CONFIGURED');

const headers = () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey });

// Turn an API failure into a message the founder can act on (details stay in the server log)
const apiError = (status, body) => {
  const reason = body?.error?.status || '';
  console.error('[gemini]', status, reason, body?.error?.message);
  if (status === 429 || reason === 'RESOURCE_EXHAUSTED') {
    return ApiError.tooMany('The report service is busy right now. Please try again in a few minutes.').withCode('AI_RATE_LIMITED');
  }
  const message = body?.error?.message || '';
  // Key is valid but its Google project has no free tier and no billing
  if (/billing|free tier/i.test(message)) {
    return new ApiError(503, 'Report generation is unavailable: the AI provider account needs billing enabled (free tier not available for this API key).')
      .withCode('AI_BILLING_REQUIRED');
  }
  if (status === 400 && /api key/i.test(message)) {
    return new ApiError(503, 'Report generation is unavailable: the AI API key is invalid.').withCode('AI_KEY_INVALID');
  }
  if (status === 401 || status === 403) {
    return new ApiError(503, 'Report generation is unavailable: the AI API key was rejected.').withCode('AI_KEY_REJECTED');
  }
  return new ApiError(502, 'The report could not be generated. Please try again.').withCode('AI_FAILED');
};

// "models/gemini-2.5-flash" -> [2, 5]
const versionOf = (name) => (name.match(/gemini-(\d+(?:\.\d+)*)/)?.[1] || '0').split('.').map(Number);
const newerFirst = (a, b) => {
  const va = versionOf(a); const vb = versionOf(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i += 1) {
    const d = (vb[i] || 0) - (va[i] || 0);
    if (d) return d;
  }
  return 0;
};

// When GEMINI_MODEL is not set, ask the API which models this key can use and take the newest
// stable flash model (fast, cheap, available on the free tier). Cached for the process lifetime.
let modelPromise;
const resolveModel = () => {
  if (config.gemini.model) return Promise.resolve(config.gemini.model.replace(/^models\//, ''));
  if (!modelPromise) {
    modelPromise = (async () => {
      const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: headers() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw apiError(res.status, body);
      const names = (body.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name);
      // e.g. models/gemini-2.5-flash, but not -lite, -preview, -image, dated snapshots, ...
      const stableFlash = names.filter((n) => /^models\/gemini-[\d.]+-flash$/.test(n));
      const anyFlash = names.filter((n) => /flash/.test(n) && !/(image|tts|audio|live|embedding)/i.test(n));
      const pick = [...stableFlash].sort(newerFirst)[0] || [...anyFlash].sort(newerFirst)[0] || names[0];
      if (!pick) throw new ApiError(502, 'No usable AI model was found for this API key.').withCode('AI_FAILED');
      console.log('[gemini] using model', pick);
      return pick.replace(/^models\//, '');
    })().catch((err) => { modelPromise = undefined; throw err; });
  }
  return modelPromise;
};

/**
 * One generateContent call.
 * @param {object} p
 * @param {string} p.system      system instruction
 * @param {Array}  p.parts       user parts: { text } or { inlineData: { mimeType, data(base64) } }
 * @param {boolean} [p.json]     ask for a JSON response (not combinable with search)
 * @param {boolean} [p.search]   enable Google Search grounding
 * @returns {Promise<{ text: string, sources: {title,url}[], model: string, usage: object }>}
 */
async function generate({ system, parts, json = false, search = false, temperature = 0.5, maxOutputTokens = 32768 }) {
  if (!isConfigured()) throw notConfigured();
  const model = await resolveModel();

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature, maxOutputTokens, ...(json && !search ? { responseMimeType: 'application/json' } : {}) },
    ...(search ? { tools: [{ google_search: {} }] } : {}),
  };

  let res;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(config.gemini.timeoutMs),
    });
  } catch (err) {
    console.error('[gemini] request failed', err.name, err.message);
    throw new ApiError(504, 'The report took too long to generate. Please try again.').withCode('AI_TIMEOUT');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, data);

  const candidate = data.candidates?.[0];
  if (!candidate) {
    console.error('[gemini] no candidate', data.promptFeedback);
    throw new ApiError(422, 'The report could not be generated from these inputs. Please rephrase and try again.').withCode('AI_BLOCKED');
  }
  const text = (candidate.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!text) throw new ApiError(502, 'The report could not be generated. Please try again.').withCode('AI_FAILED');

  const seen = new Set();
  const sources = (candidate.groundingMetadata?.groundingChunks || [])
    .map((c) => c.web).filter((w) => w?.uri && !seen.has(w.uri) && seen.add(w.uri))
    .map((w) => ({ title: w.title || w.uri, url: w.uri }));

  return { text, sources, model, finishReason: candidate.finishReason, usage: data.usageMetadata };
}

module.exports = { generate, isConfigured, notConfigured };
