const mongoose = require('mongoose');

// Periodic (monthly) numbers for a startup. Powers "revenue of each startup"
// on the incubator dashboard and cohort "startup growth metrics".
const startupMetricSchema = new mongoose.Schema(
  {
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    period: {
      month: { type: Number, min: 1, max: 12, required: true },
      year: { type: Number, required: true },
    },
    revenue: { type: Number, default: 0, min: 0 },
    expenses: { type: Number, default: 0, min: 0 },
    customers: { type: Number, default: 0, min: 0 },
    employees: { type: Number, default: 0, min: 0 },
    // Cohort-defined metrics keyed by metric name, e.g. { "MAU": 1200 }
    custom: { type: Map, of: Number },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

startupMetricSchema.index({ startup: 1, 'period.year': 1, 'period.month': 1 }, { unique: true });

module.exports = mongoose.model('StartupMetric', startupMetricSchema);
