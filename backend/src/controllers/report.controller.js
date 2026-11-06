const { Report } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const f = require('../utils/format');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { buildReport, BUILDERS } = require('../services/reportBuilder.service');
const { renderPdf, renderXlsx } = require('../services/reportRenderer.service');

// Government / internal reports. Generating one stores the rendered snapshot in `data`,
// so a downloaded report never changes after it was generated (use regenerate for fresh numbers).
// All routes run after requireIncubator.

const INTERNAL_TYPES = ['internal_compliance'];

const findReport = async (req, projection) => {
  const query = Report.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (projection) query.select(projection);
  const report = await query;
  if (!report) throw ApiError.notFound('Report not found');
  return report;
};

const assertNotSubmitted = (report) => {
  if (report.status === 'submitted') throw ApiError.conflict('This report was already submitted and is locked');
};

const paramsOf = (src) => ({
  cohort: src.cohort ? String(src.cohort) : undefined,
  program: src.program ? String(src.program) : undefined,
  from: src.from ?? src.period?.from,
  to: src.to ?? src.period?.to,
  financialYear: src.financialYear,
});

const defaultTitle = (doc) => [doc.title, doc.subtitle].filter(Boolean).join(' - ');

// GET /api/incubators/me/reports/types
const listReportTypes = (req, res) => {
  const data = Object.entries(BUILDERS).map(([type, { needs }]) => ({
    type, label: f.label(type), needs, format: INTERNAL_TYPES.includes(type) ? 'internal' : 'government',
  }));
  res.json({ success: true, data });
};

// GET /api/incubators/me/reports?type=&status=&financialYear=
const listReports = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { incubator: req.incubator._id, ...pick(req.query, ['type', 'status', 'financialYear']) };
  const [items, total] = await Promise.all([
    Report.find(filter)
      .select('-data')
      .populate('cohort', 'name')
      .populate('program', 'name')
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Report.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// POST /api/incubators/me/reports  { type, title?, format?, cohort?, program?, from?, to?, financialYear? }
const createReport = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const params = paramsOf(req.body);
  const doc = await buildReport(type, req.incubator, params);

  const report = await Report.create({
    incubator: req.incubator._id,
    type,
    format: req.body.format || (INTERNAL_TYPES.includes(type) ? 'internal' : 'government'),
    title: req.body.title || defaultTitle(doc),
    cohort: params.cohort,
    program: params.program,
    period: params.from || params.to ? { from: params.from, to: params.to } : undefined,
    financialYear: params.financialYear,
    data: doc,
    status: 'generated',
    generatedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: report });
});

// GET /api/incubators/me/reports/:id  (includes the snapshot for on-screen preview)
const getReport = asyncHandler(async (req, res) => {
  const report = await findReport(req);
  await report.populate([{ path: 'cohort', select: 'name' }, { path: 'program', select: 'name' }, { path: 'generatedBy', select: 'name email' }]);
  res.json({ success: true, data: report });
});

// POST /api/incubators/me/reports/:id/regenerate  (same type and params, fresh numbers)
const regenerateReport = asyncHandler(async (req, res) => {
  const report = await findReport(req);
  assertNotSubmitted(report);
  report.data = await buildReport(report.type, req.incubator, paramsOf(report));
  report.markModified('data');
  report.status = 'generated';
  report.generatedBy = req.user._id;
  await report.save();
  res.json({ success: true, data: report });
});

// GET /api/incubators/me/reports/:id/download?fileType=pdf|xlsx
const downloadReport = asyncHandler(async (req, res) => {
  const report = await findReport(req);
  const fileType = req.query.fileType || 'pdf';
  const doc = report.data;
  if (!doc?.sections) throw ApiError.badRequest('This report has no generated content yet');

  const fileName = `${report.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'report'}.${fileType}`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  if (fileType === 'xlsx') {
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(await renderXlsx(doc));
    return;
  }
  res.type('application/pdf');
  renderPdf(doc).pipe(res);
});

// PATCH /api/incubators/me/reports/:id/submit  { submittedTo, submittedAt? }
const submitReport = asyncHandler(async (req, res) => {
  const report = await findReport(req, '-data');
  assertNotSubmitted(report);
  report.set({ status: 'submitted', submittedTo: req.body.submittedTo, submittedAt: req.body.submittedAt || new Date() });
  await report.save();
  res.json({ success: true, data: report });
});

// DELETE /api/incubators/me/reports/:id  (submitted reports are kept as a record)
const deleteReport = asyncHandler(async (req, res) => {
  const report = await findReport(req, 'status');
  assertNotSubmitted(report);
  await report.deleteOne();
  res.json({ success: true, message: 'Report deleted' });
});

module.exports = {
  listReportTypes, listReports, createReport, getReport, regenerateReport, downloadReport, submitReport, deleteReport,
};
