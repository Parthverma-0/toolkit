const mongoose = require('mongoose');
const { REPORT_REASONS } = require('../utils/investorOptions');

// A founder reported an investor profile; admins review these
const profileReportSchema = new mongoose.Schema(
  {
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'InvestorProfile', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 2000 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    resolution: { type: String, maxlength: 1000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

profileReportSchema.index({ status: 1, createdAt: -1 });
profileReportSchema.index({ investor: 1, reportedBy: 1 });

module.exports = mongoose.model('ProfileReport', profileReportSchema);
