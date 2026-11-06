const mongoose = require('mongoose');
const { FUNNEL_STAGES, ACQUISITION_SOURCES } = require('../utils/constants');

// Append-only log for the IC marketing funnel (Founder -> Startup -> IC).
// One document per stage a founder/startup reaches for a given incubator;
// the dashboard counts distinct users per stage to draw the funnel.
const funnelEventSchema = new mongoose.Schema(
  {
    incubator: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', required: true },
    stage: { type: String, enum: FUNNEL_STAGES, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // empty for anonymous profile views
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup' },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    source: { type: String, enum: ACQUISITION_SOURCES, default: 'direct' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    sessionId: String, // dedupes anonymous views
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

funnelEventSchema.index({ incubator: 1, stage: 1, createdAt: -1 });
funnelEventSchema.index({ incubator: 1, source: 1 });
funnelEventSchema.index({ incubator: 1, cohort: 1, stage: 1 });

module.exports = mongoose.model('FunnelEvent', funnelEventSchema);
