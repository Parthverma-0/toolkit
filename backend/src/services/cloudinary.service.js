const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Minimal Cloudinary client over its REST API (no SDK dependency).
// Docs: https://cloudinary.com/documentation/image_upload_api_reference
const cfg = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CLOUDINARY_FOLDER || 'toolkit',
});

// Signature = sha1 of the sorted params (excluding file, api_key, resource_type) + api secret
const sign = (params, apiSecret) => {
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
};

// image -> image, video -> video, everything else (PDFs) -> raw so the file is served as-is
const resourceTypeFor = (mimetype = '') => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
};

const call = async (resourceType, action, form) => {
  const { cloudName } = cfg();
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/${action}`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Cloudinary ${action} failed (${res.status}): ${body.error?.message || 'unknown error'}`);
  return body;
};

// Uploads a local file; returns { url, publicId, resourceType }
const uploadFile = async (filePath, { folder, mimetype }) => {
  const { apiKey, apiSecret, folder: root } = cfg();
  const resourceType = resourceTypeFor(mimetype);
  const params = { folder: `${root}/${folder}`, timestamp: Math.floor(Date.now() / 1000) };
  // raw files keep their extension in the public id so downloads open correctly
  if (resourceType === 'raw') params.public_id = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(filePath).toLowerCase()}`;

  const form = new FormData();
  form.append('file', await fs.openAsBlob(filePath), path.basename(filePath));
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  form.append('api_key', apiKey);
  form.append('signature', sign(params, apiSecret));

  const body = await call(resourceType, 'upload', form);
  return { url: body.secure_url, publicId: body.public_id, resourceType };
};

// https://res.cloudinary.com/<cloud>/<type>/upload/[transformations/]v123/<public_id>[.ext]
const parseUrl = (url) => {
  const { cloudName } = cfg();
  const m = new RegExp(`^https?://res\\.cloudinary\\.com/${cloudName}/(image|video|raw)/upload/(?:.*?/)?v\\d+/(.+)$`).exec(url || '');
  if (!m) return null;
  const [, resourceType, rest] = m;
  const publicId = resourceType === 'raw' ? rest : rest.replace(/\.[^/.]+$/, '');
  return { resourceType, publicId: decodeURIComponent(publicId) };
};

const isCloudinaryUrl = (url) => Boolean(parseUrl(url));

const destroy = async (url) => {
  const parsed = parseUrl(url);
  if (!parsed) return;
  const { apiKey, apiSecret } = cfg();
  const params = { public_id: parsed.publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  form.append('api_key', apiKey);
  form.append('signature', sign(params, apiSecret));
  await call(parsed.resourceType, 'destroy', form);
};

module.exports = {
  uploadFile, destroy, isCloudinaryUrl, parseUrl, sign, resourceTypeFor,
};
