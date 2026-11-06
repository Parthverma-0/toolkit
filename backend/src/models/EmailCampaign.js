const mongoose = require('mongoose');

// Incubator email marketing (to a cohort, selected startups, or custom list)
const emailCampaignSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    bodyHtml: { type: String, required: true },
    audience: {
      type: { type: String, enum: ['cohort', 'startups', 'custom'], required: true },
      startups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Startup' }],
      emails: [{ type: String, lowercase: true, trim: true }],
    },
    status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], default: 'draft' },
    scheduledAt: Date,
    sentAt: Date,
    stats: {
      recipients: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

emailCampaignSchema.index({ incubator: 1, status: 1 });

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);
