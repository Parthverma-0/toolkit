const mongoose = require('mongoose');
const { REPORT_TYPES } = require('../utils/constants');

// Generated reports (government preferred formats + internal).
// `data` stores the snapshot used to render the report at generation time.
const reportSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    type: { type: String, enum: REPORT_TYPES, required: true },
    format: { type: String, enum: ['government', 'internal'], default: 'government' },
    title: { type: String, required: true, trim: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
    period: { from: Date, to: Date },
    financialYear: String, // "2025-26"
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    fileUrl: String, // exported PDF / XLSX
    status: { type: String, enum: ['draft', 'generated', 'submitted'], default: 'draft' },
    submittedTo: String, // agency name
    submittedAt: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

reportSchema.index({ incubator: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
