const { body, param, query } = require('express-validator');

const EVENT_TYPES = ['workshop', 'webinar', 'demo_day', 'hackathon', 'networking', 'bootcamp', 'pitch_event', 'other'];
const EVENT_STATUSES = ['draft', 'published', 'completed', 'cancelled'];

const eventFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('title')).isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
    req(body('type')).isIn(EVENT_TYPES).withMessage(`type must be one of: ${EVENT_TYPES.join(', ')}`),
    req(body('startsAt')).isISO8601().withMessage('startsAt must be a date-time').toDate(),
    req(body('endsAt')).isISO8601().withMessage('endsAt must be a date-time').toDate()
      .custom((end, { req: r }) => !r.body.startsAt || new Date(end) > new Date(r.body.startsAt))
      .withMessage('endsAt must be after startsAt'),
    body('description').optional().isString().trim().isLength({ max: 10000 }),
    body('mode').optional().isIn(['online', 'offline', 'hybrid']),
    body('venue').optional().isString().trim().isLength({ max: 300 }),
    body('meetingLink').optional({ values: 'falsy' }).isURL().withMessage('meetingLink must be a valid URL'),
    body('capacity').optional({ values: 'null' }).isInt({ min: 1, max: 100000 }).toInt(),
    body('visibility').optional().isIn(['public', 'incubator_only', 'cohort_only']),
    body('cohort').optional({ values: 'null' }).isMongoId().withMessage('Invalid cohort id'),
  ];
};

const eventId = param('id').isMongoId().withMessage('Invalid event id');

module.exports = {
  createEvent: eventFields(true),
  updateEvent: [eventId, ...eventFields(false)],
  eventId: [eventId],
  listEvents: [
    query('type').optional().isIn(EVENT_TYPES),
    query('mode').optional().isIn(['online', 'offline', 'hybrid']),
    query('incubator').optional().isMongoId(),
    query(['from', 'to']).optional().isISO8601().toDate(),
    query('past').optional().isBoolean().toBoolean(),
  ],
  listMine: [query('status').optional().isIn(EVENT_STATUSES)],
  changeStatus: [eventId, body('status').isIn(['published', 'completed', 'cancelled']).withMessage('status must be published, completed or cancelled')],
  markAttendance: [
    eventId,
    param('registrationId').isMongoId(),
    body('status').isIn(['attended', 'no_show']).withMessage('status must be attended or no_show'),
  ],
};
