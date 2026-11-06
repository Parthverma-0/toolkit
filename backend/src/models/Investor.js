const mongoose = require('mongoose');
const { SECTORS, STARTUP_STAGES } = require('../utils/constants');

const investorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    firm: { type: String, trim: true },
    type: {
      type: String,
      enum: ['angel', 'angel_network', 'vc', 'micro_vc', 'corporate_vc', 'family_office', 'government', 'other'],
      required: true,
    },
    logo: String,
    about: String,
    sectors: [{ type: String, enum: SECTORS }],
    stages: [{ type: String, enum: STARTUP_STAGES }],
    ticketSize: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
    location: String,
    email: { type: String, lowercase: true, trim: true },
    website: String,
    linkedin: String,
    portfolio: [String],
    isActive: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

investorSchema.index({ sectors: 1, stages: 1, isActive: 1 });

module.exports = mongoose.model('Investor', investorSchema);
