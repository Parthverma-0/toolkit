const { Enrollment } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const cohortService = require('../services/cohort.service');
const { upsertMonthlyMetric, listMetrics } = require('../services/metric.service');

// Enrollments are reachable by the incubator (req.incubator) and by the
// enrolled startup itself (req.startup); `scope` builds the ownership filter.
const incubatorScope = (req) => ({ incubator: req.incubator._id });
const startupScope = (req) => ({ startup: req.startup._id });

const findEnrollment = async (req, scope) => {
  const enrollment = await Enrollment.findOne({ _id: req.params.enrollmentId, ...scope(req) });
  if (!enrollment) throw ApiError.notFound('Enrollment not found');
  return enrollment;
};

const assertActive = (enrollment) => {
  if (enrollment.status !== 'active') throw ApiError.badRequest(`This startup has ${enrollment.status}; the enrollment is read-only`);
};

const progress = (enrollment) => {
  const done = enrollment.milestones.filter((m) => m.status === 'completed').length;
  const checked = enrollment.marketingChecklist.filter((c) => c.isDone).length;
  return {
    milestones: { done, total: enrollment.milestones.length },
    marketingChecklist: { done: checked, total: enrollment.marketingChecklist.length },
    agreementSigned: enrollment.agreement.isSigned,
  };
};

// =============== Incubator side ===============

// POST /api/incubators/me/cohorts/:id/enrollments  { applicationId | startupId, mode? }
const enroll = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  const enrollment = await cohortService.enrollStartup({
    cohort,
    incubator: req.incubator,
    user: req.user,
    applicationId: req.body.applicationId,
    startupId: req.body.startupId,
    mode: req.body.mode,
  });
  res.status(201).json({ success: true, data: enrollment });
});

// GET /api/incubators/me/cohorts/:id/enrollments?status=
const listCohortEnrollments = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  const filter = { cohort: cohort._id };
  if (req.query.status) filter.status = req.query.status;

  const enrollments = await Enrollment.find(filter)
    .populate('startup', 'name logo sector stage')
    .sort({ onboardedAt: -1 });
  res.json({
    success: true,
    data: enrollments.map((e) => ({ ...e.toObject(), progress: progress(e) })),
  });
});

// GET /api/incubators/me/enrollments/:enrollmentId  |  GET /api/startups/me/enrollments/:enrollmentId
const getEnrollment = (scope) => asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, scope);
  await enrollment.populate([
    { path: 'startup', select: 'name logo sector stage startupEmail' },
    {
      path: 'cohort',
      select: 'name startDate endDate status objective outcomeMapping growthMetrics exitConditions agreement marketing.tools',
    },
    { path: 'onboardedBy', select: 'name' },
  ]);
  res.json({ success: true, data: { ...enrollment.toObject(), progress: progress(enrollment) } });
});

// PATCH /api/incubators/me/enrollments/:enrollmentId  { mode?, eligibility? }
const updateEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  assertActive(enrollment);
  if (req.body.mode) enrollment.mode = req.body.mode;
  if (req.body.eligibility) {
    const { isEligible, notes } = req.body.eligibility;
    if (isEligible !== undefined) enrollment.eligibility.isEligible = isEligible;
    if (notes !== undefined) enrollment.eligibility.notes = notes;
    enrollment.eligibility.verifiedBy = req.user._id;
  }
  await enrollment.save();
  res.json({ success: true, data: enrollment });
});

// POST /api/incubators/me/enrollments/:enrollmentId/agreement  (multipart `signedAgreement` PDF)
const signAgreement = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  assertActive(enrollment);
  const file = req.files?.signedAgreement?.[0];
  if (!file) throw ApiError.badRequest('Upload the signed agreement (signedAgreement PDF)');

  const oldDocument = enrollment.agreement.documentUrl;
  enrollment.agreement.set({
    isSigned: true,
    signedAt: new Date(),
    documentUrl: toPublicUrl(file),
    ...(req.body.acceptedConditions && { acceptedConditions: req.body.acceptedConditions }),
    ...(req.body.equityPercent !== undefined && { equityPercent: req.body.equityPercent }),
  });
  await enrollment.save();
  if (oldDocument) await removeFile(oldDocument);
  res.json({ success: true, data: enrollment.agreement });
});

