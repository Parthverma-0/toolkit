const mongoose = require('mongoose');

// A startup's submission of a cohort's registration form
const cohortApplicationSchema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responses: [{ key: { type: String, required: true }, value: mongoose.Schema.Types.Mixed }],
    eligibility: {
      isEligible: Boolean,
      criteriaMet: [String],
      criteriaFailed: [String],
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'],
      default: 'submitted',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: String,
  },
  { timestamps: true }
);

cohortApplicationSchema.index({ cohort: 1, startup: 1 }, { unique: true });
cohortApplicationSchema.index({ incubator: 1, status: 1 });

module.exports = mongoose.model('CohortApplication', cohortApplicationSchema);
