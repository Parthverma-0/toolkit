const { body, param, query } = require('express-validator');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');

const GRANT_STATUSES = ['upcoming', 'open', 'closed'];

const grantFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('title')).isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
    body('description').optional().isString().trim().isLength({ max: 5000 }),
    body('amount').optional().customSanitizer(toJson)
      .custom((v) => v && typeof v === 'object' && !Array.isArray(v)).withMessage('amount must be an object { min, max }'),
    body(['amount.min', 'amount.max']).optional().isFloat({ min: 0 }).toFloat(),
    body('amount').optional().custom((v) => v.min === undefined || v.max === undefined || v.min <= v.max)
      .withMessage('amount.min cannot be greater than amount.max'),
    body('eligibility').optional().customSanitizer(toArray).isArray({ max: 30 }),
    body('sectors').optional().customSanitizer(toArray)
      .custom((arr) => arr.every((v) => SECTORS.includes(v))).withMessage(`sectors values must be from: ${SECTORS.join(', ')}`),
    body('stages').optional().customSanitizer(toArray)
      .custom((arr) => arr.every((v) => STARTUP_STAGES.includes(v))).withMessage(`stages values must be from: ${STARTUP_STAGES.join(', ')}`),
    body('applicationUrl').optional({ values: 'falsy' }).isURL().withMessage('applicationUrl must be a valid URL'),
    body('opensAt').optional().isISO8601().toDate(),
    body('deadline').optional().isISO8601().toDate()
      .custom((deadline, { req: r }) => !r.body.opensAt || new Date(deadline) > new Date(r.body.opensAt))
      .withMessage('deadline must be after opensAt'),
    body('status').optional().isIn(GRANT_STATUSES),
  ];
};

const grantId = param('id').isMongoId().withMessage('Invalid grant id');

module.exports = {
  createGrant: grantFields(true),
  updateGrant: [grantId, ...grantFields(false)],
  grantId: [grantId],
  listGrants: [query('status').optional().isIn(GRANT_STATUSES)],
};
