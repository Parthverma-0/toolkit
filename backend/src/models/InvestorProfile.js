const mongoose = require('mongoose');
const O = require('../utils/investorOptions');

// Profile of a person who signed up with the "investor" role (User.role = 'investor').
// Not to be confused with models/Investor.js, the directory entries incubators curate for startups.

const portfolioEntrySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  website: { type: String, trim: true },
  sector: { type: String, trim: true, maxlength: 60 },
  year: { type: Number, min: 1950, max: 2100 },
});

// Verification documents are private: only the owner and admins can open them
// (never serialized into public responses; see services/investorSerializer.js).
const documentSchema = new mongoose.Schema({
  type: { type: String, enum: O.DOCUMENT_TYPES, required: true },
  name: { type: String, trim: true, maxlength: 200 },
  url: { type: String, required: true },
  mimetype: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now },
});

const investorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    // ---- A. Basic information (name + phone live on the User) ----
    photo: String,
    contactEmail: { type: String, lowercase: true, trim: true }, // defaults to the sign-in email
    designation: { type: String, trim: true, maxlength: 100 },
    linkedin: { type: String, trim: true },
    location: { type: String, trim: true, maxlength: 100 }, // city
    country: { type: String, trim: true, maxlength: 80 },

    // ---- B. Investor / organisation ----
    investorType: { type: String, enum: O.INVESTOR_TYPES },
    category: { type: String, enum: O.INVESTOR_CATEGORIES },
    organisationName: { type: String, trim: true, maxlength: 150 },
    organisationWebsite: { type: String, trim: true },
    organisationLogo: String,
    organisationLinkedin: { type: String, trim: true },
    yearEstablished: { type: Number, min: 1800, max: 2100 },
    headOffice: { type: String, trim: true, maxlength: 150 },

    // ---- 3. Investment preferences (ids from utils/investorOptions; sectors / locations may hold custom text) ----
    sectors: [{ type: String, trim: true, maxlength: 60 }],
    stages: [{ type: String, enum: O.INVESTOR_STAGES }],
    ticketSizes: [{ type: String, enum: Object.keys(O.TICKET_SIZES) }],
    customTicket: { min: { type: Number, min: 0 }, max: { type: Number, min: 0 } }, // INR
    locations: [{ type: String, trim: true, maxlength: 60 }],
    businessModels: [{ type: String, enum: O.BUSINESS_MODELS }],
    revenuePreferences: [{ type: String, enum: O.REVENUE_PREFERENCES }],
    approaches: [{ type: String, enum: O.INVESTMENT_APPROACHES }],
    frequency: { type: String, enum: O.INVESTMENT_FREQUENCIES },
    equityRanges: [{ type: String, enum: O.EQUITY_RANGES }],

    // ---- 4. Background & expertise ----
    professionalBackground: { type: String, maxlength: 3000 },
    yearsOfExperience: { type: Number, min: 0, max: 80 },
    previousInvestments: { type: Number, min: 0 },
    portfolio: [portfolioEntrySchema],
    expertise: [{ type: String, trim: true, maxlength: 60 }],
    mentorshipAvailable: { type: Boolean, default: false },
    strategicSupport: { type: Boolean, default: false },
    networkingSupport: { type: Boolean, default: false },
    bio: { type: String, maxlength: 2000 },

    // ---- 5. Verification ----
    documents: [documentSchema],
    verification: {
      status: { type: String, enum: O.VERIFICATION_STATUSES, default: 'pending' },
      note: { type: String, maxlength: 1000 }, // admin's reason (rejected / more information required)
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
    },
    // Set when the mandatory fields are first complete; until then the investor is still onboarding
    submittedAt: Date,

    // ---- Settings ----
    visibility: { type: String, enum: O.VISIBILITIES, default: 'public' },
    showTicketSize: { type: Boolean, default: false },
    notificationPrefs: {
      connections: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      matches: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
    },

    isFeatured: { type: Boolean, default: false }, // admin-curated
  },
  { timestamps: true }
);

investorProfileSchema.index({ 'verification.status': 1, visibility: 1 });
investorProfileSchema.index({ sectors: 1 });
investorProfileSchema.index({ isFeatured: -1, submittedAt: -1 });

module.exports = mongoose.model('InvestorProfile', investorProfileSchema);
