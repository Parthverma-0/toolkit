const { body, param, query } = require('express-validator');
const {
  SECTORS, STARTUP_STAGES, FORM_FIELD_TYPES, ACQUISITION_SOURCES,
} = require('../utils/constants');
const { toJson } = require('../utils/multipart');

const COHORT_STATUSES = ['draft', 'registration_open', 'ongoing', 'completed', 'cancelled'];
const APPLICATION_STATUSES = ['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];
const ENROLLMENT_STATUSES = ['active', 'graduated', 'exited', 'dropped'];
const EXIT_TYPES = ['graduation', 'termination', 'voluntary'];
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'missed'];
const FIELD_KEY = /^[a-z][a-z0-9_]{0,49}$/;

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isOptionalNumber = (v) => v === undefined || v === null || Number.isFinite(Number(v));

// Validates an array of objects where `requiredKey` must be a non-empty string
const arrayOf = (path, requiredKey, { max = 50, extra } = {}) => body(path).optional()
  .customSanitizer(toJson)
  .isArray({ max }).withMessage(`${path} must be an array (max ${max})`)
  .bail()
  .custom((arr) => arr.every((item) => isPlainObject(item) && isNonEmptyString(item[requiredKey]) && (!extra || extra(item))))
  .withMessage(`each ${path} item needs a ${requiredKey}${extra ? ' and valid optional fields' : ''}`);

const formFields = body('registrationForm.fields').optional()
  .isArray({ max: 50 }).withMessage('registrationForm.fields must be an array (max 50)')
  .bail()
  .custom((fields) => {
    const keys = new Set();
    fields.forEach((f, i) => {
      const where = `field #${i + 1}`;
      if (!isPlainObject(f)) throw new Error(`${where} must be an object`);
      if (!FIELD_KEY.test(f.key || '')) throw new Error(`${where}: key must be snake_case (a-z, 0-9, _)`);
      if (keys.has(f.key)) throw new Error(`${where}: duplicate key "${f.key}"`);
      keys.add(f.key);
      if (!isNonEmptyString(f.label)) throw new Error(`${where}: label is required`);
      if (!FORM_FIELD_TYPES.includes(f.type)) throw new Error(`${where}: type must be one of ${FORM_FIELD_TYPES.join(', ')}`);
      if (['select', 'multiselect'].includes(f.type) && !(Array.isArray(f.options) && f.options.length)) {
        throw new Error(`${where}: ${f.type} needs a non-empty options list`);
      }
    });
    return true;
  });

const cohortFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('objective')).isString().withMessage('objective is required').bail().trim().notEmpty().withMessage('objective is required').isLength({ max: 5000 }),
    req(body('startDate')).isISO8601().withMessage('startDate must be a date').toDate(),
    req(body('endDate')).isISO8601().withMessage('endDate must be a date').toDate()
      .custom((end, { req: r }) => !r.body.startDate || new Date(end) > new Date(r.body.startDate))
      .withMessage('endDate must be after startDate'),
    body('program').optional({ values: 'null' }).isMongoId().withMessage('Invalid program id'),

    body('targetStartups').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('targetStartups must be an object'),
    body('targetStartups.count').optional().isInt({ min: 1, max: 10000 }).toInt(),
    body('targetStartups.sectors').optional().isArray().custom((a) => a.every((v) => SECTORS.includes(v)))
      .withMessage(`targetStartups.sectors values must be from: ${SECTORS.join(', ')}`),
    body('targetStartups.stages').optional().isArray().custom((a) => a.every((v) => STARTUP_STAGES.includes(v)))
      .withMessage(`targetStartups.stages values must be from: ${STARTUP_STAGES.join(', ')}`),

    arrayOf('eligibilityCriteria', 'criterion'),
    arrayOf('outcomeMapping', 'outcome', { extra: (o) => isOptionalNumber(o.target) }),

    body('registrationForm').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('registrationForm must be an object'),
    body(['registrationForm.opensAt', 'registrationForm.closesAt']).optional({ values: 'null' }).isISO8601().toDate(),
    body('registrationForm.closesAt').optional({ values: 'null' })
      .custom((closes, { req: r }) => !r.body.registrationForm?.opensAt || new Date(closes) > new Date(r.body.registrationForm.opensAt))
      .withMessage('registrationForm.closesAt must be after opensAt'),
    formFields,

    body('marketing').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('marketing must be an object'),
    arrayOf('marketing.tools', 'name'),
    arrayOf('marketing.checklist', 'item'),

    body('agreement').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('agreement must be an object'),
    body('agreement.templateText').optional().isString().isLength({ max: 50000 }),
    arrayOf('agreement.conditions', 'title'),

    arrayOf('growthMetrics', 'name', {
      max: 30,
      extra: (m) => isOptionalNumber(m.target) && (!m.frequency || ['monthly', 'quarterly', 'end_of_cohort'].includes(m.frequency)),
    }),
    arrayOf('milestoneChecklist', 'title', { extra: (m) => m.dueInWeeks === undefined || Number.isInteger(Number(m.dueInWeeks)) }),
    arrayOf('exitConditions', 'condition', { extra: (e) => !e.type || EXIT_TYPES.includes(e.type) }),
  ];
};

