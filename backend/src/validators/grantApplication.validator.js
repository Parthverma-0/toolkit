const { body, param, query } = require('express-validator');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');

const APPLICATION_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed'];

const grantId = param('id').isMongoId().withMessage('Invalid grant id');
const applicationId = param('applicationId').isMongoId().withMessage('Invalid application id');

const applicationFields = [
  body('amountRequested').optional().isFloat({ min: 0 }).toFloat(),
  body('purpose').optional().isString().trim().isLength({ max: 5000 }),
  body('submit').optional().isBoolean().toBoolean(), // false/absent = save as draft
];

module.exports = {
  browseGrants: [
    query('status').optional().isIn(['upcoming', 'open', 'closed']),
    query('sector').optional().isIn(SECTORS),
    query('stage').optional().isIn(STARTUP_STAGES),
    query('providerType').optional().isIn(['government', 'incubator', 'corporate', 'foundation', 'other']),
    query('q').optional().isString().trim().isLength({ max: 100 }),
  ],
  grantId: [grantId],
  apply: [grantId, ...applicationFields],
  updateApplication: [
    applicationId,
    ...applicationFields,
    // For external grants the startup records the outcome itself
    body('status').optional().isIn(['approved', 'rejected', 'disbursed']),
    body('amountSanctioned').optional().isFloat({ min: 0 }).toFloat(),
  ],
  applicationId: [applicationId],
  listMine: [query('status').optional().isIn(APPLICATION_STATUSES)],
  // Incubators never see startups' drafts
  listForGrant: [grantId, query('status').optional().isIn(APPLICATION_STATUSES.filter((s) => s !== 'draft'))],
  review: [
    applicationId,
    body('status').isIn(['under_review', 'approved', 'rejected', 'disbursed']).withMessage('status must be under_review, approved, rejected or disbursed'),
    body('amountSanctioned').optional().isFloat({ min: 0 }).toFloat(),
    body('reviewerRemarks').optional().isString().trim().isLength({ max: 2000 }),
    body('referenceNo').optional().isString().trim().isLength({ max: 100 }),
  ],
};
