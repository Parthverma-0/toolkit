const mongoose = require('mongoose');
const { SECTORS } = require('../utils/constants');

// Programs run by an incubator (shown on profile; cohorts belong to a program)
const programSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['pre_incubation', 'incubation', 'acceleration', 'virtual_incubation', 'other'],
      required: true,
    },
    description: String,
    durationMonths: { type: Number, min: 1 },
    sectors: [{ type: String, enum: SECTORS }],
    benefits: [String],
    fundingSupport: { available: { type: Boolean, default: false }, maxAmount: Number },
    fundingAgency: String, // e.g. DST NIDHI, MeitY, state govt
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

programSchema.index({ incubator: 1, status: 1 });

module.exports = mongoose.model('Program', programSchema);
