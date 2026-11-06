const { body, param, query } = require('express-validator');
const { ROLES } = require('../utils/constants');
const grantValidators = require('./grant.validator');

const EXTERNAL_PROVIDER_TYPES = ['government', 'corporate', 'foundation', 'other'];

const id = param('id').isMongoId().withMessage('Invalid id');
const q = query('q').optional().isString().trim().isLength({ max: 100 });

module.exports = {
  id: [id],

  listIncubators: [q, query('status').optional().isIn(['pending', 'active', 'suspended']), query('verified').optional().isBoolean().toBoolean()],
  updateIncubator: [
    id,
    body('isVerified').optional().isBoolean().toBoolean(),
    body('status').optional().isIn(['pending', 'active', 'suspended']),
    body('units').optional().isInt({ min: 1, max: 100 }).withMessage('units must be 1-100').toInt(),
  ],

  listMentors: [q, query('verified').optional().isBoolean().toBoolean()],
  verifyMentor: [id, body('isVerified').isBoolean().withMessage('isVerified is required').toBoolean()],

  listUsers: [q, query('role').optional().isIn(ROLES), query('status').optional().isIn(['invited', 'active', 'suspended'])],
  setUserStatus: [id, body('status').isIn(['active', 'suspended']).withMessage('status must be active or suspended')],

  listStartups: [q],

  listGrants: [query('status').optional().isIn(['upcoming', 'open', 'closed']), query('providerType').optional().isIn([...EXTERNAL_PROVIDER_TYPES, 'incubator'])],
  createGrant: [
    body('provider').isString().withMessage('provider is required').bail().trim().notEmpty().withMessage('provider is required')
      .isLength({ max: 200 }),
    body('providerType').isIn(EXTERNAL_PROVIDER_TYPES).withMessage(`providerType must be one of: ${EXTERNAL_PROVIDER_TYPES.join(', ')}`),
    ...grantValidators.createGrant,
  ],
  updateGrant: [
    body('provider').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('providerType').optional().isIn(EXTERNAL_PROVIDER_TYPES).withMessage(`providerType must be one of: ${EXTERNAL_PROVIDER_TYPES.join(', ')}`),
    ...grantValidators.updateGrant,
  ],

  setInvestorActive: [id, body('isActive').isBoolean().withMessage('isActive is required').toBoolean()],
};
