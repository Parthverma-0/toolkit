const { ComplianceDocument, Grant, Program } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const f = require('../utils/format');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { generate, usableGrantFilter } = require('../services/compliance.service');

// Incubator legalities: uploaded or generated compliance documents
// (financial records, internal financials, utilization certificates, expenditure reports).
// All routes run after requireIncubator.
const FIELDS = ['docType', 'title', 'financialYear', 'period', 'grant', 'program', 'amountSanctioned', 'amountUtilized', 'status', 'submittedTo'];

const uploadedFile = (req) => req.files?.file?.[0];

const assertLinks = async (req, { grant, program }) => {
  const incubator = req.incubator._id;
  const checks = [
    grant && Grant.exists({ _id: grant, ...usableGrantFilter(incubator) }).then((ok) => ok || 'grant not found'),
    program && Program.exists({ _id: program, incubator }).then((ok) => ok || 'program not found in your incubator'),
  ].filter(Boolean);
  const failed = (await Promise.all(checks)).filter((r) => typeof r === 'string');
  if (failed.length) throw ApiError.badRequest(failed.join('; '));
};

// Marking a document submitted stamps the time once
const stampSubmission = (doc) => {
  if (doc.status === 'submitted' && !doc.submittedAt) doc.submittedAt = new Date();
};

const findDoc = async (req) => {
  const doc = await ComplianceDocument.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!doc) throw ApiError.notFound('Document not found');
  return doc;
};

// GET /api/incubators/me/compliance?docType=&status=&financialYear=
const listCompliance = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { incubator: req.incubator._id, ...pick(req.query, ['docType', 'status', 'financialYear']) };
  const [items, total] = await Promise.all([
    ComplianceDocument.find(filter)
      .populate('grant', 'title provider')
      .populate('program', 'name')
      .populate('uploadedBy', 'name email')
      .sort({ financialYear: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    ComplianceDocument.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// POST /api/incubators/me/compliance  (multipart: one PDF in `file` + metadata)
const uploadCompliance = asyncHandler(async (req, res) => {
  const file = uploadedFile(req);
  if (!file) throw ApiError.badRequest('file (PDF) is required');
  const data = pick(req.body, FIELDS);
  await assertLinks(req, data);

  const doc = new ComplianceDocument({
    ...data, incubator: req.incubator._id, fileUrl: toPublicUrl(file), uploadedBy: req.user._id,
  });
  stampSubmission(doc);
  await doc.save();
  res.status(201).json({ success: true, data: doc });
});

// POST /api/incubators/me/compliance/generate
// { docType: utilization_certificate | expenditure_report, financialYear, grant?, program?, amountSanctioned?, title? }
const generateCompliance = asyncHandler(async (req, res) => {
  const {
    docType, financialYear, grant, program, amountSanctioned, title,
  } = req.body;
  const { doc: rendered, fileUrl, amountUtilized } = await generate(docType, req.incubator, {
    financialYear, grant, program, amountSanctioned,
  });

  try {
    const doc = await ComplianceDocument.create({
      incubator: req.incubator._id,
      docType,
      title: title || `${f.label(docType)} ${financialYear}`,
      financialYear,
      grant,
      program,
      amountSanctioned,
      amountUtilized,
      fileUrl,
      status: 'draft',
      uploadedBy: req.user._id,
    });
    res.status(201).json({ success: true, data: doc, preview: rendered });
  } catch (err) {
    await removeFile(fileUrl);
    throw err;
  }
});

// GET /api/incubators/me/compliance/:id
const getCompliance = asyncHandler(async (req, res) => {
  const doc = await findDoc(req);
  await doc.populate([{ path: 'grant', select: 'title provider' }, { path: 'program', select: 'name' }, { path: 'uploadedBy', select: 'name email' }]);
  res.json({ success: true, data: doc });
});

// PATCH /api/incubators/me/compliance/:id  (multipart; a new `file` replaces the old one)
const updateCompliance = asyncHandler(async (req, res) => {
  const doc = await findDoc(req);
  const data = pick(req.body, FIELDS);
  await assertLinks(req, data);

  const file = uploadedFile(req);
  const oldUrl = doc.fileUrl;
  doc.set(data);
  if (file) doc.fileUrl = toPublicUrl(file);
  stampSubmission(doc);
  await doc.save();
  if (file) await removeFile(oldUrl);
  res.json({ success: true, data: doc });
});

// DELETE /api/incubators/me/compliance/:id  (submitted / approved documents are kept on record)
const deleteCompliance = asyncHandler(async (req, res) => {
  const doc = await findDoc(req);
  if (['submitted', 'approved'].includes(doc.status)) {
    throw ApiError.conflict(`A ${doc.status} document can't be deleted`);
  }
  await doc.deleteOne();
  await removeFile(doc.fileUrl);
  res.json({ success: true, message: 'Document deleted' });
});

module.exports = {
  listCompliance, uploadCompliance, generateCompliance, getCompliance, updateCompliance, deleteCompliance,
};
