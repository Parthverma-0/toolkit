const mongoose = require('mongoose');
const { ROLES, INCUBATOR_MEMBER_ROLES, ACQUISITION_SOURCES } = require('../utils/constants');

// Single login collection for all roles. Role-specific data lives in
// MentorProfile / Startup + Founder / Incubator.
// Sign-in is Google only. An email maps to exactly one account, so it can
// never be registered under two different roles.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true, immutable: true },

    googleId: { type: String, unique: true, sparse: true }, // empty until an invited user first signs in
    avatar: String,

    phone: { type: String, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    // Incubator users only: which incubator seat this login belongs to
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' },
    incubatorRole: { type: String, enum: INCUBATOR_MEMBER_ROLES },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Startup users only
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup' },

    // Signup attribution for the IC marketing funnel (set from invite link / UTM params)
    acquisition: {
      source: { type: String, enum: ACQUISITION_SOURCES },
      incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' },
      campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign' },
      event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    },

    // invited = incubator seat created by the head, not signed in yet
    status: { type: String, enum: ['invited', 'active', 'suspended'], default: 'active' },
    // Bumped to revoke every refresh token (logout from all devices)
    tokenVersion: { type: Number, default: 0, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ incubator: 1 });

module.exports = mongoose.model('User', userSchema);
