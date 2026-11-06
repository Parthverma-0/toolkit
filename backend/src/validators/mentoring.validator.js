const { body, param, query } = require('express-validator');

const SESSION_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled', 'rejected'];

const sessionId = param('id').isMongoId().withMessage('Invalid session id');

const requestSession = [
  body('mentor').isMongoId().withMessage('mentor (user id) is required'),
  body('topic').isString().withMessage('topic is required').bail().trim().notEmpty().withMessage('topic is required').isLength({ max: 200 }),
  body('agenda').optional().isString().trim().isLength({ max: 2000 }),
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be a date-time').toDate()
    .custom((d) => d > new Date(Date.now() + 60 * 60 * 1000)).withMessage('Book at least 1 hour in advance'),
  body('durationMinutes').optional().isInt({ min: 15, max: 180 }).withMessage('durationMinutes must be 15-180').toInt(),
  body('mode').optional().isIn(['online', 'offline']),
  body('location').optional().isString().trim().isLength({ max: 300 }),
];

const listSessions = [
  query('status').optional().isIn(SESSION_STATUSES),
  query('upcoming').optional().isBoolean().toBoolean(),
];

module.exports = {
  requestSession,
  listSessions,
  sessionId: [sessionId],
  confirm: [
    sessionId,
    body('meetingLink').optional({ values: 'falsy' }).isURL().withMessage('meetingLink must be a valid URL'),
    body('location').optional().isString().trim().isLength({ max: 300 }),
  ],
  reason: [sessionId, body('reason').optional().isString().trim().isLength({ max: 500 })],
  complete: [sessionId, body('mentorNotes').optional().isString().trim().isLength({ max: 5000 })],
  feedback: [
    sessionId,
    body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be 1-5').toInt(),
    body('comment').optional().isString().trim().isLength({ max: 2000 }),
  ],
};
