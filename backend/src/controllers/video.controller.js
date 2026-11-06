const { Video } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');

const EDITABLE_FIELDS = ['title', 'description', 'category', 'tags', 'status', 'durationSeconds', 'resources'];
const MENTOR_FIELDS = 'name avatar';
const SORTS = { latest: { publishedAt: -1 }, popular: { views: -1 }, most_liked: { likesCount: -1 } };

// works whether `mentor` is populated or a raw ObjectId (ObjectId._id returns itself)
const isOwner = (video, user) => Boolean(video.mentor?._id?.equals(user._id));

const findOwnVideo = async (id, user) => {
  const video = await Video.findById(id);
  if (!video) throw ApiError.notFound('Video not found');
  if (!isOwner(video, user)) throw ApiError.forbidden('You can only manage your own videos');
  return video;
};

// Uploaded file wins over externalUrl; returns null when neither was given
const resolveSource = (req) => {
  const file = req.files?.video?.[0];
  if (file) return { sourceType: 'upload', videoUrl: toPublicUrl(file) };
  if (req.body.externalUrl) return { sourceType: 'external', videoUrl: req.body.externalUrl };
  return null;
};

// POST /api/videos  (mentor, multipart: video file OR externalUrl, optional thumbnail)
const createVideo = asyncHandler(async (req, res) => {
  const source = resolveSource(req);
  if (!source) throw ApiError.badRequest('Upload a video file or provide externalUrl');

  const thumbnail = req.files?.thumbnail?.[0];
  const data = { ...pick(req.body, EDITABLE_FIELDS), ...source, mentor: req.user._id };
  if (thumbnail) data.thumbnailUrl = toPublicUrl(thumbnail);
  if (data.status === 'published') data.publishedAt = new Date();

  const video = await Video.create(data);
  res.status(201).json({ success: true, data: video });
});

// GET /api/videos?category=&mentor=&q=&sort=&page=&limit=  (published only, any logged-in user)
const listVideos = asyncHandler(async (req, res) => {
  const { category, mentor, q, sort = 'latest' } = req.query;
  const pagination = getPagination(req.query);

  const filter = { status: 'published' };
  if (category) filter.category = category;
  if (mentor) filter.mentor = mentor;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    Video.find(filter)
      .populate('mentor', MENTOR_FIELDS)
      .sort(SORTS[sort])
      .skip(pagination.skip)
      .limit(pagination.limit),
    Video.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/videos/mine?status=  (mentor's own videos, every status)
const listMyVideos = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query);
  const filter = { mentor: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Video.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    Video.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/videos/:id  (counts a view when someone other than the owner opens it)
const getVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id).populate('mentor', MENTOR_FIELDS);
  if (!video) throw ApiError.notFound('Video not found');

  const owner = isOwner(video, req.user);
  if (video.status !== 'published' && !owner) throw ApiError.notFound('Video not found');

  if (!owner) {
    await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });
    video.views += 1;
  }
  const likedByMe = Boolean(await Video.exists({ _id: video._id, likes: req.user._id }));

  res.json({ success: true, data: { ...video.toObject(), likedByMe } });
});

// PATCH /api/videos/:id  (owner; can replace video file / thumbnail)
const updateVideo = asyncHandler(async (req, res) => {
  const video = await findOwnVideo(req.params.id, req.user);
  const oldFiles = [];

  Object.assign(video, pick(req.body, EDITABLE_FIELDS));

  const source = resolveSource(req);
  if (source && source.videoUrl !== video.videoUrl) {
    oldFiles.push(video.videoUrl);
    Object.assign(video, source);
  }
  const thumbnail = req.files?.thumbnail?.[0];
  if (thumbnail) {
    oldFiles.push(video.thumbnailUrl);
    video.thumbnailUrl = toPublicUrl(thumbnail);
  }
  if (video.status === 'published' && !video.publishedAt) video.publishedAt = new Date();

  await video.save();
  await Promise.all(oldFiles.map(removeFile));
  res.json({ success: true, data: video });
});

// DELETE /api/videos/:id  (owner)
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await findOwnVideo(req.params.id, req.user);
  await video.deleteOne();
  await Promise.all([removeFile(video.videoUrl), removeFile(video.thumbnailUrl)]);
  res.json({ success: true, message: 'Video deleted' });
});

// POST /api/videos/:id/like  (toggle)
const toggleLike = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const liked = await Video.updateOne(
    { _id: id, status: 'published', likes: { $ne: userId } },
    { $addToSet: { likes: userId }, $inc: { likesCount: 1 } },
  );
  let likedByMe = true;
  if (!liked.modifiedCount) {
    const unliked = await Video.updateOne(
      { _id: id, status: 'published', likes: userId },
      { $pull: { likes: userId }, $inc: { likesCount: -1 } },
    );
    if (!unliked.matchedCount) throw ApiError.notFound('Video not found');
    likedByMe = false;
  }

  const { likesCount } = await Video.findById(id).select('likesCount');
  res.json({ success: true, data: { likedByMe, likesCount } });
});

module.exports = {
  createVideo, listVideos, listMyVideos, getVideo, updateVideo, deleteVideo, toggleLike,
};
