const { Event, EventRegistration, Startup } = require('../models');
const ApiError = require('../utils/ApiError');

// Which events a user may see: public ones, plus incubator-only / cohort-only
// events of the incubator & cohort they belong to, plus events they organise.
const visibilityFilter = async (user) => {
  const or = [{ visibility: 'public' }, { organizer: user._id }];

  if (user.role === 'startup') {
    const startup = await Startup.findOne({ owner: user._id }).select('incubator currentCohort');
    if (startup?.incubator) or.push({ visibility: 'incubator_only', incubator: startup.incubator });
    if (startup?.currentCohort) or.push({ visibility: 'cohort_only', cohort: startup.currentCohort });
  }
  if (user.role === 'incubator' && user.incubator) or.push({ incubator: user.incubator });

  return { $or: or };
};

// Organizer, or any seat holder of the organizing incubator
const canManage = (event, user) => event.organizer.equals(user._id)
  || Boolean(event.incubator && user.incubator?.equals(event.incubator));

const findVisibleEvent = async (id, user) => {
  const event = await Event.findOne({ _id: id, ...(await visibilityFilter(user)) });
  if (!event || (event.status === 'draft' && !canManage(event, user))) throw ApiError.notFound('Event not found');
  return event;
};

const findManagedEvent = async (id, user) => {
  const event = await Event.findById(id);
  if (!event || !canManage(event, user)) throw ApiError.notFound('Event not found');
  return event;
};

const registeredCount = (eventId) => EventRegistration.countDocuments({ event: eventId, status: { $in: ['registered', 'attended'] } });

const register = async (event, user) => {
  if (event.status !== 'published') throw ApiError.badRequest('Registration is only open for published events');
  if (event.endsAt < new Date()) throw ApiError.badRequest('This event has already ended');
  if (canManage(event, user)) throw ApiError.badRequest("Organizers don't need to register for their own event");

  const existing = await EventRegistration.findOne({ event: event._id, user: user._id });
  if (existing?.status === 'registered') throw ApiError.conflict('You are already registered');

  const registration = existing || new EventRegistration({ event: event._id, user: user._id });
  registration.set({ status: 'registered', startup: user.role === 'startup' ? user.startup : undefined });
  await registration.save();

  // Check after writing so two simultaneous registrations can't both take the last seat
  if (event.capacity && (await registeredCount(event._id)) > event.capacity) {
    if (existing) {
      registration.status = 'cancelled';
      await registration.save();
    } else {
      await registration.deleteOne();
    }
    throw ApiError.conflict('This event is full');
  }
  return registration;
};

module.exports = {
  visibilityFilter, canManage, findVisibleEvent, findManagedEvent, registeredCount, register,
};
