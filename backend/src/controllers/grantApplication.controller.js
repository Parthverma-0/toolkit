const {
  Grant, GrantApplication, FundingTransaction, Founder,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isAcceptingApplications = (grant, now = new Date()) => grant.status === 'open'
  && (!grant.opensAt || now >= grant.opensAt)
  && (!grant.deadline || now <= grant.deadline);

const uploadedDocs = (req) => (req.files?.documents || []).map((f) => ({ name: f.originalname, url: toPublicUrl(f) }));

// Incubator review flow; external grants are tracked by the startup itself
const REVIEW_TRANSITIONS = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  rejected: [],
  disbursed: [],
};

// =============== Startup side (after requireCompleteProfile) ===============

// GET /api/grants?status=&sector=&stage=&providerType=&q=
// Grants with no sector/stage restriction match every startup.
const browseGrants = asyncHandler(async (req, res) => {
  const {
    status, sector, stage, providerType, q,
  } = req.query;
  const pagination = getPagination(req.query);
  const filter = { status: status || { $in: ['open', 'upcoming'] } };
  const and = [];
  if (sector) and.push({ $or: [{ sectors: sector }, { sectors: { $size: 0 } }] });
  if (stage) and.push({ $or: [{ stages: stage }, { stages: { $size: 0 } }] });
  if (and.length) filter.$and = and;
  if (providerType) filter.providerType = providerType;
  if (q) filter.$or = [{ title: { $regex: escapeRegex(q), $options: 'i' } }, { provider: { $regex: escapeRegex(q), $options: 'i' } }];

  const [items, total] = await Promise.all([
    Grant.find(filter)
      .select('-createdBy')
      .populate('incubator', 'name logo')
      .sort({ deadline: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Grant.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/grants/:id
const getGrant = asyncHandler(async (req, res) => {
  const grant = await Grant.findById(req.params.id).select('-createdBy').populate('incubator', 'name logo');
  if (!grant) throw ApiError.notFound('Grant not found');
  const myApplication = await GrantApplication.findOne({ grant: grant._id, startup: req.startup._id });
  res.json({
    success: true,
    data: { ...grant.toObject(), isAcceptingApplications: isAcceptingApplications(grant), myApplication },
  });
});

// POST /api/grants/:id/applications  (multipart, up to 5 `documents` PDFs; submit=true to submit now)
const apply = asyncHandler(async (req, res) => {
  const grant = await Grant.findById(req.params.id);
  if (!grant) throw ApiError.notFound('Grant not found');
  if (!isAcceptingApplications(grant)) throw ApiError.badRequest('This grant is not accepting applications right now');
  if (await GrantApplication.exists({ grant: grant._id, startup: req.startup._id })) {
    throw ApiError.conflict('You already have an application for this grant');
  }

  const application = await GrantApplication.create({
    grant: grant._id,
    startup: req.startup._id,
    appliedBy: req.user._id,
    ...pick(req.body, ['amountRequested', 'purpose']),
    documents: uploadedDocs(req),
    status: req.body.submit ? 'submitted' : 'draft',
  });
  res.status(201).json({ success: true, data: application });
});

// GET /api/grants/applications/mine?status=
const listMyApplications = asyncHandler(async (req, res) => {
  const filter = { startup: req.startup._id };
  if (req.query.status) filter.status = req.query.status;
  const applications = await GrantApplication.find(filter)
    .populate('grant', 'title provider providerType deadline amount status')
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: applications });
});

// PATCH /api/grants/applications/:applicationId
//  - drafts: edit fields, add documents, submit=true to submit
//  - external grants (no incubator): record the outcome { status, amountSanctioned }
const updateMyApplication = asyncHandler(async (req, res) => {
  const application = await GrantApplication.findOne({ _id: req.params.applicationId, startup: req.startup._id }).populate('grant');
  if (!application) throw ApiError.notFound('Application not found');
  const { grant } = application;

  if (req.body.status) {
    if (grant.incubator) throw ApiError.forbidden('The incubator reviews this grant; you cannot set its status');
    if (application.status === 'draft') throw ApiError.badRequest('Submit the application first');
    application.status = req.body.status;
    if (req.body.amountSanctioned !== undefined) application.amountSanctioned = req.body.amountSanctioned;
  } else {
    if (application.status !== 'draft') throw ApiError.badRequest('Only draft applications can be edited');
    application.set(pick(req.body, ['amountRequested', 'purpose']));
    application.documents.push(...uploadedDocs(req));
    if (application.documents.length > 5) throw ApiError.badRequest('Maximum 5 documents per application');
    if (req.body.submit) {
      if (!isAcceptingApplications(grant)) throw ApiError.badRequest('This grant is no longer accepting applications');
      application.status = 'submitted';
    }
  }

  await application.save();
  res.json({ success: true, data: application });
});

// DELETE /api/grants/applications/:applicationId  (drafts only)
const deleteDraft = asyncHandler(async (req, res) => {
  const application = await GrantApplication.findOne({ _id: req.params.applicationId, startup: req.startup._id });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status !== 'draft') throw ApiError.badRequest('Only drafts can be deleted');
  await application.deleteOne();
  await Promise.all(application.documents.map((d) => removeFile(d.url)));
  res.json({ success: true, message: 'Draft deleted' });
});

// =============== Incubator side (after requireIncubator) ===============

// GET /api/incubators/me/grants/:id/applications?status=  (drafts are never shown)
const listGrantApplications = asyncHandler(async (req, res) => {
  const grant = await Grant.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!grant) throw ApiError.notFound('Grant not found');
  const filter = { grant: grant._id, status: req.query.status || { $ne: 'draft' } };

  const applications = await GrantApplication.find(filter)
    .populate('startup', 'name logo sector stage')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: applications });
});

