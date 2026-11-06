const mongoose = require('mongoose');
const {
  Cohort, Program, CohortApplication, Enrollment,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const cohortService = require('../services/cohort.service');

// Incubator-side cohort management. All routes run after requireIncubator.
const FIELDS = [
  'name', 'program', 'startDate', 'endDate', 'objective', 'targetStartups', 'eligibilityCriteria', 'outcomeMapping',
  'registrationForm', 'marketing', 'agreement', 'growthMetrics', 'milestoneChecklist', 'exitConditions',
];
const NESTED = ['targetStartups', 'registrationForm', 'marketing', 'agreement'];

const countByStatus = async (Model, cohortId) => {
  const rows = await Model.aggregate([
    { $match: { cohort: new mongoose.Types.ObjectId(cohortId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

const assertProgramBelongs = async (req, programId) => {
  if (programId && !(await Program.exists({ _id: programId, incubator: req.incubator._id }))) {
    throw ApiError.badRequest('Program not found in your incubator');
  }
};

const sanitize = (body) => {
  const data = pick(body, FIELDS);
  // status drives isOpen; clients can't set it directly
  if (data.registrationForm) delete data.registrationForm.isOpen;
  return data;
};

// GET /api/incubators/me/cohorts?status=&program=
const listCohorts = asyncHandler(async (req, res) => {
  const filter = { incubator: req.incubator._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.program) filter.program = req.query.program;

  const cohorts = await Cohort.find(filter)
    .select('name program status startDate endDate targetStartups registrationForm.opensAt registrationForm.closesAt')
    .populate('program', 'name type')
    .sort({ startDate: -1 });
  res.json({ success: true, data: cohorts });
});

// GET /api/incubators/me/cohorts/:id  (full template + application / enrollment counts)
const getCohort = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  await cohort.populate('program', 'name type');
  const [applications, enrollments] = await Promise.all([
    countByStatus(CohortApplication, cohort._id),
    countByStatus(Enrollment, cohort._id),
  ]);
  res.json({
    success: true,
    data: {
      ...cohort.toObject(),
      isRegistrationOpen: cohortService.isRegistrationOpen(cohort),
      stats: { applications, enrollments },
    },
  });
});

// POST /api/incubators/me/cohorts  (multipart, optional `agreementFormat` PDF)
const createCohort = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  await assertProgramBelongs(req, data.program);

  const file = req.files?.agreementFormat?.[0];
  if (file) data.agreement = { ...data.agreement, formatUrl: toPublicUrl(file) };

  const cohort = await Cohort.create({
    ...data, incubator: req.incubator._id, createdBy: req.user._id, status: 'draft',
  });
  res.status(201).json({ success: true, data: cohort });
});

// PATCH /api/incubators/me/cohorts/:id  (template arrays are replaced as a whole)
const updateCohort = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  if (['completed', 'cancelled'].includes(cohort.status)) throw ApiError.badRequest(`A ${cohort.status} cohort can't be edited`);

  const data = sanitize(req.body);
  await assertProgramBelongs(req, data.program);

  const file = req.files?.agreementFormat?.[0];
  const oldFormat = cohort.agreement?.formatUrl;
  if (file) data.agreement = { ...data.agreement, formatUrl: toPublicUrl(file) };

  applyUpdates(cohort, data, NESTED);
  if (cohort.endDate <= cohort.startDate) throw ApiError.badRequest('endDate must be after startDate');
  await cohort.save();
  if (file && oldFormat) await removeFile(oldFormat);

  res.json({ success: true, data: cohort });
});

// PATCH /api/incubators/me/cohorts/:id/status  { status, graduateActive? }
const changeStatus = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  await cohortService.changeStatus(cohort, req.body.status, { graduateActive: req.body.graduateActive, user: req.user });
  res.json({ success: true, data: cohort, allowedNext: cohortService.TRANSITIONS[cohort.status] });
});

// DELETE /api/incubators/me/cohorts/:id  (only drafts without any applications)
const deleteCohort = asyncHandler(async (req, res) => {
  const cohort = await cohortService.findIncubatorCohort(req.incubator._id, req.params.id);
  if (cohort.status !== 'draft') throw ApiError.badRequest('Only draft cohorts can be deleted; cancel it instead');
  if (await CohortApplication.exists({ cohort: cohort._id })) throw ApiError.conflict('This cohort has applications; cancel it instead');

  await cohort.deleteOne();
  await removeFile(cohort.agreement?.formatUrl);
  res.json({ success: true, message: 'Cohort deleted' });
});

module.exports = {
  listCohorts, getCohort, createCohort, updateCohort, changeStatus, deleteCohort,
};
