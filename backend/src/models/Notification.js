const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../utils/investorOptions');

// In-app notification (investor and startup dashboards)
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, maxlength: 500 },
    link: String, // frontend route to open
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
