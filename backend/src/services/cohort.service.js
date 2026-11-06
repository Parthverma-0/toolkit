const {
  Cohort, CohortApplication, Enrollment, Startup,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { normalizePhone } = require('../utils/phone');
const { track } = require('./funnel.service');

// ---------- Status lifecycle ----------
// draft -> registration_open -> ongoing -> completed ; any non-final -> cancelled
const TRANSITIONS = {
  draft: ['registration_open', 'cancelled'],
  registration_open: ['ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const changeStatus = async (cohort, nextStatus, { graduateActive = false, user } = {}) => {
  if (!TRANSITIONS[cohort.status].includes(nextStatus)) {
    throw ApiError.badRequest(`Cannot move a ${cohort.status} cohort to ${nextStatus}`);
  }

  const activeCount = await Enrollment.countDocuments({ cohort: cohort._id, status: 'active' });
  if (nextStatus === 'cancelled' && activeCount) {
    throw ApiError.conflict(`Exit the ${activeCount} active startup(s) before cancelling this cohort`);
  }
  if (nextStatus === 'completed' && activeCount) {
    if (!graduateActive) {
      throw ApiError.conflict(`${activeCount} startup(s) are still active. Exit them, or pass graduateActive: true to graduate all.`);
    }
    const active = await Enrollment.find({ cohort: cohort._id, status: 'active' });
    for (const enrollment of active) {
      // eslint-disable-next-line no-await-in-loop
      await exitEnrollment(enrollment, { type: 'graduation', condition: 'Cohort completed', user });
    }
  }

  cohort.status = nextStatus;
  cohort.registrationForm.isOpen = nextStatus === 'registration_open';
  await cohort.save();
  return cohort;
};

const isRegistrationOpen = (cohort, now = new Date()) => {
  const { opensAt, closesAt } = cohort.registrationForm || {};
  return cohort.status === 'registration_open'
    && (!opensAt || now >= opensAt)
    && (!closesAt || now <= closesAt);
};

// ---------- Registration form responses ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);

// Checks one answer against its form field; returns [normalizedValue, errorMessage]
const checkAnswer = (field, value) => {
  switch (field.type) {
    case 'text':
    case 'textarea': {
      const s = String(value).trim();
      return s.length > 5000 ? [null, 'is too long (max 5000 characters)'] : [s];
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? [n] : [null, 'must be a number'];
    }
    case 'email': {
      const s = String(value).trim().toLowerCase();
      return EMAIL.test(s) ? [s] : [null, 'must be a valid email'];
    }
    case 'phone': {
      const p = normalizePhone(value);
      return p ? [p] : [null, 'must be a valid phone number'];
    }
    case 'date': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? [null, 'must be a valid date'] : [d];
    }
    case 'select':
      return field.options.includes(value) ? [value] : [null, `must be one of: ${field.options.join(', ')}`];
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : [value];
      return arr.every((v) => field.options.includes(v)) ? [arr] : [null, `values must be from: ${field.options.join(', ')}`];
    }
    case 'checkbox':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
        ? [value === true || value === 'true'] : [null, 'must be true or false'];
    case 'url':
    case 'file': // file answers are links for now (uploaded elsewhere / Cloudinary later)
      return /^https?:\/\/\S+$/.test(String(value)) ? [String(value)] : [null, 'must be a valid link'];
    default:
      return [null, 'has an unknown field type'];
  }
};

// answers: { [fieldKey]: value } -> [{ key, value }] or throws 400 with per-field errors
const validateResponses = (cohort, answers = {}) => {
  const errors = [];
  const responses = [];

  cohort.registrationForm.fields.forEach((field) => {
    const value = answers[field.key];
    if (isEmpty(value)) {
      if (field.required) errors.push({ field: field.key, message: `${field.label} is required` });
      return;
    }
    const [normalized, error] = checkAnswer(field, value);
    if (error) errors.push({ field: field.key, message: `${field.label} ${error}` });
    else responses.push({ key: field.key, value: normalized });
  });

  if (errors.length) throw ApiError.badRequest('Please fix the registration form', errors);
  return responses;
};

