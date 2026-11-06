const { Event, EventRegistration, Cohort } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const events = require('../services/event.service');

const FIELDS = ['title', 'description', 'type', 'mode', 'venue', 'meetingLink', 'startsAt', 'endsAt', 'capacity', 'visibility', 'cohort'];
const STATUS_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Incubator-only / cohort-only events must belong to the organizer's incubator
const assertAudience = async (data, user) => {
  const restricted = ['incubator_only', 'cohort_only'].includes(data.visibility);
  if ((restricted || data.cohort) && user.role !== 'incubator') {
    throw ApiError.badRequest('Only incubators can create incubator-only or cohort-only events');
  }
  if (data.visibility === 'cohort_only' && !data.cohort) throw ApiError.badRequest('Pick the cohort for a cohort-only event');
  if (data.cohort && !(await Cohort.exists({ _id: data.cohort, incubator: user.incubator }))) {
    throw ApiError.badRequest('Cohort not found in your incubator');
  }
};

// GET /api/events?type=&mode=&incubator=&from=&to=&past=  (published events the user may see)
const listEvents = asyncHandler(async (req, res) => {
  const {
    type, mode, incubator, from, to, past,
  } = req.query;
  const pagination = getPagination(req.query);
  const filter = { ...(await events.visibilityFilter(req.user)), status: { $in: past ? ['published', 'completed'] : ['published'] } };
  if (type) filter.type = type;
  if (mode) filter.mode = mode;
  if (incubator) filter.incubator = incubator;
  filter.endsAt = past ? { $lt: new Date() } : { $gte: new Date() };
  if (from || to) filter.startsAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total] = await Promise.all([
    Event.find(filter)
      .populate('incubator', 'name logo')
      .populate('organizer', 'name')
      .sort({ startsAt: past ? -1 : 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Event.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/events/mine?status=  (events I or my incubator organise)
const listMyEvents = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'incubator' && req.user.incubator
    ? { $or: [{ organizer: req.user._id }, { incubator: req.user.incubator }] }
    : { organizer: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const items = await Event.find(filter).sort({ startsAt: -1 });
  res.json({ success: true, data: items });
});

// GET /api/events/registrations/mine
const listMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await EventRegistration.find({ user: req.user._id, status: { $ne: 'cancelled' } })
    .populate('event', 'title type mode startsAt endsAt venue meetingLink status bannerUrl')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: registrations });
});

// GET /api/events/:id
const getEvent = asyncHandler(async (req, res) => {
  const event = await events.findVisibleEvent(req.params.id, req.user);
  await event.populate([{ path: 'incubator', select: 'name logo' }, { path: 'organizer', select: 'name avatar' }]);
  const [registered, myRegistration] = await Promise.all([
    events.registeredCount(event._id),
    EventRegistration.findOne({ event: event._id, user: req.user._id }).select('status'),
  ]);

  const data = event.toObject();
  // Meeting link is only for registered attendees and organizers
  if (myRegistration?.status !== 'registered' && !events.canManage(event, req.user)) delete data.meetingLink;
  res.json({
    success: true,
    data: {
      ...data,
      registered,
      seatsLeft: event.capacity ? Math.max(event.capacity - registered, 0) : null,
      myRegistration,
    },
  });
});

// POST /api/events  (incubator or mentor; multipart, optional `banner`)
const createEvent = asyncHandler(async (req, res) => {
  if (req.user.role === 'incubator' && !req.user.incubator) throw ApiError.badRequest('Register your incubator first');
  const data = pick(req.body, FIELDS);
  await assertAudience(data, req.user);
  const banner = req.files?.banner?.[0];
  if (banner) data.bannerUrl = toPublicUrl(banner);

  const event = await Event.create({
    ...data,
    organizer: req.user._id,
    incubator: req.user.role === 'incubator' ? req.user.incubator : undefined,
    status: 'draft',
  });
  res.status(201).json({ success: true, data: event });
});

