const mongoose = require('mongoose');

const founderSchema = new mongoose.Schema(
  {
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // set for the founder who owns the login
    isPrimary: { type: Boolean, default: false },

    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    designation: { type: String, required: true, trim: true }, // CEO, CTO, ...

    photo: String,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    dateOfBirth: Date,
    linkedin: String,
    education: [{ degree: String, institution: String, year: Number }],
    experience: [{ role: String, company: String, from: Date, to: Date }],
    equityPercent: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

founderSchema.index({ startup: 1 });

module.exports = mongoose.model('Founder', founderSchema);
