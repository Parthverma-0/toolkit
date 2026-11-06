const mongoose = require('mongoose');

// "Connect investors": a startup's outreach request to an investor
const investorConnectionSchema = new mongoose.Schema(
  {
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'Investor', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, maxlength: 2000 },
    pitchDeckUrl: String,
    amountSought: Number,
    status: {
      type: String,
      enum: ['requested', 'in_review', 'meeting_scheduled', 'in_discussion', 'invested', 'declined'],
      default: 'requested',
    },
    notes: String,
  },
  { timestamps: true }
);

investorConnectionSchema.index({ startup: 1, investor: 1 }, { unique: true });

module.exports = mongoose.model('InvestorConnection', investorConnectionSchema);
