const crypto = require('crypto');
const path = require('path');
const config = require('../config');
const cloudinary = require('./cloudinary.service');
const ApiError = require('../utils/ApiError');

// Direct uploads: serverless hosts cap request bodies (Vercel: 4.5 MB), so with the
// Cloudinary driver the browser sends files straight to Cloudinary and then submits the
// form with a reference to each file instead of the file itself.
//
//   1. POST /api/uploads/sign { mimetype }   -> issue()  signed upload params + proof
//   2. browser uploads the file to Cloudinary
//   3. form is submitted with `directUploads` = [{ field, url, proof, name, size }]
//   4. upload.middleware -> verify() turns each reference into a req.files entry
//
// The proof ties the asset to the user it was issued to, so nobody can attach (and later
// delete) a file that somebody else uploaded.

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};
const ALLOWED_MIMES = [...new Set(Object.values(MIME_BY_EXT))];

const proofFor = (userId, publicId) => crypto
  .createHmac('sha256', config.jwt.accessSecret)
  .update(`direct-upload:${userId}:${publicId}`)
  .digest('hex');

const issue = (user, mimetype) => {
  if (!ALLOWED_MIMES.includes(mimetype)) throw ApiError.badRequest('This file type is not supported');
  const { uploadUrl, fields, publicId } = cloudinary.directUploadParams(mimetype);
  return { uploadUrl, fields, proof: proofFor(user._id, publicId) };
};

// Returns the file's mimetype when the reference is genuine, throws otherwise
const verify = (user, { url, proof }) => {
  const parsed = cloudinary.parseUrl(url);
  const expected = parsed && proofFor(user._id, parsed.publicId);
  const given = Buffer.from(String(proof || ''));
  if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
    throw ApiError.badRequest('Invalid upload reference');
  }
  const mimetype = MIME_BY_EXT[path.extname(new URL(url).pathname).toLowerCase()];
  if (!mimetype) throw ApiError.badRequest('This file type is not supported');
  return mimetype;
};

module.exports = { issue, verify };
