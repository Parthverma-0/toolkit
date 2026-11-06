const {
  FundingTransaction, Enrollment, Cohort, Program, Grant, Investor,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { sumByType } = require('../services/incubatorDashboard.service');

// IC funding ledger behind the dashboard funding cards. All routes run after requireIncubator.
const FIELDS = ['type', 'instrument', 'amount', 'date', 'startup', 'cohort', 'program', 'grant', 'investor', 'source', 'round', 'currency', 'referenceNo', 'notes'];

const uploadedDocs = (req) => (req.files?.documents || []).map((f) => ({ name: f.originalname, url: toPublicUrl(f) }));

// Every linked record must belong to this incubator (investors are a shared directory)
const assertLinks = async (req, data) => {
  const incubator = req.incubator._id;
  if (data.type && data.type !== 'ic_fund_raised' && !data.startup) {
    throw ApiError.badRequest('startup is required for distributed and external funding');
  }
  if (data.type === 'ic_fund_raised' && data.startup) {
    throw ApiError.badRequest("Funds raised by the IC aren't linked to a startup");
  }
  const checks = [
    data.startup && Enrollment.exists({ incubator, startup: data.startup }).then((ok) => ok || 'startup is not part of your incubator'),
    data.cohort && Cohort.exists({ incubator, _id: data.cohort }).then((ok) => ok || 'cohort not found in your incubator'),
    data.program && Program.exists({ incubator, _id: data.program }).then((ok) => ok || 'program not found in your incubator'),
    data.grant && Grant.exists({ incubator, _id: data.grant }).then((ok) => ok || 'grant not found in your incubator'),
    data.investor && Investor.exists({ _id: data.investor }).then((ok) => ok || 'investor not found'),
  ].filter(Boolean);
  const failed = (await Promise.all(checks)).filter((r) => typeof r === 'string');
  if (failed.length) throw ApiError.badRequest(failed.join('; '));
};

const findRecord = async (req) => {
  const record = await FundingTransaction.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!record) throw ApiError.notFound('Funding record not found');
  return record;
};

// GET /api/incubators/me/funding?type=&startup=&from=&to=
const listFunding = asyncHandler(async (req, res) => {
  const {
    type, startup, from, to,
  } = req.query;
  const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { incubator: req.incubator._id };
  if (type) filter.type = type;
  if (startup) filter.startup = startup;
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total, totals] = await Promise.all([
    FundingTransaction.find(filter)
      .populate('startup', 'name logo')
      .populate('grant', 'title')
      .populate('investor', 'name firm')
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    FundingTransaction.countDocuments(filter),
    sumByType(req.incubator._id, { from, to }),
  ]);
  res.json({
    success: true, data: items, totals, pagination: paginationMeta(pagination, total),
  });
});

// POST /api/incubators/me/funding  (multipart, up to 5 `documents` PDFs)
const createFunding = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await assertLinks(req, data);
  const record = await FundingTransaction.create({
    ...data, incubator: req.incubator._id, documents: uploadedDocs(req), recordedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: record });
});

// PATCH /api/incubators/me/funding/:id
const updateFunding = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  const data = pick(req.body, FIELDS);
  await assertLinks(req, {
    type: data.type || record.type,
    startup: data.startup !== undefined ? data.startup : record.startup,
    ...pick(data, ['cohort', 'program', 'grant', 'investor']),
  });

  record.set(data);
  record.documents.push(...uploadedDocs(req));
  if (record.documents.length > 5) throw ApiError.badRequest('Maximum 5 documents per record');
  await record.save();
  res.json({ success: true, data: record });
});

// DELETE /api/incubators/me/funding/:id
const deleteFunding = asyncHandler(async (req, res) => {
  const record = await findRecord(req);
  await record.deleteOne();
  await Promise.all(record.documents.map((d) => removeFile(d.url)));
  res.json({ success: true, message: 'Funding record deleted' });
});

module.exports = {
  listFunding, createFunding, updateFunding, deleteFunding,
};
