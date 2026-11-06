const mongoose = require('mongoose');
const { SECTORS, STARTUP_STAGES, FORM_FIELD_TYPES } = require('../utils/constants');

const { Schema } = mongoose;

const formFieldSchema = new Schema({
  key: { type: String, required: true }, // stable id used in application responses
  label: { type: String, required: true },
  type: { type: String, enum: FORM_FIELD_TYPES, required: true },
  required: { type: Boolean, default: false },
  options: [String], // for select / multiselect
  placeholder: String,
  order: { type: Number, default: 0 },
});

// Cohort management: everything an incubator defines for one batch of startups.
// Per-startup progress against this template lives in Enrollment.
const cohortSchema = new Schema(
  {
    incubator: { type: Schema.Types.ObjectId, ref: 'Incubator', required: true },
    program: { type: Schema.Types.ObjectId, ref: 'Program' },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'registration_open', 'ongoing', 'completed', 'cancelled'], default: 'draft' },

    objective: { type: String, required: true },
    targetStartups: {
      count: { type: Number, min: 1 },
      sectors: [{ type: String, enum: SECTORS }],
      stages: [{ type: String, enum: STARTUP_STAGES }],
    },
    eligibilityCriteria: [{ criterion: { type: String, required: true }, description: String, isMandatory: { type: Boolean, default: true } }],
    outcomeMapping: [{ outcome: { type: String, required: true }, indicator: String, target: Number, unit: String }],

    registrationForm: {
      isOpen: { type: Boolean, default: false },
      opensAt: Date,
      closesAt: Date,
      fields: [formFieldSchema],
    },

    // ---- Startup details template ----
    marketing: {
      tools: [{ name: String, description: String, link: String }],
      checklist: [{ item: { type: String, required: true }, description: String }],
    },
    agreement: {
      formatUrl: String, // uploaded agreement template
      templateText: String,
      conditions: [{ title: { type: String, required: true }, description: String }],
    },
    growthMetrics: [
      {
        name: { type: String, required: true }, // matches StartupMetric.custom key
        unit: String,
        target: Number,
        frequency: { type: String, enum: ['monthly', 'quarterly', 'end_of_cohort'], default: 'monthly' },
      },
    ],
    milestoneChecklist: [{ title: { type: String, required: true }, description: String, dueInWeeks: Number }],
    exitConditions: [
      {
        condition: { type: String, required: true },
        type: { type: String, enum: ['graduation', 'termination', 'voluntary'], default: 'graduation' },
      },
    ],

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

cohortSchema.index({ incubator: 1, status: 1 });

module.exports = mongoose.model('Cohort', cohortSchema);
