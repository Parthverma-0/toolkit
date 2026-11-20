const path = require('path');
const cloudinary = require('./cloudinary.service');
const { UPLOAD_ROOT } = require('./storage.service');
const ApiError = require('../utils/ApiError');

// Streams a private document (investor verification files) to an already-authorised caller.
// Local disk files are sent directly; Cloudinary files redirect to the stored URL, so the
// address is only ever revealed by this authenticated route.
const sendPrivateFile = (res, doc) => {
  res.set('Cache-Control', 'private, no-store');
  if (cloudinary.isCloudinaryUrl(doc.url)) return res.redirect(doc.url);

  const prefix = '/uploads/';
  if (!doc.url?.startsWith(prefix)) throw ApiError.notFound('File not found');
  const filePath = path.join(UPLOAD_ROOT, doc.url.slice(prefix.length));
  if (!filePath.startsWith(UPLOAD_ROOT)) throw ApiError.notFound('File not found');
  return res.sendFile(filePath, {
    headers: { 'Content-Type': doc.mimetype || 'application/octet-stream', 'Content-Disposition': 'inline' },
  }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
  });
};

module.exports = { sendPrivateFile };
