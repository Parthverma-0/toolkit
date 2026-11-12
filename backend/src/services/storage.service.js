const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const cloudinary = require('./cloudinary.service');
const ApiError = require('../utils/ApiError');

// Files are always written to /uploads first by multer. With STORAGE_DRIVER=cloudinary,
// pushToCloud() then uploads them and removes the local copy; otherwise they stay on disk
// and are served statically at /uploads/*. Controllers only use toPublicUrl / removeFile.
//
// On Vercel the only writable folder is the temp dir and it is wiped between invocations,
// so files can only pass through it on their way to Cloudinary.
const ephemeralDisk = Boolean(process.env.VERCEL);
const UPLOAD_ROOT = ephemeralDisk ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '../../uploads');
const PUBLIC_PREFIX = '/uploads/';

const useCloud = () => process.env.STORAGE_DRIVER === 'cloudinary';

const folderPath = (folder) => path.join(UPLOAD_ROOT, folder);

// multer file -> URL stored in the DB (file.url is set when it was pushed to the cloud)
const toPublicUrl = (file) => file.url || `${PUBLIC_PREFIX}${path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/')}`;

const removeLocal = async (filePath) => {
  await fs.unlink(filePath).catch((err) => {
    if (err.code !== 'ENOENT') console.error(`Failed to delete ${filePath}: ${err.message}`);
  });
};

// Deletes a file we stored (local or Cloudinary); ignores external URLs (YouTube etc.)
const removeFile = async (url) => {
  if (!url) return;
  if (cloudinary.isCloudinaryUrl(url)) {
    await cloudinary.destroy(url).catch((err) => console.error(`Failed to delete ${url}: ${err.message}`));
    return;
  }
  if (!url.startsWith(PUBLIC_PREFIX)) return;
  const filePath = path.join(UPLOAD_ROOT, url.slice(PUBLIC_PREFIX.length));
  if (!filePath.startsWith(UPLOAD_ROOT)) return;
  await removeLocal(filePath);
};

const requestFiles = (req) => [
  ...(req.file ? [req.file] : []),
  ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
];

// Cleans up whatever was saved for a request that ended in an error
const removeRequestFiles = async (req) => {
  await Promise.all(requestFiles(req).map((f) => removeFile(toPublicUrl(f))));
};

// Uploads a file that is already on disk (multer upload or a generated PDF) when the
// cloud driver is on; returns the URL to store either way.
const storeLocalFile = async (filePath, { folder, mimetype }) => {
  if (!useCloud()) {
    if (!ephemeralDisk) return toPublicUrl({ path: filePath });
    await removeLocal(filePath);
    throw new ApiError(503, 'File storage is not set up yet (STORAGE_DRIVER=cloudinary and the CLOUDINARY_* variables are required)');
  }
  const { url } = await cloudinary.uploadFile(filePath, { folder, mimetype });
  await removeLocal(filePath);
  return url;
};

// Middleware placed right after multer (see upload.middleware)
const pushToCloud = async (req, res, next) => {
  if (!useCloud() && !ephemeralDisk) return next();
  try {
    await Promise.all(requestFiles(req).map(async (file) => {
      if (file.url) return; // the browser already uploaded it (see directUpload.service)
      const folder = path.basename(path.dirname(file.path));
      file.url = await storeLocalFile(file.path, { folder, mimetype: file.mimetype });
    }));
    next();
  } catch (err) {
    next(err); // errorHandler -> removeRequestFiles cleans up local copies and finished uploads
  }
};

module.exports = {
  useCloud,
  UPLOAD_ROOT, folderPath, toPublicUrl, removeFile, removeRequestFiles, storeLocalFile, pushToCloud,
};
