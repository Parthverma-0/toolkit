const mongoose = require('mongoose');
const {
  FinancialRecord, Grant, Program, Enrollment,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { fyOf } = require('../utils/financialYear');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { sumFinancial } = require('../services/reportBuilder.service');
const { usableGrantFilter } = require('../services/compliance.service');

// Incubator ledger (income / expense). Utilization certificates, expenditure reports and
// the year-end report are built from these. All routes run after requireIncubator.
const FIELDS = ['entryType', 'category', 'amount', 'date', 'isInternal', 'currency', 'description', 'referenceNo', 'grant', 'program', 'startup'];
const MAX_ATTACHMENTS = 5;

const uploaded = (req) => (req.files?.attachments || []).map((f) => ({ name: f.originalname, url: toPublicUrl(f) }));

// Linked grant / program / startup must be usable by this incubator
const assertLinks = async (req, data) => {
  const incubator = req.incubator._id;
  const checks = [
    data.grant && Grant.exists({ _id: data.grant, ...usableGrantFilter(incubator) }).then((ok) => ok || 'grant not found'),
    data.program && Program.exists({ _id: data.program, incubator }).then((ok) => ok || 'program not found in your incubator'),
    data.startup && Enrollment.exists({ incubator, startup: data.startup }).then((ok) => ok || 'startup is not part of your incubator'),
  ].filter(Boolean);
  const failed = (await Promise.all(checks)).filter((r) => typeof r === 'string');
  if (failed.length) throw ApiError.badRequest(failed.join('; '));
};

const findRecord = async (req) => {
  const record = await FinancialRecord.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!record) throw ApiError.notFound('Financial record not found');
  return record;
};

// Query filter; ids are cast because the same object feeds an aggregation (no auto-casting there)
const buildFilter = (req) => {
  const {
    financialYear, entryType, category, isInternal, grant, program, startup, from, to,
  } = req.query;
  const oid = (v) => new mongoose.Types.ObjectId(String(v));
  const filter = { incubator: req.incubator._id };
  if (financialYear) filter.financialYear = financialYear;
  if (entryType) filter.entryType = entryType;
  if (category) filter.category = category;
  if (isInternal !== undefined) filter.isInternal = isInternal;
  if (grant) filter.grant = oid(grant);
  if (program) filter.program = oid(program);
  if (startup) filter.startup = oid(startup);
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  return filter;
};

// GET /api/incubators/me/financial-records?financialYear=&entryType=&category=&isInternal=&grant=&program=&startup=&from=&to=
const listFinancialRecords = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const filter = buildFilter(req);
  const [items, total, totals] = await Promise.all([
    FinancialRecord.find(filter)
      .populate('grant', 'title provider')
      .populate('program', 'name')
      .populate('startup', 'name logo')
      .sort({ date: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    FinancialRecord.countDocuments(filter),
    sumFinancial(filter),
  ]);
  res.json({
    success: true,
    data: items,
    totals: { ...totals, net: totals.totalIncome - totals.totalExpense },
    pagination: paginationMeta(pagination, total),
  });
});

// POST /api/incubators/me/financial-records  (multipart, up to 5 `attachments`: PDF / JPG / PNG / WebP)
const createFinancialRecord = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await assertLinks(req, data);
  const record = await FinancialRecord.create({
    ...data,
    incubator: req.incubator._id,
    financialYear: fyOf(data.date),
    attachments: uploaded(req),
    recordedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: record });
});

// PATCH /api/incubators/me/financial-records/:id  (new attachments are added to the existing ones)
const updateFinancialRecord = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  const data = pick(req.body, FIELDS);
  await assertLinks(req, data);

  record.set(data);
  if (data.date) record.financialYear = fyOf(data.date);
  record.attachments.push(...uploaded(req));
  if (record.attachments.length > MAX_ATTACHMENTS) throw ApiError.badRequest(`Maximum ${MAX_ATTACHMENTS} attachments per record`);
  await record.save();
  res.json({ success: true, data: record });
});

// DELETE /api/incubators/me/financial-records/:id/attachments/:attachmentId
const removeAttachment = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  const attachment = record.attachments.id(req.params.attachmentId);
  if (!attachment) throw ApiError.notFound('Attachment not found');
  attachment.deleteOne();
  await record.save();
  await removeFile(attachment.url);
  res.json({ success: true, data: record });
});

// DELETE /api/incubators/me/financial-records/:id
const deleteFinancialRecord = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  await record.deleteOne();
  await Promise.all(record.attachments.map((a) => removeFile(a.url)));
  res.json({ success: true, message: 'Financial record deleted' });
});

module.exports = {
  listFinancialRecords, createFinancialRecord, updateFinancialRecord, removeAttachment, deleteFinancialRecord,
};
