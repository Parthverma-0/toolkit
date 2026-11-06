const { body, param, query } = require('express-validator');
const { SECTORS } = require('../utils/constants');
const { toArray, toJson } = require('../utils/multipart');

const PROGRAM_TYPES = ['pre_incubation', 'incubation', 'acceleration', 'virtual_incubation', 'other'];

const programFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('name')).isString().withMessage('name is required').bail().trim().notEmpty().withMessage('name is required').isLength({ max: 150 }),
    req(body('type')).isIn(PROGRAM_TYPES).withMessage(`type must be one of: ${PROGRAM_TYPES.join(', ')}`),
    body('description').optional().isString().trim().isLength({ max: 5000 }),
    body('durationMonths').optional().isInt({ min: 1, max: 60 }).toInt(),
    body('sectors').optional().customSanitizer(toArray)
      .custom((arr) => arr.every((v) => SECTORS.includes(v)))
      .withMessage(`sectors values must be from: ${SECTORS.join(', ')}`),
    body('benefits').optional().customSanitizer(toArray).isArray({ max: 30 }),
    body('fundingSupport').optional().customSanitizer(toJson)
      .custom((v) => v && typeof v === 'object' && !Array.isArray(v)).withMessage('fundingSupport must be an object'),
    body('fundingSupport.available').optional().isBoolean().toBoolean(),
    body('fundingSupport.maxAmount').optional().isFloat({ min: 0 }).toFloat(),
    body('fundingAgency').optional().isString().trim().isLength({ max: 150 }),
    body('status').optional().isIn(['active', 'inactive']),
  ];
};

const programId = param('id').isMongoId().withMessage('Invalid program id');

module.exports = {
  createProgram: programFields(true),
  updateProgram: [programId, ...programFields(false)],
  programId: [programId],
  listPrograms: [query('status').optional().isIn(['active', 'inactive'])],
};
