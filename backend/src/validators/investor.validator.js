const { body, param, query } = require('express-validator');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');
const { toArray } = require('../utils/multipart');

const INVESTOR_TYPES = ['angel', 'angel_network', 'vc', 'micro_vc', 'corporate_vc', 'family_office', 'government', 'other'];
const CONNECTION_STATUSES = ['requested', 'in_review', 'meeting_scheduled', 'in_discussion', 'invested', 'declined'];

const investorFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('type')).isIn(INVESTOR_TYPES).withMessage(`type must be one of: ${INVESTOR_TYPES.join(', ')}`),
    body('firm').optional().isString().trim().isLength({ max: 150 }),
    body('about').optional().isString().trim().isLength({ max: 3000 }),
    body('sectors').optional().customSanitizer(toArray)
      .custom((a) => a.every((v) => SECTORS.includes(v))).withMessage(`sectors values must be from: ${SECTORS.join(', ')}`),
    body('stages').optional().customSanitizer(toArray)
      .custom((a) => a.every((v) => STARTUP_STAGES.includes(v))).withMessage(`stages values must be from: ${STARTUP_STAGES.join(', ')}`),
    body(['ticketSize.min', 'ticketSize.max']).optional().isFloat({ min: 0 }).toFloat(),
    body('ticketSize').optional().custom((t) => t.min === undefined || t.max === undefined || t.min <= t.max)
      .withMessage('ticketSize.min cannot be greater than ticketSize.max'),
    body('location').optional().isString().trim().isLength({ max: 150 }),
    body('email').optional({ values: 'falsy' }).trim().toLowerCase().isEmail(),
    body(['website', 'linkedin', 'logo']).optional({ values: 'falsy' }).isURL(),
    body('portfolio').optional().customSanitizer(toArray).isArray({ max: 100 }),
    body('isActive').optional().isBoolean().toBoolean(),
  ];
};

const investorId = param('id').isMongoId().withMessage('Invalid investor id');
const connectionId = param('connectionId').isMongoId().withMessage('Invalid connection id');

module.exports = {
  createInvestor: investorFields(true),
  updateInvestor: [investorId, ...investorFields(false)],
  investorId: [investorId],
  listInvestors: [
    query('sector').optional().isIn(SECTORS),
    query('stage').optional().isIn(STARTUP_STAGES),
    query('type').optional().isIn(INVESTOR_TYPES),
    query('amount').optional().isFloat({ min: 0 }).toFloat(), // investors whose ticket range covers this
    query('q').optional().isString().trim().isLength({ max: 100 }),
  ],
  connect: [
    investorId,
    body('message').optional().isString().trim().isLength({ max: 2000 }),
    body('pitchDeckUrl').optional({ values: 'falsy' }).isURL(),
    body('amountSought').optional().isFloat({ min: 0 }).toFloat(),
  ],
  listConnections: [query('status').optional().isIn(CONNECTION_STATUSES)],
  updateConnection: [
    connectionId,
    body('status').optional().isIn(CONNECTION_STATUSES),
    body('notes').optional().isString().trim().isLength({ max: 5000 }),
  ],
  connectionId: [connectionId],
};
