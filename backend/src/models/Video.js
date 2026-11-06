const mongoose = require('mongoose');
const { VIDEO_CATEGORIES } = require('../utils/constants');

// Learning videos uploaded by mentors, watched by startups
// e.g. "How to raise investment", "Building a GTM for your startup"
const videoSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    category: { type: String, enum: VIDEO_CATEGORIES, required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    // upload = file stored by us, external = YouTube / Vimeo / Drive link
    sourceType: { type: String, enum: ['upload', 'external'], required: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: String,
    durationSeconds: { type: Number, min: 0 },
    resources: [{ name: String, url: String }], // attached slides, templates, etc.
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    views: { type: Number, default: 0 },
    likes: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], select: false },
    likesCount: { type: Number, default: 0 },
    publishedAt: Date,
  },
  { timestamps: true }
);

videoSchema.index({ mentor: 1, status: 1 });
videoSchema.index({ category: 1, status: 1 });
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Video', videoSchema);