// PATCH .../enrollments/:enrollmentId/checklist/:itemId  { isDone }  (both sides)
const setChecklistItem = (scope) => asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, scope);
  assertActive(enrollment);
  const item = enrollment.marketingChecklist.id(req.params.itemId);
  if (!item) throw ApiError.notFound('Checklist item not found');

  item.isDone = req.body.isDone;
  item.doneAt = req.body.isDone ? new Date() : undefined;
  await enrollment.save();
  res.json({ success: true, data: item, progress: progress(enrollment) });
});

// POST /api/incubators/me/enrollments/:enrollmentId/milestones  { title, dueDate? }  (startup-specific milestone)
const addMilestone = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  assertActive(enrollment);
  enrollment.milestones.push({ title: req.body.title, dueDate: req.body.dueDate });
  await enrollment.save();
  res.status(201).json({ success: true, data: enrollment.milestones.at(-1) });
});

// PATCH .../enrollments/:enrollmentId/milestones/:milestoneId  { status?, evidenceUrl?, dueDate? }
// Startups can update status / evidence; only the incubator can move due dates or mark "missed".
const updateMilestone = (scope, { canEditDueDate }) => asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, scope);
  assertActive(enrollment);
  const milestone = enrollment.milestones.id(req.params.milestoneId);
  if (!milestone) throw ApiError.notFound('Milestone not found');

  const { status, evidenceUrl, dueDate } = req.body;
  if (status) {
    milestone.status = status;
    milestone.completedAt = status === 'completed' ? new Date() : undefined;
  }
  if (evidenceUrl !== undefined) milestone.evidenceUrl = evidenceUrl;
  if (dueDate && canEditDueDate) milestone.dueDate = dueDate;
  await enrollment.save();
  res.json({ success: true, data: milestone, progress: progress(enrollment) });
});

// POST /api/incubators/me/enrollments/:enrollmentId/exit  { type, condition?, remarks?, date? }
const exitEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  await cohortService.exitEnrollment(enrollment, req.body);
  res.json({ success: true, data: enrollment });
});

// POST .../enrollments/:enrollmentId/metrics  { month, year, revenue?, ..., custom? }
const recordEnrollmentMetric = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  const metric = await upsertMonthlyMetric({
    startupId: enrollment.startup,
    cohortId: enrollment.cohort,
    month: req.body.month,
    year: req.body.year,
    values: req.body,
    custom: req.body.custom,
    userId: req.user._id,
  });
  res.json({ success: true, data: metric });
});

// GET .../enrollments/:enrollmentId/metrics?fromMonth=&fromYear=&toMonth=&toYear=
const listEnrollmentMetrics = asyncHandler(async (req, res) => {
  const enrollment = await findEnrollment(req, incubatorScope);
  await enrollment.populate('cohort', 'growthMetrics');
  const { fromMonth, fromYear, toMonth, toYear } = req.query;
  const metrics = await listMetrics(enrollment.startup, {
    from: fromYear && { year: fromYear, month: fromMonth || 1 },
    to: toYear && { year: toYear, month: toMonth || 12 },
  });
  res.json({ success: true, data: metrics, targets: enrollment.cohort.growthMetrics });
});

// =============== Startup side (after requireStartup) ===============

// GET /api/startups/me/enrollments
const listMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ startup: req.startup._id })
    .populate({ path: 'cohort', select: 'name startDate endDate status incubator', populate: { path: 'incubator', select: 'name logo' } })
    .sort({ onboardedAt: -1 });
  res.json({ success: true, data: enrollments.map((e) => ({ ...e.toObject(), progress: progress(e) })) });
});

module.exports = {
  enroll,
  listCohortEnrollments,
  updateEnrollment,
  signAgreement,
  addMilestone,
  exitEnrollment,
  recordEnrollmentMetric,
  listEnrollmentMetrics,
  listMyEnrollments,
  getIncubatorEnrollment: getEnrollment(incubatorScope),
  getMyEnrollment: getEnrollment(startupScope),
  incubatorChecklistItem: setChecklistItem(incubatorScope),
  myChecklistItem: setChecklistItem(startupScope),
  incubatorMilestone: updateMilestone(incubatorScope, { canEditDueDate: true }),
  myMilestone: updateMilestone(startupScope, { canEditDueDate: false }),
};
