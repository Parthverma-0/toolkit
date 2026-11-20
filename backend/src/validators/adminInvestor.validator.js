const { body, param, query } = require('express-validator');
const O = require('../utils/investorOptions');

const id = param('id').isMongoId().withMessage('Invalid id');

const filters = [
  query('status').optional().isIn(O.VERIFICATION_STATUSES),
  query('type').optional().isIn(O.INVESTOR_TYPES),
  query('category').optional().isIn(O.INVESTOR_CATEGORIES),
  query('sector').optional().isString().trim().isLength({ max: 60 }),
  query('featured').optional().isBoolean().toBoolean(),
  query('q').optional().isString().trim().isLength({ max: 100 }),
];

module.exports = {
  list: filters,
  id: [id],
  document: [id, param('docId').isMongoId().withMessage('Invalid document id')],
  setVerification: [
    id,
    body('status').isIn(O.VERIFICATION_STATUSES).withMessage(`status must be one of: ${O.VERIFICATION_STATUSES.join(', ')}`),
    body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
    // The investor reads this, so a rejection or a request for more information has to say why
    body('note').custom((value, { req }) => !['rejected', 'info_required'].includes(req.body.status) || Boolean(value))
      .withMessage('Add a note so the investor knows what to fix'),
  ],
  setFeatured: [id, body('isFeatured').isBoolean().withMessage('isFeatured is required').toBoolean()],
  listConnections: [query('status').optional().isIn(O.CONNECTION_STATUSES)],
  listReports: [query('status').optional().isIn(['open', 'resolved', 'dismissed'])],
  resolveReport: [
    id,
    body('status').isIn(['resolved', 'dismissed']).withMessage('status must be resolved or dismissed'),
    body('resolution').optional().isString().trim().isLength({ max: 1000 }),
  ],
  announce: [
    body('title').isString().withMessage('Add a title').bail().trim().notEmpty().withMessage('Add a title').isLength({ max: 160 }),
    body('body').optional().isString().trim().isLength({ max: 500 }),
  ],
};
