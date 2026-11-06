const mongoose = require('mongoose');

const grantApplicationSchema = new mongoose.Schema(
  {
    grant: { type: mongoose.Schema.Types.ObjectId, ref: 'Grant', required: true },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountRequested: { type: Number, min: 0 },
    amountSanctioned: { type: Number, min: 0 },
    purpose: String,
    documents: [{ name: String, url: String }],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed'],
      default: 'draft',
    },
    reviewerRemarks: String,
  },
  { timestamps: true }
);

grantApplicationSchema.index({ grant: 1, startup: 1 }, { unique: true });

module.exports = mongoose.model('GrantApplication', grantApplicationSchema);