// Auto-checks what can be checked from the profile (target sectors / stages).
// Free-text eligibility criteria are judged by the reviewer.
const autoEligibility = (cohort, startup) => {
  const met = [];
  const failed = [];
  const { sectors = [], stages = [] } = cohort.targetStartups || {};
  if (sectors.length) (sectors.includes(startup.sector) ? met : failed).push(`Sector: ${startup.sector}`);
  if (stages.length) (stages.includes(startup.stage) ? met : failed).push(`Stage: ${startup.stage}`);
  return { isEligible: failed.length === 0, criteriaMet: met, criteriaFailed: failed };
};

// ---------- Enrollment ----------
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const enrollStartup = async ({
  cohort, incubator, user, applicationId, startupId, mode,
}) => {
  if (!['registration_open', 'ongoing'].includes(cohort.status)) {
    throw ApiError.badRequest('Startups can only be enrolled while registration is open or the cohort is ongoing');
  }

  let application;
  if (applicationId) {
    application = await CohortApplication.findOne({ _id: applicationId, cohort: cohort._id });
    if (!application) throw ApiError.notFound('Application not found in this cohort');
    if (['rejected', 'withdrawn', 'accepted'].includes(application.status)) {
      throw ApiError.badRequest(`Cannot enroll an application that is ${application.status}`);
    }
  }

  const startup = await Startup.findById(application ? application.startup : startupId);
  if (!startup) throw ApiError.notFound('Startup not found');
  if (!startup.isProfileComplete) throw ApiError.badRequest('This startup has not completed its profile yet');

  if (await Enrollment.exists({ startup: startup._id, status: 'active' })) {
    throw ApiError.conflict('This startup is already active in another cohort');
  }
  if (await Enrollment.exists({ startup: startup._id, cohort: cohort._id })) {
    throw ApiError.conflict('This startup has already been enrolled in this cohort');
  }

  const enrollment = await Enrollment.create({
    cohort: cohort._id,
    incubator: incubator._id,
    program: cohort.program,
    startup: startup._id,
    application: application?._id,
    onboardedBy: user._id,
    mode,
    eligibility: { isEligible: application?.eligibility?.isEligible ?? true, verifiedBy: user._id },
    // Snapshot of the cohort templates; later template edits don't change running enrollments
    marketingChecklist: cohort.marketing.checklist.map((c) => ({ item: c.item })),
    milestones: cohort.milestoneChecklist.map((m) => ({
      title: m.title,
      dueDate: m.dueInWeeks ? new Date(cohort.startDate.getTime() + m.dueInWeeks * WEEK_MS) : undefined,
    })),
  });

  if (application) {
    application.status = 'accepted';
    application.reviewedBy = user._id;
    await application.save();
  }
  await Startup.updateOne({ _id: startup._id }, { incubator: incubator._id, currentCohort: cohort._id });
  await track({
    incubator: incubator._id, stage: 'enrolled', user: startup.owner, startup: startup._id, cohort: cohort._id,
  });

  return enrollment;
};

const EXIT_STATUS = { graduation: 'graduated', termination: 'exited', voluntary: 'dropped' };

const exitEnrollment = async (enrollment, {
  type, condition, remarks, date,
}) => {
  if (enrollment.status !== 'active') throw ApiError.badRequest(`This startup has already ${enrollment.status}`);

  enrollment.status = EXIT_STATUS[type];
  enrollment.exit = {
    type, condition, remarks, date: date || new Date(),
  };
  await enrollment.save();
  // Startup stays linked to the incubator (alumni) but leaves the cohort
  await Startup.updateOne({ _id: enrollment.startup, currentCohort: enrollment.cohort }, { $unset: { currentCohort: 1 } });
  return enrollment;
};

const findIncubatorCohort = async (incubatorId, cohortId) => {
  const cohort = await Cohort.findOne({ _id: cohortId, incubator: incubatorId });
  if (!cohort) throw ApiError.notFound('Cohort not found');
  return cohort;
};

module.exports = {
  TRANSITIONS,
  changeStatus,
  isRegistrationOpen,
  validateResponses,
  autoEligibility,
  enrollStartup,
  exitEnrollment,
  findIncubatorCohort,
};
