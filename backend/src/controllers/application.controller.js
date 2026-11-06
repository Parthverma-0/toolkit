const { Cohort, CohortApplication, Founder } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const cohortService = require('../services/cohort.service');
const { track } = require('../services/funnel.service');

const STARTUP_SUMMARY = 'name logo sector stage tagline startupEmail website';
// What a startup sees of a cohort before applying (no internal agreement / exit details)
const PUBLIC_COHORT_FIELDS = 'name incubator program startDate endDate objective targetStartups eligibilityCriteria outcomeMapping registrationForm status';

// =============== Incubator side (after requireIncubator) ===============

// GET /api/incubators/me/cohorts/:id/applications?status=
const listApplications = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { cohort: cohort._id };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    CohortApplication.find(filter)
      .populate('startup', STARTUP_SUMMARY)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    CohortApplication.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/incubators/me/applications/:applicationId  (full startup profile + founders + answers)
const getApplication = asyncHandler(async (req, res) => {
  const application = await CohortApplication.findOne({ _id: req.params.applicationId, incubator: req.incubator._id })
    .populate('startup')
    .populate('cohort', 'name registrationForm.fields')
    .populate('reviewedBy', 'name');
  if (!application) throw ApiError.notFound('Application not found');

  const founders = await Founder.find({ startup: application.startup._id }).sort({ isPrimary: -1 });
  res.json({ success: true, data: { ...application.toObject(), founders } });
});

// PATCH /api/incubators/me/applications/:applicationId/review  { status, remarks?, isEligible? }
// Acceptance happens through enrollment, not here.
const reviewApplication = asyncHandler(async (req, res) => {
  const application = await CohortApplication.findOne({ _id: req.params.applicationId, incubator: req.incubator._id })
    .populate('startup', 'owner');
  if (!application) throw ApiError.notFound('Application not found');
  if (['accepted', 'withdrawn'].includes(application.status)) {
    throw ApiError.badRequest(`This application is already ${application.status}`);
  }

  const { status, remarks, isEligible } = req.body;
  application.status = status;
  application.reviewedBy = req.user._id;
  if (remarks !== undefined) application.remarks = remarks;
  if (isEligible !== undefined) application.eligibility.isEligible = isEligible;
  await application.save();

  if (status === 'shortlisted') {
    await track({
      incubator: req.incubator._id,
      stage: 'shortlisted',
      user: application.startup.owner,
      startup: application.startup._id,
      cohort: application.cohort,
    });
  }
  res.json({ success: true, data: application });
});

// =============== Startup side ===============

// GET /api/cohorts?sector=&incubator=  (cohorts currently accepting applications)
const browseOpenCohorts = asyncHandler(async (req, res) => {
  const now = new Date();
  const pagination = getPagination(req.query);
  const filter = {
    status: 'registration_open',
    $and: [
      { $or: [{ 'registrationForm.opensAt': null }, { 'registrationForm.opensAt': { $lte: now } }] },
      { $or: [{ 'registrationForm.closesAt': null }, { 'registrationForm.closesAt': { $gte: now } }] },
    ],
  };
  if (req.query.incubator) filter.incubator = req.query.incubator;
  // Cohorts with no sector target are open to all sectors
  if (req.query.sector) filter.$and.push({ $or: [{ 'targetStartups.sectors': req.query.sector }, { 'targetStartups.sectors': { $size: 0 } }] });

  const [items, total] = await Promise.all([
    Cohort.find(filter)
      .select('name incubator program startDate endDate objective targetStartups registrationForm.closesAt')
      .populate('incubator', 'name logo address.city')
      .populate('program', 'name type')
      .sort({ 'registrationForm.closesAt': 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Cohort.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/cohorts/:id  (details + registration form; drafts are hidden)
const getCohortForStartup = asyncHandler(async (req, res) => {
  const cohort = await Cohort.findOne({ _id: req.params.id, status: { $ne: 'draft' } })
    .select(PUBLIC_COHORT_FIELDS)
    .populate('incubator', 'name logo about address')
    .populate('program', 'name type description benefits');
  if (!cohort) throw ApiError.notFound('Cohort not found');

  const myApplication = req.startup
    ? await CohortApplication.findOne({ cohort: cohort._id, startup: req.startup._id }).select('status createdAt')
    : null;

  res.json({
    success: true,
    data: { ...cohort.toObject(), isRegistrationOpen: cohortService.isRegistrationOpen(cohort), myApplication },
  });
});

// POST /api/cohorts/:id/apply  { responses: { fieldKey: value }, source? }  (requireCompleteProfile)
const applyToCohort = asyncHandler(async (req, res) => {
  const cohort = await Cohort.findById(req.params.id);
  if (!cohort || cohort.status === 'draft') throw ApiError.notFound('Cohort not found');
  if (!cohortService.isRegistrationOpen(cohort)) throw ApiError.badRequest('Registration for this cohort is closed');

  const existing = await CohortApplication.findOne({ cohort: cohort._id, startup: req.startup._id });
  if (existing && existing.status !== 'withdrawn') throw ApiError.conflict('You have already applied to this cohort');

  const responses = cohortService.validateResponses(cohort, req.body.responses);
  const eligibility = cohortService.autoEligibility(cohort, req.startup);

  // A withdrawn application can be re-submitted (unique index on cohort + startup)
  const application = existing || new CohortApplication({ cohort: cohort._id, incubator: cohort.incubator, startup: req.startup._id });
  application.set({
    submittedBy: req.user._id, responses, eligibility, status: 'submitted', remarks: undefined, reviewedBy: undefined,
  });
  await application.save();

  const source = req.body.source
    || (req.user.acquisition?.incubator?.equals(cohort.incubator) ? req.user.acquisition.source : 'platform_search');
  await track({
    incubator: cohort.incubator, stage: 'cohort_applied', user: req.user._id, startup: req.startup._id, cohort: cohort._id, source,
  });

  res.status(201).json({ success: true, data: application });
});

// GET /api/startups/me/applications
const listMyApplications = asyncHandler(async (req, res) => {
  const applications = await CohortApplication.find({ startup: req.startup._id })
    .select('-responses')
    .populate({ path: 'cohort', select: 'name startDate endDate status incubator', populate: { path: 'incubator', select: 'name logo' } })
    .sort({ createdAt: -1 });
  res.json({ success: true, data: applications });
});

// POST /api/startups/me/applications/:applicationId/withdraw
const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await CohortApplication.findOne({ _id: req.params.applicationId, startup: req.startup._id });
  if (!application) throw ApiError.notFound('Application not found');
  if (['accepted', 'rejected', 'withdrawn'].includes(application.status)) {
    throw ApiError.badRequest(`An application that is ${application.status} can't be withdrawn`);
  }
  application.status = 'withdrawn';
  await application.save();
  res.json({ success: true, data: application });
});

module.exports = {
  listApplications,
  getApplication,
  reviewApplication,
  browseOpenCohorts,
  getCohortForStartup,
  applyToCohort,
  listMyApplications,
  withdrawApplication,
};
