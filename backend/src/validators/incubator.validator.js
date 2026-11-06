const { body, param, query } = require('express-validator');
const { SECTORS, ACCESSIBILITY_TYPES } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');
const { normalizePhone } = require('../utils/phone');

const INCUBATOR_TYPES = ['academic', 'government', 'corporate', 'private', 'ngo', 'other'];

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// isCreate=true -> registration (required fields); false -> PATCH
const incubatorFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('type')).isIn(INCUBATOR_TYPES).withMessage(`type must be one of: ${INCUBATOR_TYPES.join(', ')}`),
    req(body('email')).trim().toLowerCase().isEmail().withMessage('valid email is required'),
    req(body('phone')).custom((v) => Boolean(normalizePhone(v))).withMessage('valid phone is required')
      .customSanitizer(normalizePhone),

    body('about').optional().isString().trim().isLength({ max: 5000 }),
    body('hostInstitution').optional().isString().trim().isLength({ max: 200 }),
    body('establishedYear').optional().isInt({ min: 1900, max: new Date().getFullYear() }).toInt(),
    body('sectorsFocused').optional().customSanitizer(toArray)
      .custom((arr) => arr.every((v) => SECTORS.includes(v)))
      .withMessage(`sectorsFocused values must be from: ${SECTORS.join(', ')}`),
    body('website').optional({ values: 'falsy' }).isURL().withMessage('website must be a valid URL'),
    body('address').optional().customSanitizer(toJson).custom(isPlainObject).withMessage('address must be an object'),
    body(['address.line1', 'address.city', 'address.state', 'address.country']).optional().isString().trim().isLength({ max: 200 }),
    body('address.pincode').optional().matches(/^\d{6}$/).withMessage('pincode must be 6 digits'),
  ];
};

const registerIncubator = incubatorFields(true);
const updateIncubator = incubatorFields(false);

const inviteMember = [
  body('name').isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
  body('email').trim().toLowerCase().isEmail().withMessage('valid email is required'),
];

const memberId = [param('memberId').isMongoId().withMessage('Invalid member id')];

// ---------- Profile sections (embedded arrays) ----------

const itemId = param('itemId').isMongoId().withMessage('Invalid item id');

const sectionFields = {
  services: (isCreate) => {
    const req = (chain) => (isCreate ? chain : chain.optional());
    return [
      req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
      body('description').optional().isString().trim().isLength({ max: 2000 }),
      body('isPaid').optional().isBoolean().toBoolean(),
    ];
  },
  policies: (isCreate) => {
    const req = (chain) => (isCreate ? chain : chain.optional());
    return [
      req(body('title')).isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
      body('description').optional().isString().trim().isLength({ max: 5000 }),
    ];
  },
  accessibilities: (isCreate) => {
    const req = (chain) => (isCreate ? chain : chain.optional());
    return [
      req(body('type')).isIn(ACCESSIBILITY_TYPES).withMessage(`type must be one of: ${ACCESSIBILITY_TYPES.join(', ')}`),
      req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
      body('description').optional().isString().trim().isLength({ max: 2000 }),
      body('isAvailable').optional().isBoolean().toBoolean(),
    ];
  },
};

const sectionValidators = Object.fromEntries(Object.entries(sectionFields).map(([section, fields]) => [section, {
  create: fields(true),
  update: [itemId, ...fields(false)],
  remove: [itemId],
}]));

// ---------- Public directory ----------

const listIncubators = [
  query('sector').optional().isIn(SECTORS),
  query('type').optional().isIn(INCUBATOR_TYPES),
  query(['city', 'state', 'q']).optional().isString().trim().isLength({ max: 100 }),
];

const incubatorId = [
  param('id').isMongoId().withMessage('Invalid incubator id'),
  query('source').optional().isString().trim(),
];

module.exports = {
  registerIncubator,
  updateIncubator,
  inviteMember,
  memberId,
  sectionValidators,
  listIncubators,
  incubatorId,
};
