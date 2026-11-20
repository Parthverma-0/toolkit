const { body, param, query } = require('express-validator');
const O = require('../utils/investorOptions');

const mongoId = (name, label) => param(name).isMongoId().withMessage(`Invalid ${label} id`);

module.exports = {
  listConnections: [
    query('box').optional().isIn(['all', 'sent', 'received']),
    query('status').optional().isIn(O.CONNECTION_STATUSES),
  ],
  createConnection: [
    body('startupId').optional().isMongoId().withMessage('Invalid startup id'),
    body('investorId').optional().isMongoId().withMessage('Invalid investor id'),
    body().custom((b) => Boolean(b.startupId) !== Boolean(b.investorId)).withMessage('Send either startupId (investors) or investorId (founders)'),
    body('message').optional().isString().trim().isLength({ max: 2000 }),
  ],
  respond: [
    mongoId('id', 'connection'),
    body('action').isIn(['accept', 'decline', 'withdraw']).withMessage('action must be accept, decline or withdraw'),
  ],
  connectionId: [mongoId('id', 'connection')],
  sendMessage: [
    mongoId('id', 'connection'),
    body('body').isString().withMessage('Write a message').bail().trim().notEmpty().withMessage('Write a message').isLength({ max: 2000 }),
  ],
  listNotifications: [
    query('unread').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  markRead: [body('ids').optional().isArray({ max: 200 }), body('ids.*').optional().isMongoId()],

  // Founders browsing registered investors
  listInvestors: [
    query('q').optional().isString().trim().isLength({ max: 100 }),
    query('type').optional().isIn(O.INVESTOR_TYPES),
    query('category').optional().isIn(O.INVESTOR_CATEGORIES),
    query('sector').optional().isString().trim().isLength({ max: 60 }),
    query('stage').optional().isIn(O.INVESTOR_STAGES),
    query('ticket').optional().isIn(Object.keys(O.TICKET_SIZES)),
    query('location').optional().isString().trim().isLength({ max: 60 }),
    query('featured').optional().isBoolean().toBoolean(),
  ],
  investorId: [mongoId('id', 'investor')],
  report: [
    mongoId('id', 'investor'),
    body('reason').isIn(O.REPORT_REASONS).withMessage(`reason must be one of: ${O.REPORT_REASONS.join(', ')}`),
    body('details').optional().isString().trim().isLength({ max: 2000 }),
  ],
};
