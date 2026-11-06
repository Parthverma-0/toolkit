const mongoose = require('mongoose');
const { TOOL_TYPES } = require('../utils/constants');

// One run of a dashboard tool (pitch deck review, SWOT, GTM, ...).
// input/output are flexible because each tool has a different shape.
const toolSubmissionSchema = new mongoose.Schema(
  {
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toolType: { type: String, enum: TOOL_TYPES, required: true },
    title: { type: String, trim: true },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    attachments: [{ name: String, url: String }], // e.g. uploaded pitch deck PDF
    output: { type: mongoose.Schema.Types.Mixed },
    score: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: ['draft', 'processing', 'completed', 'failed'], default: 'draft' },
    error: String,
  },
  { timestamps: true }
);

toolSubmissionSchema.index({ startup: 1, toolType: 1, createdAt: -1 });

module.exports = mongoose.model('ToolSubmission', toolSubmissionSchema);