const cohortId = param('id').isMongoId().withMessage('Invalid cohort id');
const objectId = (name) => param(name).isMongoId().withMessage(`Invalid ${name}`);

// ---------- Incubator side ----------

const listCohorts = [
  query('status').optional().isIn(COHORT_STATUSES),
  query('program').optional().isMongoId(),
];

const changeStatus = [
  cohortId,
  body('status').isIn(COHORT_STATUSES).withMessage(`status must be one of: ${COHORT_STATUSES.join(', ')}`),
  body('graduateActive').optional().isBoolean().toBoolean(),
];

const listApplications = [cohortId, query('status').optional().isIn(APPLICATION_STATUSES)];

const reviewApplication = [
  objectId('applicationId'),
  body('status').isIn(['under_review', 'shortlisted', 'rejected']).withMessage('status must be under_review, shortlisted or rejected'),
  body('remarks').optional().isString().trim().isLength({ max: 2000 }),
  body('isEligible').optional().isBoolean().toBoolean(),
];

const enroll = [
  cohortId,
  body('applicationId').optional().isMongoId(),
  body('startupId').optional().isMongoId(),
  body().custom((b) => Boolean(b.applicationId) !== Boolean(b.startupId)).withMessage('Provide either applicationId or startupId'),
  body('mode').optional().isIn(['physical', 'virtual']),
];

const listEnrollments = [cohortId, query('status').optional().isIn(ENROLLMENT_STATUSES)];

const updateEnrollment = [
  objectId('enrollmentId'),
  body('mode').optional().isIn(['physical', 'virtual']),
  body('eligibility.isEligible').optional().isBoolean().toBoolean(),
  body('eligibility.notes').optional().isString().trim().isLength({ max: 2000 }),
];

const signAgreement = [
  objectId('enrollmentId'),
  body('acceptedConditions').optional().customSanitizer(toJson).isArray({ max: 50 }),
  body('equityPercent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
];

const checklistItem = [
  objectId('enrollmentId'),
  objectId('itemId'),
  body('isDone').isBoolean().withMessage('isDone must be true or false').toBoolean(),
];

const addMilestone = [
  objectId('enrollmentId'),
  body('title').isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
  body('dueDate').optional().isISO8601().toDate(),
];

// Startups can't mark their own milestones as missed
const milestoneUpdate = (allowed) => [
  objectId('enrollmentId'),
  objectId('milestoneId'),
  body('status').optional().isIn(allowed).withMessage(`status must be one of: ${allowed.join(', ')}`),
  body('evidenceUrl').optional({ values: 'falsy' }).isURL().withMessage('evidenceUrl must be a valid URL'),
  body('dueDate').optional().isISO8601().toDate(),
];

const exitEnrollment = [
  objectId('enrollmentId'),
  body('type').isIn(EXIT_TYPES).withMessage(`type must be one of: ${EXIT_TYPES.join(', ')}`),
  body('condition').optional().isString().trim().isLength({ max: 500 }),
  body('remarks').optional().isString().trim().isLength({ max: 2000 }),
  body('date').optional().isISO8601().toDate(),
];

const metric = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1-12').toInt(),
  body('year').isInt({ min: 2000, max: new Date().getFullYear() }).withMessage('year is invalid').toInt(),
  body().custom((b) => {
    const now = new Date();
    if (b.year * 100 + b.month > now.getFullYear() * 100 + now.getMonth() + 1) throw new Error('Cannot record metrics for a future month');
    return true;
  }),
  body(['revenue', 'expenses', 'customers', 'employees']).optional().isFloat({ min: 0 }).toFloat(),
  body('custom').optional().custom((c) => isPlainObject(c) && Object.values(c).every((v) => Number.isFinite(Number(v))))
    .withMessage('custom must be an object of numbers, e.g. { "MAU": 1200 }'),
];

const metricsRange = [
  query(['fromMonth', 'toMonth']).optional().isInt({ min: 1, max: 12 }).toInt(),
  query(['fromYear', 'toYear']).optional().isInt({ min: 2000 }).toInt(),
];

// ---------- Startup side ----------

const browseCohorts = [
  query('sector').optional().isIn(SECTORS),
  query('incubator').optional().isMongoId(),
];

const apply = [
  cohortId,
  body('responses').optional().custom(isPlainObject).withMessage('responses must be an object { fieldKey: value }'),
  body('source').optional().isIn(ACQUISITION_SOURCES),
];

module.exports = {
  createCohort: cohortFields(true),
  updateCohort: [cohortId, ...cohortFields(false)],
  cohortId: [cohortId],
  listCohorts,
  changeStatus,
  listApplications,
  applicationId: [objectId('applicationId')],
  reviewApplication,
  enroll,
  listEnrollments,
  enrollmentId: [objectId('enrollmentId')],
  updateEnrollment,
  signAgreement,
  checklistItem,
  addMilestone,
  incubatorMilestone: milestoneUpdate(MILESTONE_STATUSES),
  startupMilestone: milestoneUpdate(['pending', 'in_progress', 'completed']),
  exitEnrollment,
  enrollmentMetric: [objectId('enrollmentId'), ...metric],
  startupMetric: metric,
  metricsRange,
  browseCohorts,
  apply,
};
