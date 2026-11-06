const { body, param, query } = require('express-validator');
const {
  FUNDING_TYPES, FUNDING_INSTRUMENTS, SECTORS, STARTUP_STAGES, ACQUISITION_SOURCES,
} = require('../utils/constants');
const { toArray } = require('../utils/multipart');

const ROUNDS = ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus', 'bridge', 'na'];
const ACHIEVEMENT_TYPES = ['award', 'patent', 'trademark', 'funding', 'product_launch', 'revenue_milestone', 'media', 'partnership', 'other'];

const notInFuture = (d) => {
  if (new Date(d) > new Date()) throw new Error('date cannot be in the future');
  return true;
};
const id = (name) => param(name).isMongoId().withMessage(`Invalid ${name}`);
const range = [query(['from', 'to']).optional().isISO8601().toDate()];

// ---------- Funding ----------
const fundingFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('type')).isIn(FUNDING_TYPES).withMessage(`type must be one of: ${FUNDING_TYPES.join(', ')}`),
    req(body('instrument')).isIn(FUNDING_INSTRUMENTS).withMessage(`instrument must be one of: ${FUNDING_INSTRUMENTS.join(', ')}`),
    req(body('amount')).isFloat({ gt: 0 }).withMessage('amount must be greater than 0').toFloat(),
    req(body('date')).isISO8601().withMessage('date is required').custom(notInFuture).toDate(),
    body(['startup', 'cohort', 'program', 'grant', 'investor']).optional({ values: 'null' }).isMongoId(),
    body('source').optional().isString().trim().isLength({ max: 200 }),
    body('round').optional().isIn(ROUNDS),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).toUpperCase(),
    body('referenceNo').optional().isString().trim().isLength({ max: 100 }),
    body('notes').optional().isString().trim().isLength({ max: 2000 }),
  ];
};

// ---------- Achievements ----------
const achievementFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('type')).isIn(ACHIEVEMENT_TYPES).withMessage(`type must be one of: ${ACHIEVEMENT_TYPES.join(', ')}`),
    req(body('title')).isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
    req(body('date')).isISO8601().withMessage('date is required').custom(notInFuture).toDate(),
    body('description').optional().isString().trim().isLength({ max: 3000 }),
    body('proofUrl').optional({ values: 'falsy' }).isURL().withMessage('proofUrl must be a valid URL'),
  ];
};

// ---------- Campaigns ----------
const campaignFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('subject')).isString().withMessage('subject is required').bail().trim().notEmpty().withMessage('subject is required').isLength({ max: 200 }),
    req(body('bodyHtml')).isString().withMessage('bodyHtml is required').bail().notEmpty().withMessage('bodyHtml is required').isLength({ max: 100000 }),
    req(body('audience.type')).isIn(['cohort', 'startups', 'custom']).withMessage('audience.type must be cohort, startups or custom'),
    body('cohort').optional({ values: 'null' }).isMongoId(),
    body('audience.startups').optional().isArray({ max: 1000 }).custom((a) => a.every((v) => /^[a-f\d]{24}$/i.test(v)))
      .withMessage('audience.startups must be startup ids'),
    body('audience.emails').optional().customSanitizer(toArray).isArray({ max: 1000 })
      .custom((a) => a.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))).withMessage('audience.emails has an invalid email'),
  ];
};

module.exports = {
  summary: [...range, query('scope').optional().isIn(['active', 'all'])],
  funnel: [...range, query('cohort').optional().isMongoId(), query('source').optional().isIn(ACQUISITION_SOURCES)],
  revenue: [...range, query('scope').optional().isIn(['active', 'all']), query('cohort').optional().isMongoId()],

  startupDatabase: [
    query(['cohort', 'program']).optional().isMongoId(),
    query('status').optional().isIn(['active', 'graduated', 'exited', 'dropped']),
    query(['onboardedFrom', 'onboardedTo']).optional().isISO8601().toDate(),
    query('fundingType').optional().isIn(['any', ...FUNDING_TYPES]),
    query('achievementType').optional().isIn(['any', ...ACHIEVEMENT_TYPES]),
    query('sector').optional().isIn(SECTORS),
    query('stage').optional().isIn(STARTUP_STAGES),
    query('q').optional().isString().trim().isLength({ max: 100 }),
  ],
  startupId: [id('startupId')],

  createFunding: fundingFields(true),
  updateFunding: [id('id'), ...fundingFields(false)],
  listFunding: [...range, query('type').optional().isIn(FUNDING_TYPES), query('startup').optional().isMongoId()],
  fundingId: [id('id')],

  createAchievement: [body('startup').isMongoId().withMessage('startup is required'), ...achievementFields(true)],
  createMyAchievement: achievementFields(true),
  updateAchievement: [id('id'), ...achievementFields(false), body('isVerified').optional().isBoolean().toBoolean()],
  listAchievements: [
    query('startup').optional().isMongoId(),
    query('type').optional().isIn(ACHIEVEMENT_TYPES),
    query('verified').optional().isBoolean().toBoolean(),
  ],
  achievementId: [id('id')],

  createCampaign: campaignFields(true),
  updateCampaign: [id('id'), ...campaignFields(false)],
  listCampaigns: [query('status').optional().isIn(['draft', 'scheduled', 'sending', 'sent', 'failed'])],
  campaignId: [id('id')],
  scheduleCampaign: [
    id('id'),
    body('scheduledAt').isISO8601().withMessage('scheduledAt must be a date-time').bail().toDate()
      .custom((d) => {
        const ms = d.getTime() - Date.now();
        if (ms < 60 * 1000) throw new Error('scheduledAt must be at least 1 minute from now');
        if (ms > 180 * 24 * 3600 * 1000) throw new Error('scheduledAt must be within 180 days');
        return true;
      }),
  ],
};
