const mongoose = require('mongoose');
const { SECTORS, VIDEO_CATEGORIES } = require('../utils/constants');

const mentorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    photo: String,
    designation: { type: String, trim: true },
    organization: { type: String, trim: true },
    bio: { type: String, maxlength: 2000 },
    yearsOfExperience: { type: Number, min: 0 },
    expertise: [{ type: String, enum: VIDEO_CATEGORIES }],
    sectors: [{ type: String, enum: SECTORS }],
    linkedin: String,
    website: String,
    // Weekly slots a startup can book a mentoring session in
    availability: [
      {
        day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
        from: String, // "10:00"
        to: String, // "12:00"
      },
    ],
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MentorProfile', mentorProfileSchema);
