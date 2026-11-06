const mongoose = require('mongoose');

// "Mentoring" section of the startup dashboard: 1:1 sessions with a mentor
const mentoringSessionSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: String, required: true, trim: true },
    agenda: String,
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30, min: 15 },
    mode: { type: String, enum: ['online', 'offline'], default: 'online' },
    meetingLink: String,
    location: String,
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'completed', 'cancelled', 'rejected'],
      default: 'requested',
    },
    cancellation: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: String,
      at: Date,
    },
    mentorNotes: String,
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
    },
  },
  { timestamps: true }
);

mentoringSessionSchema.index({ mentor: 1, scheduledAt: 1 });
mentoringSessionSchema.index({ startup: 1, status: 1 });

module.exports = mongoose.model('MentoringSession', mentoringSessionSchema);
