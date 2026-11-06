const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// OTPs for email / phone verification (login itself is via Google).
// A verified OTP is kept until expiresAt as proof that the user owns the
// target, so profile endpoints can check it. MongoDB TTL index deletes it after.
const otpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: String, enum: ['email', 'phone'], required: true },
    target: { type: String, required: true, trim: true, lowercase: true }, // email address or E.164 phone
    purpose: { type: String, enum: ['verify_email', 'verify_phone'], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ user: 1, target: 1, purpose: 1, createdAt: -1 });

otpSchema.methods.verifyCode = function verifyCode(code) {
  return bcrypt.compare(code, this.codeHash);
};

module.exports = mongoose.model('Otp', otpSchema);
