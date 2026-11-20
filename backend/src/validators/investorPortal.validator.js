const { body, param, query } = require('express-validator');
const O = require('../utils/investorOptions');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');
const { normalizePhone } = require('../utils/phone');

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const oneOf = (list) => (arr) => arr.every((v) => list.includes(v));

// Multipart forms send arrays as JSON strings; `allowed` limits the values, `custom` allows free text too
const list = (name, { allowed, max = 30 } = {}) => {
  let chain = body(name).optional().customSanitizer(toArray)
    .isArray({ max }).withMessage(`${name} can have at most ${max} entries`)
    .custom((arr) => arr.every((v) => typeof v === 'string' && v.length <= 60)).withMessage(`${name} entries must be short text`);
  if (allowed) chain = chain.custom(oneOf(allowed)).withMessage(`${name} has an unknown option`);
  return chain;
};

const bool = (name) => body(name).optional().isBoolean().toBoolean();
const url = (name) => body(name).optional({ values: 'falsy' }).isURL().withMessage(`${name} must be a valid URL`);
const text = (name, max) => body(name).optional().isString().trim().isLength({ max }).withMessage(`${name} is too long`);

const profile = [
  body('fullName').optional().isString().trim().isLength({ min: 2, max: 100 }).withMessage('Enter your full name'),
  body('phone').optional({ values: 'falsy' })
    .custom((v) => Boolean(normalizePhone(v))).withMessage('Enter a valid mobile number')
    .customSanitizer(normalizePhone),
  body('contactEmail').optional({ values: 'falsy' }).trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
  text('designation', 100),
  url('linkedin'),
  text('location', 100),
  text('country', 80),

  body('investorType').optional().isIn(O.INVESTOR_TYPES).withMessage('Choose an investor type'),
  body('category').optional().isIn(O.INVESTOR_CATEGORIES).withMessage('Choose an investor category'),
  text('organisationName', 150),
  url('organisationWebsite'),
  url('organisationLinkedin'),
  body('yearEstablished').optional({ values: 'falsy' }).isInt({ min: 1800, max: new Date().getFullYear() }).withMessage('Enter a valid year').toInt(),
  text('headOffice', 150),

  list('sectors'),
  list('stages', { allowed: O.INVESTOR_STAGES }),
  list('ticketSizes', { allowed: Object.keys(O.TICKET_SIZES) }),
  body('customTicket').optional({ values: 'falsy' }).customSanitizer(toJson).custom(isPlainObject).withMessage('customTicket must be an object'),
  body(['customTicket.min', 'customTicket.max']).optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Enter a valid amount').toFloat(),
  body('customTicket').optional({ values: 'falsy' })
    .custom((t) => !t || t.min == null || t.max == null || t.min <= t.max).withMessage('Minimum ticket size cannot be more than the maximum'),
  list('locations'),
  list('businessModels', { allowed: O.BUSINESS_MODELS }),
  list('revenuePreferences', { allowed: O.REVENUE_PREFERENCES }),
  list('approaches', { allowed: O.INVESTMENT_APPROACHES }),
  body('frequency').optional({ values: 'falsy' }).isIn(O.INVESTMENT_FREQUENCIES),
  list('equityRanges', { allowed: O.EQUITY_RANGES }),

  text('professionalBackground', 3000),
  body('yearsOfExperience').optional({ values: 'falsy' }).isInt({ min: 0, max: 80 }).toInt(),
  body('previousInvestments').optional({ values: 'falsy' }).isInt({ min: 0 }).toInt(),
  body('portfolio').optional().customSanitizer(toJson).isArray({ max: 100 }).withMessage('portfolio must be a list (max 100)')
    .custom((arr) => arr.every((p) => p && typeof p.name === 'string' && p.name.trim())).withMessage('Each portfolio company needs a name'),
  list('expertise', { max: 20 }),
  bool('mentorshipAvailable'),
  bool('strategicSupport'),
  bool('networkingSupport'),
  text('bio', 2000),
];

const settings = [
  body('visibility').optional().isIn(O.VISIBILITIES),
  bool('showTicketSize'),
  body('notificationPrefs').optional().custom(isPlainObject),
  body(['notificationPrefs.connections', 'notificationPrefs.messages', 'notificationPrefs.matches', 'notificationPrefs.announcements'])
    .optional().isBoolean().toBoolean(),
];

const docId = param('docId').isMongoId().withMessage('Invalid document id');
const startupId = param('startupId').isMongoId().withMessage('Invalid startup id');
const csv = (name, allowed) => query(name).optional().customSanitizer(toArray)
  .custom((arr) => !allowed || arr.every((v) => allowed.includes(v))).withMessage(`${name} has an unknown value`);

const discover = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  csv('sector', SECTORS),
  csv('stage', STARTUP_STAGES),
  csv('businessModel', O.BUSINESS_MODELS),
  csv('revenueStatus', O.REVENUE_PREFERENCES),
  csv('fundingStatus', O.FUNDING_STATUSES),
  query('location').optional().isString().trim().isLength({ max: 100 }),
  query('incubated').optional().isBoolean().toBoolean(),
  query('fundingMin').optional().isFloat({ min: 0 }).toFloat(),
  query('fundingMax').optional().isFloat({ min: 0 }).toFloat(),
  query('ageMin').optional().isFloat({ min: 0 }).toFloat(),
  query('ageMax').optional().isFloat({ min: 0 }).toFloat(),
  query('sort').optional().isIn(['newest', 'match']),
  query('minScore').optional().isInt({ min: 0, max: 100 }).toInt(),
];

module.exports = {
  profile,
  settings,
  discover,
  startupId: [startupId],
  document: [
    body('type').isIn(O.DOCUMENT_TYPES).withMessage(`type must be one of: ${O.DOCUMENT_TYPES.join(', ')}`),
    text('name', 200),
  ],
  docId: [docId],
  shortlist: [startupId, body('note').optional().isString().trim().isLength({ max: 3000 })],
  deactivate: [body('confirm').equals('true').withMessage('Confirm the deactivation')],
};
