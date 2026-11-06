const mongoose = require('mongoose');
const { COMPLIANCE_DOC_TYPES } = require('../utils/constants');

// Incubator legalities: uploaded / generated legal-financial documents
// (financial records, internal financials, utilization certificates, expenditure reports)
const complianceDocumentSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    docType: { type: String, enum: COMPLIANCE_DOC_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    financialYear: { type: String, required: true },
    period: { from: Date, to: Date },
    grant: { type: mongoose.Schema.Types.ObjectId, ref: 'Grant' },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    amountSanctioned: Number,
    amountUtilized: Number,
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['draft', 'final', 'submitted', 'approved', 'rejected'], default: 'draft' },
    submittedTo: String,
    submittedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

complianceDocumentSchema.index({ incubator: 1, docType: 1, financialYear: 1 });

module.exports = mongoose.model('ComplianceDocument', complianceDocumentSchema);
