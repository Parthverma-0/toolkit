const mongoose = require('mongoose');
const { CONNECTION_STATUSES } = require('../utils/investorOptions');

// A connection between a registered investor (User, role investor) and a startup.
// Either side can start it: the investor via "Connect with Founder", the founder via
// "Connect" on an investor profile. One document per pair; re-requesting after a
// decline / withdrawal reuses it, and `history` keeps every status change with its time.
const networkConnectionSchema = new mongoose.Schema(
  {
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // startup owner

    initiatedBy: { type: String, enum: ['investor', 'startup'], required: true },
    message: { type: String, maxlength: 2000 },
    status: { type: String, enum: CONNECTION_STATUSES, default: 'pending' },
    respondedAt: Date,

    history: [{
      status: { type: String, enum: CONNECTION_STATUSES },
      by: { type: String, enum: ['investor', 'startup'] },
      at: { type: Date, default: Date.now },
      _id: false,
    }],

    // Conversation summary (messages live in ConnectionMessage)
    lastMessageAt: Date,
    lastMessagePreview: String,
    lastMessageBy: { type: String, enum: ['investor', 'startup'] },
    lastReadAt: { investor: Date, startup: Date },
  },
  { timestamps: true }
);

networkConnectionSchema.index({ investor: 1, startup: 1 }, { unique: true });
networkConnectionSchema.index({ founder: 1, status: 1 });
networkConnectionSchema.index({ investor: 1, status: 1 });

module.exports = mongoose.model('NetworkConnection', networkConnectionSchema);
