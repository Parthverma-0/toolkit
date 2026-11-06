const mongoose = require('mongoose');
const { SECTORS, ACCESSIBILITY_TYPES, SEATS_PER_UNIT } = require('../utils/constants');

// Incubation Centre (IC). Registered by the head/manager.
// Each registration unit gives SEATS_PER_UNIT (5) seats: 5 onboardings,
// 5 emails and 5 login passcodes. Seat holders are Users with role 'incubator'.
const incubatorSchema = new mongoose.Schema(
  {
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    units: { type: Number, default: 1, min: 1 },
    seatsPerUnit: { type: Number, default: SEATS_PER_UNIT, immutable: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // includes head

    // ---- Profile: about ----
    name: { type: String, required: true, trim: true },
    logo: String,
    about: { type: String, maxlength: 5000 },
    type: {
      type: String,
      enum: ['academic', 'government', 'corporate', 'private', 'ngo', 'other'],
      required: true,
    },
    hostInstitution: String,
    establishedYear: Number,
    sectorsFocused: [{ type: String, enum: SECTORS }],
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    website: String,
    address: { line1: String, city: String, state: String, country: { type: String, default: 'India' }, pincode: String },

    // ---- Profile: services, policies, accessibilities ----
    // (programs -> Program model, grants -> Grant model with providerType 'incubator')
    services: [{ name: { type: String, required: true }, description: String, isPaid: { type: Boolean, default: false } }],
    policies: [{ title: { type: String, required: true }, description: String, documentUrl: String }],
    accessibilities: [
      {
        type: { type: String, enum: ACCESSIBILITY_TYPES, required: true }, // labs, IP, ...
        name: { type: String, required: true },
        description: String,
        isAvailable: { type: Boolean, default: true },
      },
    ],

    isVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

incubatorSchema.virtual('seatLimit').get(function seatLimit() {
  return this.units * this.seatsPerUnit;
});

incubatorSchema.virtual('seatsAvailable').get(function seatsAvailable() {
  return this.units * this.seatsPerUnit - (this.members?.length || 0);
});

incubatorSchema.path('members').validate(function checkSeatLimit(members) {
  return members.length <= this.units * this.seatsPerUnit;
}, 'Seat limit reached for this incubator');

module.exports = mongoose.model('Incubator', incubatorSchema);
