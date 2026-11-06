const { MentoringSession, MentorProfile, User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config');

const ACTIVE_STATUSES = ['requested', 'confirmed'];
const MINUTE = 60 * 1000;

// Day ("mon") and minutes-since-midnight of a Date in the app timezone
const localParts = (date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { day: parts.weekday.toLowerCase().slice(0, 3), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Session must sit fully inside one of the mentor's weekly slots (if the mentor set any)
const fitsAvailability = (availability, start, durationMinutes) => {
  if (!availability?.length) return true;
  const { day, minutes } = localParts(start);
  return availability.some((slot) => slot.day === day
    && minutes >= toMinutes(slot.from)
    && minutes + durationMinutes <= toMinutes(slot.to));
};

const overlaps = (aStart, aMinutes, bStart, bMinutes) => aStart < new Date(bStart.getTime() + bMinutes * MINUTE)
  && bStart < new Date(aStart.getTime() + aMinutes * MINUTE);

const assertMentorFree = async (mentorId, start, durationMinutes, excludeId) => {
  // Sessions are at most a few hours, so a ±1 day window catches every possible overlap
  const nearby = await MentoringSession.find({
    mentor: mentorId,
    status: { $in: ACTIVE_STATUSES },
    _id: { $ne: excludeId },
    scheduledAt: { $gte: new Date(start.getTime() - 24 * 60 * MINUTE), $lte: new Date(start.getTime() + 24 * 60 * MINUTE) },
  }).select('scheduledAt durationMinutes');

  if (nearby.some((s) => overlaps(start, durationMinutes, s.scheduledAt, s.durationMinutes))) {
    throw ApiError.conflict('The mentor already has a session at that time. Pick another slot.');
  }
};

const requestSession = async ({ user, startup, body }) => {
  const mentor = await User.findOne({ _id: body.mentor, role: 'mentor', status: 'active' });
  if (!mentor) throw ApiError.notFound('Mentor not found');

  const start = new Date(body.scheduledAt);
  const duration = body.durationMinutes || 30;
  const profile = await MentorProfile.findOne({ user: mentor._id }).select('availability');
  if (!fitsAvailability(profile?.availability, start, duration)) {
    throw ApiError.badRequest(`That time is outside the mentor's availability (times are in ${config.timezone})`);
  }
  await assertMentorFree(mentor._id, start, duration);

  return MentoringSession.create({
    mentor: mentor._id,
    startup: startup._id,
    requestedBy: user._id,
    topic: body.topic,
    agenda: body.agenda,
    scheduledAt: start,
    durationMinutes: duration,
    mode: body.mode,
    location: body.location,
  });
};

// ---------- State changes ----------

const isMentorOf = (session, user) => session.mentor.equals(user._id);
const isStartupOf = (session, user) => user.role === 'startup' && user.startup?.equals(session.startup);

const assertStatus = (session, allowed, action) => {
  if (!allowed.includes(session.status)) throw ApiError.badRequest(`A ${session.status} session can't be ${action}`);
};

const confirm = async (session, user, { meetingLink, location }) => {
  if (!isMentorOf(session, user)) throw ApiError.forbidden('Only the mentor can confirm');
  assertStatus(session, ['requested'], 'confirmed');
  if (session.scheduledAt < new Date()) throw ApiError.badRequest('This session time has already passed');
  if (session.mode === 'online' && !(meetingLink || session.meetingLink)) throw ApiError.badRequest('Add a meetingLink for an online session');
  await assertMentorFree(session.mentor, session.scheduledAt, session.durationMinutes, session._id);

  session.set({ status: 'confirmed', ...(meetingLink && { meetingLink }), ...(location && { location }) });
  return session.save();
};

const reject = async (session, user, reason) => {
  if (!isMentorOf(session, user)) throw ApiError.forbidden('Only the mentor can reject');
  assertStatus(session, ['requested'], 'rejected');
  session.set({ status: 'rejected', cancellation: { by: user._id, reason, at: new Date() } });
  return session.save();
};

const cancel = async (session, user, reason) => {
  if (!isMentorOf(session, user) && !isStartupOf(session, user)) throw ApiError.forbidden();
  assertStatus(session, ACTIVE_STATUSES, 'cancelled');
  session.set({ status: 'cancelled', cancellation: { by: user._id, reason, at: new Date() } });
  return session.save();
};

const complete = async (session, user, mentorNotes) => {
  if (!isMentorOf(session, user)) throw ApiError.forbidden('Only the mentor can mark a session completed');
  assertStatus(session, ['confirmed'], 'completed');
  if (session.scheduledAt > new Date()) throw ApiError.badRequest("A session can't be completed before it starts");
  session.set({ status: 'completed', ...(mentorNotes !== undefined && { mentorNotes }) });
  return session.save();
};

const giveFeedback = async (session, user, { rating, comment }) => {
  if (!isStartupOf(session, user)) throw ApiError.forbidden('Only the startup can leave feedback');
  assertStatus(session, ['completed'], 'rated');
  if (session.feedback?.rating) throw ApiError.conflict('Feedback was already submitted');
  session.feedback = { rating, comment };
  return session.save();
};

module.exports = {
  requestSession, confirm, reject, cancel, complete, giveFeedback, isMentorOf, isStartupOf, fitsAvailability,
};
