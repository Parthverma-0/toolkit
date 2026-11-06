const mongoose = require('mongoose');
const { FINANCIAL_CATEGORIES } = require('../utils/constants');

// Incubator ledger entries (incubator legalities -> financial records / internal financials).
// Expenditure reports and utilization certificates are built from these.
const financialRecordSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    entryType: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, enum: FINANCIAL_CATEGORIES, required: true },
    isInternal: { type: Boolean, default: false }, // internal-only vs reportable to funding agency
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    date: { type: Date, required: true },
    financialYear: { type: String, required: true }, // "2025-26"
    description: String,
    grant: { type: mongoose.Schema.Types.ObjectId, ref: 'Grant' },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup' },
    referenceNo: String, // invoice / voucher no.
    attachments: [{ name: String, url: String }],
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

financialRecordSchema.index({ incubator: 1, financialYear: 1, entryType: 1 });

module.exports = mongoose.model('FinancialRecord', financialRecordSchema);
