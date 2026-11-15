// Generates a tool report: profile context (retrieved from MongoDB) + the founder's inputs
// -> Gemini -> sanitized report JSON that the frontend renders as a formal PDF.
const { Founder, StartupMetric, Achievement, ToolSubmission } = require('../models');
const gemini = require('./gemini.service');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { SCHEMA_TEXT, sanitizeReport, parseJson } = require('./reportSchema');

const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const SECTOR_LABELS = { ai_ml: 'AI / ML', iot_hardware: 'IoT / Hardware', retail_ecommerce: 'Retail / E-commerce', saas: 'SaaS', edtech: 'EdTech', fintech: 'FinTech', healthtech: 'HealthTech', agritech: 'AgriTech', foodtech: 'FoodTech', deeptech: 'DeepTech', cleantech: 'CleanTech' };
const sectorLabel = (s) => SECTOR_LABELS[s] || humanize(s);
const stageLabel = (s) => ({ mvp: 'MVP' }[s] || humanize(s));
const inr = (n) => `INR ${Number(n || 0).toLocaleString('en-IN')}`;
const monthName = (m) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];

// "Retrieval" step: everything ToolKit knows about the startup, as plain labelled text.
// The data is small and structured, so it is queried directly instead of through embeddings.
async function buildProfileContext(startup) {
  const [founders, metrics, achievements, pastReports] = await Promise.all([
    Founder.find({ startup: startup._id }).select('fullName designation isPrimary education experience equityPercent').lean(),
    StartupMetric.find({ startup: startup._id }).sort({ 'period.year': -1, 'period.month': -1 }).limit(12).lean(),
    Achievement.find({ startup: startup._id }).sort({ date: -1 }).limit(10).lean(),
    ToolSubmission.find({ startup: startup._id, status: 'completed' }).sort({ createdAt: -1 }).limit(4).select('toolType createdAt output.subtitle').lean(),
  ]);

  const lines = [];
  const add = (label, value) => { if (value !== undefined && value !== null && String(value).trim()) lines.push(`${label}: ${value}`); };

  lines.push('## Startup');
  add('Name', startup.name);
  add('Tagline', startup.tagline);
  add('Sector', sectorLabel(startup.sector));
  add('Stage', stageLabel(startup.stage));
  add('Founded', startup.foundedOn && new Date(startup.foundedOn).getFullYear());
  add('Team size', startup.teamSize);
  add('Location', [startup.address?.city, startup.address?.state, startup.address?.country].filter(Boolean).join(', '));
  add('Website', startup.website);
  add('Registered company (CIN on file)', startup.cin ? 'Yes' : undefined);
  add('DIPP recognised', startup.dippNumber ? 'Yes' : undefined);
  add('Problem', startup.problemStatement);
  add('Solution', startup.solution);

  if (founders.length) {
    lines.push('', '## Founders');
    founders.forEach((f) => {
      const edu = (f.education || []).map((e) => [e.degree, e.institution].filter(Boolean).join(', ')).filter(Boolean).join('; ');
      const exp = (f.experience || []).map((e) => [e.role, e.company].filter(Boolean).join(' at ')).filter(Boolean).join('; ');
      lines.push(`- ${f.fullName}${f.designation ? `, ${f.designation}` : ''}${f.equityPercent ? ` (${f.equityPercent}% equity)` : ''}${edu ? `. Education: ${edu}` : ''}${exp ? `. Experience: ${exp}` : ''}`);
    });
  }

  if (metrics.length) {
    lines.push('', '## Monthly metrics logged on ToolKit (most recent first)');
    metrics.forEach((m) => {
      const custom = m.custom ? Object.entries(m.custom).map(([k, v]) => `${k} ${v}`).join(', ') : '';
      lines.push(`- ${monthName(m.period.month)} ${m.period.year}: revenue ${inr(m.revenue)}, expenses ${inr(m.expenses)}, customers ${m.customers}, employees ${m.employees}${custom ? `, ${custom}` : ''}`);
    });
  }

  if (achievements.length) {
    lines.push('', '## Achievements');
    achievements.forEach((a) => lines.push(`- ${new Date(a.date).toISOString().slice(0, 10)} ${humanize(a.type)}: ${a.title}${a.description ? `. ${a.description}` : ''}`));
  }

  if (pastReports.length) {
    lines.push('', '## Earlier ToolKit reports for this startup (for consistency)');
    pastReports.forEach((r) => lines.push(`- ${humanize(r.toolType)} (${new Date(r.createdAt).toISOString().slice(0, 10)}): ${r.output?.subtitle || ''}`));
  }

  return lines.join('\n');
}

const inputsText = (tool, input) => tool.fields
  .filter((f) => f.type !== 'file' && String(input[f.name] ?? '').trim())
  .map((f) => `### ${f.label}\n${String(input[f.name]).trim()}`)
  .join('\n\n') || '(no additional inputs)';

const systemPrompt = (tool, search) => `You are a senior startup analyst at ToolKit, a platform for startups and incubators in India. You write formal, complete business documents for founders.

Task: write a ${tool.name} report.
${tool.brief}

Writing rules:
- Formal British English, clear and plain. Full paragraphs, not fragments. No marketing hype, no emojis, no markdown.
- Use the startup profile and the founder's inputs as the primary facts. Never contradict them.
- When you need a figure you were not given, make a reasonable estimate, say it is an estimate, and list it under assumptions.
- Never invent facts about named real companies (funding, revenue, customers, prices). Write "not public" when unknown.
- Money in INR using lakh and crore (e.g. "INR 12 lakh", "INR 1.5 crore"). Never use the rupee symbol.
- Use plain characters only: no arrows, ticks or special symbols.
- Diagrams only where they carry numbers (budgets, forecasts, scores, market sizes). Use tables for comparisons.
- Be specific to this startup; avoid statements that would fit any company.
${search ? '- Use Google Search for current market and competitor facts. Mention the source name in the sentence where you use it.' : '- You have no web access. Base market and competitor statements on general knowledge and label figures as estimates.'}

Required sections, in this order (block types in brackets):
${tool.outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${tool.outline.length + 1}. Assumptions (bullets listing every estimate and assumption used)

${SCHEMA_TEXT}`;

// Runs the AI and returns a report object ready to store and render
async function generateReport({ tool, startup, input, file }) {
  const search = Boolean(tool.webSearch && config.gemini.webSearch);
  const context = await buildProfileContext(startup);
  const parts = [
    { text: `# Startup profile (from ToolKit)\n${context}` },
    { text: `# Founder's inputs for this report\n${inputsText(tool, input)}` },
  ];
  if (file) {
    parts.push({ text: `# Attached file: ${file.originalname}` });
    parts.push({ inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } });
  }
  parts.push({ text: `Write the ${tool.name} report now as the JSON object described.` });

  const result = await gemini.generate({ system: systemPrompt(tool, search), parts, json: true, search });
  const parsed = parseJson(result.text);
  const report = parsed && sanitizeReport(parsed, tool.name);
  if (!report || report.sections.length < 2) {
    console.error('[toolReport] unusable output', result.finishReason, String(result.text).slice(0, 300));
    throw new ApiError(502, 'The report came back incomplete. Please try again.').withCode('AI_FAILED');
  }

  return {
    ...report,
    tool: tool.name,
    startup: { name: startup.name, sector: sectorLabel(startup.sector), stage: stageLabel(startup.stage) },
    sources: result.sources,
    model: result.model,
  };
}

module.exports = { generateReport, buildProfileContext };
