const mongoose = require('mongoose');
const {
  SECTORS, STARTUP_STAGES, CIN_REGEX, DIPP_REGEX,
} = require('../utils/constants');

const startupSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // ---- Required to complete the profile ----
    name: { type: String, required: true, trim: true },
    startupEmail: { type: String, required: true, lowercase: true, trim: true },
    sector: { type: String, enum: SECTORS, required: true },
    stage: { type: String, enum: STARTUP_STAGES, required: true },

    // ---- Optional ----
    logo: String,
    // sparse: uniqueness only applies to startups that have a CIN / DIPP number
    cin: { type: String, unique: true, sparse: true, uppercase: true, trim: true, match: CIN_REGEX },
    dippNumber: { type: String, unique: true, sparse: true, trim: true, match: DIPP_REGEX },
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

    // Tools and other actions unlock once the required fields above are filled
    isProfileComplete: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

startupSchema.index({ incubator: 1, sector: 1 });
startupSchema.index({ name: 'text', problemStatement: 'text', solution: 'text' });

module.exports = mongoose.model('Startup', startupSchema);
