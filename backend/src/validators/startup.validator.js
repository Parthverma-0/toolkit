const { body, param } = require('express-validator');
const {
  SECTORS, STARTUP_STAGES, CIN_REGEX, DPIIT_REGEX,
} = require('../utils/constants');
const { toJson } = require('../utils/multipart');
const { normalizePhone } = require('../utils/phone');

const notInFuture = (value) => {
  if (new Date(value) > new Date()) throw new Error('date cannot be in the future');
  return true;
};

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// isCreate=true -> mandatory fields required; false -> everything optional (PATCH)
const startupFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('startupEmail')).trim().toLowerCase().isEmail().withMessage('valid startupEmail is required'),
    req(body('cin')).isString().trim().toUpperCase()
      .matches(CIN_REGEX).withMessage('CIN must be 21 characters, e.g. U72900KA2021PTC123456'),
    req(body('dpiitNumber')).isString().trim().toUpperCase()
      .matches(DPIIT_REGEX).withMessage('DPIIT number must look like DIPP123456'),
    req(body('sector')).isIn(SECTORS).withMessage(`sector must be one of: ${SECTORS.join(', ')}`),
    req(body('stage')).isIn(STARTUP_STAGES).withMessage(`stage must be one of: ${STARTUP_STAGES.join(', ')}`),

    body(['problemStatement', 'solution']).optional().isString().trim().isLength({ max: 3000 }),
    body('tagline').optional().isString().trim().isLength({ max: 160 }),
    body('website').optional({ values: 'falsy' }).isURL().withMessage('website must be a valid URL'),
    body('foundedOn').optional().isISO8601().withMessage('foundedOn must be a date (YYYY-MM-DD)').custom(notInFuture).toDate(),
    body('teamSize').optional().isInt({ min: 1, max: 100000 }).toInt(),
    body('address').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('address must be an object'),
    body(['address.city', 'address.state', 'address.country']).optional().isString().trim().isLength({ max: 100 }),
    body('address.pincode').optional().matches(/^\d{6}$/).withMessage('pincode must be 6 digits'),
    body('socialLinks').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('socialLinks must be an object'),
    body(['socialLinks.linkedin', 'socialLinks.twitter', 'socialLinks.instagram']).optional({ values: 'falsy' }).isURL(),
  ];
};

const createStartup = startupFields(true);
const updateStartup = startupFields(false);

// ---------- Founders ----------

const founderOptionalFields = [
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('dateOfBirth').optional().isISO8601().custom(notInFuture).toDate(),
  body('linkedin').optional({ values: 'falsy' }).isURL().withMessage('linkedin must be a valid URL'),
  body('equityPercent').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('education').optional().customSanitizer(toJson).isArray({ max: 10 })
    .custom((arr) => arr.every((e) => e && e.degree && e.institution))
    .withMessage('each education entry needs degree and institution'),
  body('experience').optional().customSanitizer(toJson).isArray({ max: 20 })
    .custom((arr) => arr.every((e) => e && e.role && e.company))
    .withMessage('each experience entry needs role and company'),
];

const phoneField = (chain) => chain
  .custom((v) => Boolean(normalizePhone(v))).withMessage('Invalid phone number')
  .customSanitizer(normalizePhone);

// Primary founder = the logged-in user; email comes from the account, phone is optional
// here only because an earlier save may already have stored it (controller requires one overall)
const upsertPrimaryFounder = [
  body('fullName').isString().withMessage('fullName is required').bail().trim().notEmpty().withMessage('fullName is required').isLength({ max: 100 }),
  body('designation').isString().withMessage('designation is required').bail().trim().notEmpty().withMessage('designation is required').isLength({ max: 60 }),
  phoneField(body('phone').optional()),
  ...founderOptionalFields,
];

const addCoFounder = [
  body('fullName').isString().withMessage('fullName is required').bail().trim().notEmpty().withMessage('fullName is required').isLength({ max: 100 }),
  body('designation').isString().withMessage('designation is required').bail().trim().notEmpty().withMessage('designation is required').isLength({ max: 60 }),
  body('email').trim().toLowerCase().isEmail().withMessage('valid email is required'),
  phoneField(body('phone').exists().withMessage('phone is required')),
  ...founderOptionalFields,
];

const updateFounder = [
  param('id').isMongoId().withMessage('Invalid founder id'),
  body('fullName').optional().isString().trim().notEmpty().isLength({ max: 100 }),
  body('designation').optional().isString().trim().notEmpty().isLength({ max: 60 }),
  body('email').optional().trim().toLowerCase().isEmail().withMessage('valid email is required'),
  phoneField(body('phone').optional()),
  ...founderOptionalFields,
];

const founderId = [param('id').isMongoId().withMessage('Invalid founder id')];

module.exports = {
  createStartup, updateStartup, upsertPrimaryFounder, addCoFounder, updateFounder, founderId,
};
