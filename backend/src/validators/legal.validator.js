const { body, param, query } = require('express-validator');
const { REPORT_TYPES, COMPLIANCE_DOC_TYPES, FINANCIAL_CATEGORIES } = require('../utils/constants');
const { isValidFy } = require('../utils/financialYear');
const { GENERATED_TYPES } = require('../services/compliance.service');

// Reports, financial records and compliance documents (incubator legalities)

const id = (name) => param(name).isMongoId().withMessage(`Invalid ${name}`);
const optionalId = (location, names) => location(names).optional({ values: 'falsy' }).isMongoId().withMessage('Invalid id');

const fy = (chain) => chain.custom((v) => {
  if (!isValidFy(v)) throw new Error('financialYear must look like 2025-26');
  return true;
});

const notInFuture = (d) => {
  if (new Date(d) > new Date()) throw new Error('date cannot be in the future');
  return true;
};

const fromBeforeTo = (to, { req }) => {
  const from = req.body.from ?? req.body.period?.from;
  if (from && new Date(to) < new Date(from)) throw new Error('to must be on or after from');
  return true;
};

const oneOf = (list, name) => `${name} must be one of: ${list.join(', ')}`;

// ---------- Reports ----------
const createReport = [
  body('type').isIn(REPORT_TYPES).withMessage(oneOf(REPORT_TYPES, 'type')),
  body('format').optional().isIn(['government', 'internal']),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
  optionalId(body, ['cohort', 'program']),
  body('from').optional().isISO8601().withMessage('from must be a date').toDate(),
  body('to').optional().isISO8601().withMessage('to must be a date').custom(fromBeforeTo).toDate(),
  fy(body('financialYear').optional()),
];

const listReports = [
  query('type').optional().isIn(REPORT_TYPES),
  query('status').optional().isIn(['draft', 'generated', 'submitted']),
  fy(query('financialYear').optional()),
];

const submitReport = [
  id('id'),
  body('submittedTo').isString().withMessage('submittedTo is required').bail().trim().notEmpty().withMessage('submittedTo is required')
    .isLength({ max: 200 }),
  body('submittedAt').optional().isISO8601().custom(notInFuture).toDate(),
];

const downloadReport = [id('id'), query('fileType').optional().isIn(['pdf', 'xlsx']).withMessage('fileType must be pdf or xlsx')];

// ---------- Financial records ----------
const financialFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('entryType')).isIn(['income', 'expense']).withMessage('entryType must be income or expense'),
    req(body('category')).isIn(FINANCIAL_CATEGORIES).withMessage(oneOf(FINANCIAL_CATEGORIES, 'category')),
    req(body('amount')).isFloat({ gt: 0 }).withMessage('amount must be greater than 0').toFloat(),
    req(body('date')).isISO8601().withMessage('date is required').custom(notInFuture).toDate(),
    body('isInternal').optional().isBoolean().toBoolean(),
    body('currency').optional().isString().trim().isLength({ min: 3, max: 3 }).toUpperCase(),
    body('description').optional().isString().trim().isLength({ max: 1000 }),
    body('referenceNo').optional().isString().trim().isLength({ max: 100 }),
    body(['grant', 'program', 'startup']).optional({ values: 'null' }).isMongoId().withMessage('Invalid id'),
  ];
};

const listFinancialRecords = [
  fy(query('financialYear').optional()),
  query('entryType').optional().isIn(['income', 'expense']),
  query('category').optional().isIn(FINANCIAL_CATEGORIES),
  query('isInternal').optional().isBoolean().toBoolean(),
  optionalId(query, ['grant', 'program', 'startup']),
  query(['from', 'to']).optional().isISO8601().toDate(),
];

// ---------- Compliance documents ----------
const complianceFields = (isCreate) => {
  const req = (chain) => (isCreate ? chain : chain.optional());
  return [
    req(body('docType')).isIn(COMPLIANCE_DOC_TYPES).withMessage(oneOf(COMPLIANCE_DOC_TYPES, 'docType')),
    req(body('title')).isString().withMessage('title is required').bail().trim().notEmpty().withMessage('title is required')
      .isLength({ max: 200 }),
    fy(req(body('financialYear'))),
    body('period.from').optional().isISO8601().toDate(),
    body('period.to').optional().isISO8601().custom(fromBeforeTo).toDate(),
    body(['grant', 'program']).optional({ values: 'null' }).isMongoId().withMessage('Invalid id'),
    body(['amountSanctioned', 'amountUtilized']).optional().isFloat({ min: 0 }).toFloat(),
    body('status').optional().isIn(['draft', 'final', 'submitted', 'approved', 'rejected']),
    body('submittedTo').optional().isString().trim().isLength({ max: 200 }),
  ];
};

const generateCompliance = [
  body('docType').isIn(GENERATED_TYPES).withMessage(oneOf(GENERATED_TYPES, 'docType')),
  fy(body('financialYear')),
  optionalId(body, ['grant', 'program']),
  body('amountSanctioned').optional().isFloat({ min: 0 }).toFloat(),
  body('title').optional().isString().trim().isLength({ min: 1, max: 200 }),
];

const listCompliance = [
  query('docType').optional().isIn(COMPLIANCE_DOC_TYPES),
  query('status').optional().isIn(['draft', 'final', 'submitted', 'approved', 'rejected']),
  fy(query('financialYear').optional()),
];

module.exports = {
  createReport,
  listReports,
  reportId: [id('id')],
  submitReport,
  downloadReport,

  createFinancialRecord: financialFields(true),
  updateFinancialRecord: [id('id'), ...financialFields(false)],
  listFinancialRecords,
  financialRecordId: [id('id')],
  attachmentId: [id('id'), id('attachmentId')],

  createCompliance: complianceFields(true),
  updateCompliance: [id('id'), ...complianceFields(false)],
  generateCompliance,
  listCompliance,
  complianceId: [id('id')],
};
