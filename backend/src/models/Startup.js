const mongoose = require('mongoose');
const {
  SECTORS, STARTUP_STAGES, CIN_REGEX, DPIIT_REGEX,
} = require('../utils/constants');

const startupSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // ---- Mandatory profile fields ----
    name: { type: String, required: true, trim: true },
    logo: { type: String, required: true },
    startupEmail: { type: String, required: true, lowercase: true, trim: true },
    cin: { type: String, required: true, unique: true, uppercase: true, trim: true, match: CIN_REGEX },
    dpiitNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, match: DPIIT_REGEX },
    sector: { type: String, enum: SECTORS, required: true },
    stage: { type: String, enum: STARTUP_STAGES, required: true },

    // ---- Optional ----
    problemStatement: { type: String, maxlength: 3000 },
    solution: { type: String, maxlength: 3000 },
    tagline: String,
    website: String,
    foundedOn: Date,
    teamSize: { type: Number, min: 1 },
    address: { city: String, state: String, country: { type: String, default: 'India' }, pincode: String },
    socialLinks: { linkedin: String, twitter: String, instagram: String },

    founders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Founder' }],

    // Incubation linkage (set when enrolled into a cohort)
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' },
    currentCohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },

    // Dashboard is unlocked only after both profiles are complete
    isProfileComplete: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

startupSchema.index({ incubator: 1, sector: 1 });
startupSchema.index({ name: 'text', problemStatement: 'text', solution: 'text' });

module.exports = mongoose.model('Startup', startupSchema);
