const mongoose = require('mongoose');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');

// Grants listed on the startup dashboard. Can be external (govt / corporate)
// or offered by an incubator (shown on that incubator's profile).
const grantSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true }, // e.g. "Startup India Seed Fund"
    providerType: { type: String, enum: ['government', 'incubator', 'corporate', 'foundation', 'other'], required: true },
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' }, // when providerType = incubator
    description: String,
    amount: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
    eligibility: [String],
    sectors: [{ type: String, enum: SECTORS }],
    stages: [{ type: String, enum: STARTUP_STAGES }],
    applicationUrl: String,
    opensAt: Date,
    deadline: Date,
    status: { type: String, enum: ['upcoming', 'open', 'closed'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

grantSchema.index({ status: 1, deadline: 1 });
grantSchema.index({ incubator: 1 });

module.exports = mongoose.model('Grant', grantSchema);
