const mongoose = require('mongoose');

// Used for "startup database -> based on achievements"
const achievementSchema = new mongoose.Schema(
  {
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    type: {
      type: String,
      enum: ['award', 'patent', 'trademark', 'funding', 'product_launch', 'revenue_milestone', 'media', 'partnership', 'other'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: String,
    date: { type: Date, required: true },
    proofUrl: String,
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

achievementSchema.index({ startup: 1, type: 1 });
achievementSchema.index({ incubator: 1, type: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);
