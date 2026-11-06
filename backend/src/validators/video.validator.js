const { body, query, param } = require('express-validator');
const { VIDEO_CATEGORIES } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');

const STATUSES = ['draft', 'published', 'archived'];

const videoFields = [
  body('description').optional().isString().trim().isLength({ max: 5000 }),
  body('tags').optional().customSanitizer((v) => toArray(v).map((t) => String(t).toLowerCase()))
    .custom((arr) => arr.length <= 15).withMessage('max 15 tags'),
  body('status').optional().isIn(STATUSES),
  body('durationSeconds').optional().isInt({ min: 0 }).toInt(),
  body('externalUrl').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('externalUrl must be an https link (YouTube, Vimeo, Drive...)'),
  body('resources').optional().customSanitizer(toJson)
    .isArray({ max: 10 }).withMessage('resources must be an array (max 10)')
    .custom((arr) => arr.every((r) => r && r.name && /^https?:\/\//.test(r.url)))
    .withMessage('each resource needs name and url'),
];

const createVideo = [
  body('title').isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required').isLength({ max: 200 }),
  body('category').isIn(VIDEO_CATEGORIES).withMessage(`category must be one of: ${VIDEO_CATEGORIES.join(', ')}`),
  ...videoFields,
];

const updateVideo = [
  param('id').isMongoId(),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('category').optional().isIn(VIDEO_CATEGORIES),
  ...videoFields,
];

const listVideos = [
  query('category').optional().isIn(VIDEO_CATEGORIES),
  query('mentor').optional().isMongoId(),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('sort').optional().isIn(['latest', 'popular', 'most_liked']),
];

const listMine = [query('status').optional().isIn(STATUSES)];

const videoId = [param('id').isMongoId().withMessage('Invalid video id')];

module.exports = { createVideo, updateVideo, listVideos, listMine, videoId };
