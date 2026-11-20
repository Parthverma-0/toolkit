const mongoose = require('mongoose');

// A message inside an accepted NetworkConnection
const connectionMessageSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'NetworkConnection', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['investor', 'startup'], required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

connectionMessageSchema.index({ connection: 1, createdAt: 1 });

module.exports = mongoose.model('ConnectionMessage', connectionMessageSchema);
