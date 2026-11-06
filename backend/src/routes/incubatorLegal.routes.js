// Mounted inside /api/incubators/me (after authorize('incubator') + requireIncubator)
// Backend step 9: reports + incubator legalities (financial records, compliance documents)
const router = require('express').Router();
const report = require('../controllers/report.controller');
const financial = require('../controllers/financialRecord.controller');
const compliance = require('../controllers/compliance.controller');
const v = require('../validators/legal.validator');
const validate = require('../middlewares/validate.middleware');
const { financialAttachmentsUpload, complianceFileUpload } = require('../middlewares/upload.middleware');

// Reports (government formats + internal)
router.get('/reports/types', report.listReportTypes);
router.route('/reports')
  .get(v.listReports, validate, report.listReports)
  .post(v.createReport, validate, report.createReport);
router.route('/reports/:id')
  .get(v.reportId, validate, report.getReport)
  .delete(v.reportId, validate, report.deleteReport);
router.post('/reports/:id/regenerate', v.reportId, validate, report.regenerateReport);
router.get('/reports/:id/download', v.downloadReport, validate, report.downloadReport);
router.patch('/reports/:id/submit', v.submitReport, validate, report.submitReport);

// Financial records (ledger)
router.route('/financial-records')
  .get(v.listFinancialRecords, validate, financial.listFinancialRecords)
  .post(financialAttachmentsUpload, v.createFinancialRecord, validate, financial.createFinancialRecord);
router.route('/financial-records/:id')
  .patch(financialAttachmentsUpload, v.updateFinancialRecord, validate, financial.updateFinancialRecord)
  .delete(v.financialRecordId, validate, financial.deleteFinancialRecord);
router.delete('/financial-records/:id/attachments/:attachmentId', v.attachmentId, validate, financial.removeAttachment);

// Compliance documents
router.route('/compliance')
  .get(v.listCompliance, validate, compliance.listCompliance)
  .post(complianceFileUpload, v.createCompliance, validate, compliance.uploadCompliance);
router.post('/compliance/generate', v.generateCompliance, validate, compliance.generateCompliance);
router.route('/compliance/:id')
  .get(v.complianceId, validate, compliance.getCompliance)
  .patch(complianceFileUpload, v.updateCompliance, validate, compliance.updateCompliance)
  .delete(v.complianceId, validate, compliance.deleteCompliance);

module.exports = router;
