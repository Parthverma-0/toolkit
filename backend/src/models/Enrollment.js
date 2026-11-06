const mongoose = require('mongoose');

const { Schema } = mongoose;

// A startup onboarded into a cohort, tracked against the cohort's template
// (eligibility, marketing checklist, agreement, milestones, exit).
const enrollmentSchema = new Schema(
  {
    cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
    incubator: { type: Schema.Types.ObjectId, ref: 'Incubator', required: true },
    program: { type: Schema.Types.ObjectId, ref: 'Program' },
    startup: { type: Schema.Types.ObjectId, ref: 'Startup', required: true },
    application: { type: Schema.Types.ObjectId, ref: 'CohortApplication' },
    onboardedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    onboardedAt: { type: Date, default: Date.now },
    mode: { type: String, enum: ['physical', 'virtual'], default: 'physical' },

    status: { type: String, enum: ['active', 'graduated', 'exited', 'dropped'], default: 'active' },

    eligibility: { isEligible: { type: Boolean, default: true }, verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }, notes: String },
    marketingChecklist: [{ item: String, isDone: { type: Boolean, default: false }, doneAt: Date }],
    agreement: {
      isSigned: { type: Boolean, default: false },
      signedAt: Date,
      documentUrl: String,
      acceptedConditions: [String],
      equityPercent: { type: Number, min: 0, max: 100 },
    },
    milestones: [
      {
        title: { type: String, required: true },
        dueDate: Date,
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'missed'], default: 'pending' },
        completedAt: Date,
        evidenceUrl: String,
      },
    ],
    exit: {
      date: Date,
      type: { type: String, enum: ['graduation', 'termination', 'voluntary'] },
      condition: String,
      remarks: String,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ cohort: 1, startup: 1 }, { unique: true });
enrollmentSchema.index({ incubator: 1, status: 1 });
enrollmentSchema.index({ incubator: 1, program: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
