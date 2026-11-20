const mongoose = require('mongoose');

// A startup an investor saved for later, with the investor's private notes
const investorShortlistSchema = new mongoose.Schema(
  {
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    note: { type: String, maxlength: 3000 },
  },
  { timestamps: true }
);

investorShortlistSchema.index({ investor: 1, startup: 1 }, { unique: true });

module.exports = mongoose.model('InvestorShortlist', investorShortlistSchema);