// PATCH /api/events/:id
const updateEvent = asyncHandler(async (req, res) => {
  const event = await events.findManagedEvent(req.params.id, req.user);
  if (['completed', 'cancelled'].includes(event.status)) throw ApiError.badRequest(`A ${event.status} event can't be edited`);

  const data = pick(req.body, FIELDS);
  await assertAudience({ visibility: event.visibility, cohort: event.cohort, ...data }, req.user);
  if (data.capacity && data.capacity < (await events.registeredCount(event._id))) {
    throw ApiError.badRequest('Capacity cannot be lower than the number of people already registered');
  }
  const banner = req.files?.banner?.[0];
  const oldBanner = event.bannerUrl;
  if (banner) data.bannerUrl = toPublicUrl(banner);

  event.set(data);
  if (event.endsAt <= event.startsAt) throw ApiError.badRequest('endsAt must be after startsAt');
  await event.save();
  if (banner && oldBanner) await removeFile(oldBanner);
  res.json({ success: true, data: event });
});

// PATCH /api/events/:id/status  { status }
const changeStatus = asyncHandler(async (req, res) => {
  const event = await events.findManagedEvent(req.params.id, req.user);
  const { status } = req.body;
  if (!STATUS_TRANSITIONS[event.status].includes(status)) throw ApiError.badRequest(`Cannot move a ${event.status} event to ${status}`);
  if (status === 'completed' && event.startsAt > new Date()) throw ApiError.badRequest("An event can't be completed before it starts");
  event.status = status;
  await event.save();
  res.json({ success: true, data: event });
});

// DELETE /api/events/:id  (drafts only; cancel published events instead)
const deleteEvent = asyncHandler(async (req, res) => {
  const event = await events.findManagedEvent(req.params.id, req.user);
  if (event.status !== 'draft') throw ApiError.badRequest('Only draft events can be deleted; cancel it instead');
  await event.deleteOne();
  await removeFile(event.bannerUrl);
  res.json({ success: true, message: 'Event deleted' });
});

// POST /api/events/:id/register
const register = asyncHandler(async (req, res) => {
  const event = await events.findVisibleEvent(req.params.id, req.user);
  const registration = await events.register(event, req.user);
  res.status(201).json({ success: true, data: registration });
});

// DELETE /api/events/:id/register
const cancelRegistration = asyncHandler(async (req, res) => {
  const registration = await EventRegistration.findOne({ event: req.params.id, user: req.user._id, status: 'registered' });
  if (!registration) throw ApiError.notFound('You are not registered for this event');
  registration.status = 'cancelled';
  await registration.save();
  res.json({ success: true, message: 'Registration cancelled' });
});

// GET /api/events/:id/registrations  (organizer)
const listRegistrations = asyncHandler(async (req, res) => {
  const event = await events.findManagedEvent(req.params.id, req.user);
  const registrations = await EventRegistration.find({ event: event._id })
    .populate('user', 'name email avatar role')
    .populate('startup', 'name logo')
    .sort({ createdAt: 1 });
  res.json({ success: true, data: registrations });
});

// PATCH /api/events/:id/registrations/:registrationId  { status: attended | no_show }  (organizer)
const markAttendance = asyncHandler(async (req, res) => {
  const event = await events.findManagedEvent(req.params.id, req.user);
  if (event.startsAt > new Date()) throw ApiError.badRequest("Attendance can't be marked before the event starts");
  const registration = await EventRegistration.findOne({ _id: req.params.registrationId, event: event._id, status: { $ne: 'cancelled' } });
  if (!registration) throw ApiError.notFound('Registration not found');
  registration.status = req.body.status;
  await registration.save();
  res.json({ success: true, data: registration });
});

module.exports = {
  listEvents,
  listMyEvents,
  listMyRegistrations,
  getEvent,
  createEvent,
  updateEvent,
  changeStatus,
  deleteEvent,
  register,
  cancelRegistration,
  listRegistrations,
  markAttendance,
};
