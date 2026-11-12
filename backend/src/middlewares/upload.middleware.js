const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { folderPath, pushToCloud } = require('../services/storage.service');
const directUpload = require('../services/directUpload.service');

const MB = 1024 * 1024;

const FILE_KINDS = {
  image: { mimes: ['image/jpeg', 'image/png', 'image/webp'], folder: 'images' },
  video: { mimes: ['video/mp4', 'video/webm', 'video/quicktime'], folder: 'videos' },
  document: { mimes: ['application/pdf'], folder: 'documents' },
  // invoices / vouchers: scanned PDF or a phone photo
  receipt: { mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], folder: 'receipts' },
};

// fieldKinds: { photo: 'image', video: 'video', thumbnail: 'image' }
// maxCounts: { documents: 5 } (default 1 file per field)
const makeUploader = ({
  fieldKinds, folders = {}, maxSizeMb, maxCounts = {},
}) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = folderPath(folders[file.fieldname] || FILE_KINDS[fieldKinds[file.fieldname]].folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const kind = FILE_KINDS[fieldKinds[file.fieldname]];
    if (!kind) return cb(ApiError.badRequest(`Unexpected file field: ${file.fieldname}`));
    if (!kind.mimes.includes(file.mimetype)) {
      return cb(ApiError.badRequest(`${file.fieldname} must be one of: ${kind.mimes.join(', ')}`));
    }
    cb(null, true);
  };

  // Files the browser already sent straight to Cloudinary arrive as references in the
  // `directUploads` field (see directUpload.service). They become normal req.files entries
  // carrying a `url`, so controllers handle them exactly like multer uploads.
  const adoptDirectUploads = (req, res, next) => {
    const raw = req.body?.directUploads;
    if (!raw) return next();
    delete req.body.directUploads;
    try {
      req.files ||= {};
      JSON.parse(raw).forEach((ref) => {
        const kind = FILE_KINDS[fieldKinds[ref.field]];
        if (!kind) throw ApiError.badRequest(`Unexpected file field: ${ref.field}`);
        const mimetype = directUpload.verify(req.user, ref);
        if (!kind.mimes.includes(mimetype)) {
          throw ApiError.badRequest(`${ref.field} must be one of: ${kind.mimes.join(', ')}`);
        }
        const files = (req.files[ref.field] ||= []);
        if (files.length >= (maxCounts[ref.field] || 1)) throw ApiError.badRequest(`Too many files for ${ref.field}`);
        files.push({
          fieldname: ref.field,
          originalname: String(ref.name || 'file').slice(0, 200),
          mimetype,
          size: Number(ref.size) || 0,
          url: ref.url,
        });
      });
      next();
    } catch (err) {
      next(err instanceof ApiError ? err : ApiError.badRequest('Invalid upload reference'));
    }
  };

  const upload = multer({ storage, fileFilter, limits: { fileSize: maxSizeMb * MB } });
  // Express accepts an array of middlewares wherever one is expected
  return [
    upload.fields(Object.keys(fieldKinds).map((name) => ({ name, maxCount: maxCounts[name] || 1 }))),
    adoptDirectUploads,
    pushToCloud,
  ];
};

const mentorPhotoUpload = makeUploader({ fieldKinds: { photo: 'image' }, folders: { photo: 'mentors' }, maxSizeMb: 5 });

const videoUpload = makeUploader({
  fieldKinds: { video: 'video', thumbnail: 'image' },
  folders: { video: 'videos', thumbnail: 'thumbnails' },
  maxSizeMb: 500,
});

const startupLogoUpload = makeUploader({ fieldKinds: { logo: 'image' }, folders: { logo: 'logos' }, maxSizeMb: 2 });

const founderPhotoUpload = makeUploader({ fieldKinds: { photo: 'image' }, folders: { photo: 'founders' }, maxSizeMb: 5 });

const incubatorLogoUpload = makeUploader({ fieldKinds: { logo: 'image' }, folders: { logo: 'logos' }, maxSizeMb: 2 });

const policyDocumentUpload = makeUploader({ fieldKinds: { document: 'document' }, folders: { document: 'policies' }, maxSizeMb: 10 });

const agreementFormatUpload = makeUploader({
  fieldKinds: { agreementFormat: 'document' }, folders: { agreementFormat: 'agreements' }, maxSizeMb: 10,
});

const signedAgreementUpload = makeUploader({
  fieldKinds: { signedAgreement: 'document' }, folders: { signedAgreement: 'agreements' }, maxSizeMb: 10,
});

const grantDocumentsUpload = makeUploader({
  fieldKinds: { documents: 'document' }, folders: { documents: 'grant-applications' }, maxSizeMb: 10, maxCounts: { documents: 5 },
});

const fundingDocumentsUpload = makeUploader({
  fieldKinds: { documents: 'document' }, folders: { documents: 'funding' }, maxSizeMb: 10, maxCounts: { documents: 5 },
});

const financialAttachmentsUpload = makeUploader({
  fieldKinds: { attachments: 'receipt' }, folders: { attachments: 'financials' }, maxSizeMb: 10, maxCounts: { attachments: 5 },
});

const complianceFileUpload = makeUploader({ fieldKinds: { file: 'document' }, folders: { file: 'compliance' }, maxSizeMb: 20 });

const eventBannerUpload = makeUploader({ fieldKinds: { banner: 'image' }, folders: { banner: 'events' }, maxSizeMb: 5 });

module.exports = {
  makeUploader,
  grantDocumentsUpload,
  fundingDocumentsUpload,
  eventBannerUpload,
  financialAttachmentsUpload,
  complianceFileUpload,
  agreementFormatUpload,
  signedAgreementUpload,
  mentorPhotoUpload,
  videoUpload,
  startupLogoUpload,
  founderPhotoUpload,
  incubatorLogoUpload,
  policyDocumentUpload,
};
