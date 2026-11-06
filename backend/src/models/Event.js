const mongoose = require('mongoose');

// Events shown on the startup dashboard; also counted in incubator activity reports
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    type: {
      type: String,
      enum: ['workshop', 'webinar', 'demo_day', 'hackathon', 'networking', 'bootcamp', 'pitch_event', 'other'],
      required: true,
    },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator' },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' }, // cohort-only event
    bannerUrl: String,
    mode: { type: String, enum: ['online', 'offline', 'hybrid'], default: 'online' },
    venue: String,
    meetingLink: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, min: 1 },
    visibility: { type: String, enum: ['public', 'incubator_only', 'cohort_only'], default: 'public' },
    status: { type: String, enum: ['draft', 'published', 'completed', 'cancelled'], default: 'draft' },
  },
  { timestamps: true }
);

eventSchema.index({ startsAt: 1, status: 1 });
eventSchema.index({ incubator: 1, startsAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
