const { body, query, param } = require('express-validator');
const { SECTORS, VIDEO_CATEGORIES } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const upsertProfile = [
  body('designation').optional().isString().trim().isLength({ max: 100 }),
  body('organization').optional().isString().trim().isLength({ max: 150 }),
  body('bio').optional().isString().trim().isLength({ max: 2000 }),
  body('yearsOfExperience').optional().isInt({ min: 0, max: 70 }).toInt(),
  body('expertise').optional().customSanitizer(toArray)
    .custom((arr) => arr.every((v) => VIDEO_CATEGORIES.includes(v)))
    .withMessage(`expertise values must be from: ${VIDEO_CATEGORIES.join(', ')}`),
  body('sectors').optional().customSanitizer(toArray)
    .custom((arr) => arr.every((v) => SECTORS.includes(v)))
    .withMessage(`sectors values must be from: ${SECTORS.join(', ')}`),
  body(['linkedin', 'website']).optional({ values: 'falsy' }).isURL().withMessage('must be a valid URL'),
  body('availability').optional().customSanitizer(toJson)
    .isArray().withMessage('availability must be an array')
    .custom((slots) => slots.every((s) => DAYS.includes(s.day) && TIME.test(s.from) && TIME.test(s.to) && s.from < s.to))
    .withMessage('each slot needs day (mon..sun), from and to as HH:mm with from < to'),
];

const listMentors = [
  query('expertise').optional().isIn(VIDEO_CATEGORIES),
  query('sector').optional().isIn(SECTORS),
  query('q').optional().isString().trim().isLength({ max: 100 }),
];

const mentorId = [param('id').isMongoId().withMessage('Invalid mentor id')];

module.exports = { upsertProfile, listMentors, mentorId };