const findReviewable = async (req) => {
  const application = await GrantApplication.findById(req.params.applicationId).populate('grant');
  if (!application || !application.grant.incubator?.equals(req.incubator._id) || application.status === 'draft') {
    throw ApiError.notFound('Application not found');
  }
  return application;
};

// GET /api/incubators/me/grant-applications/:applicationId
const getGrantApplication = asyncHandler(async (req, res) => {
  const application = await findReviewable(req);
  await application.populate('startup');
  const founders = await Founder.find({ startup: application.startup._id }).sort({ isPrimary: -1 });
  res.json({ success: true, data: { ...application.toObject(), founders } });
});

// PATCH /api/incubators/me/grant-applications/:applicationId/review
// { status, amountSanctioned?, reviewerRemarks?, referenceNo? }
// Disbursing records an "IC fund distributed" transaction for the dashboard.
const reviewGrantApplication = asyncHandler(async (req, res) => {
  const application = await findReviewable(req);
  const {
    status, amountSanctioned, reviewerRemarks, referenceNo,
  } = req.body;

  if (!REVIEW_TRANSITIONS[application.status].includes(status)) {
    throw ApiError.badRequest(`Cannot move a ${application.status} application to ${status}`);
  }
  if (amountSanctioned !== undefined) application.amountSanctioned = amountSanctioned;
  if (['approved', 'disbursed'].includes(status) && !application.amountSanctioned) {
    throw ApiError.badRequest('Set amountSanctioned to approve or disburse');
  }
  const maxAmount = application.grant.amount?.max;
  if (maxAmount && application.amountSanctioned > maxAmount) {
    throw ApiError.badRequest(`amountSanctioned exceeds this grant's maximum (${maxAmount})`);
  }

  application.status = status;
  if (reviewerRemarks !== undefined) application.reviewerRemarks = reviewerRemarks;
  await application.save();

  if (status === 'disbursed') {
    await FundingTransaction.create({
      type: 'ic_fund_distributed',
      incubator: req.incubator._id,
      startup: application.startup,
      grant: application.grant._id,
      instrument: 'grant',
      amount: application.amountSanctioned,
      date: new Date(),
      referenceNo,
      notes: `Disbursed for grant: ${application.grant.title}`,
      recordedBy: req.user._id,
    });
  }
  res.json({ success: true, data: application });
});

module.exports = {
  browseGrants,
  getGrant,
  apply,
  listMyApplications,
  updateMyApplication,
  deleteDraft,
  listGrantApplications,
  getGrantApplication,
  reviewGrantApplication,
};
