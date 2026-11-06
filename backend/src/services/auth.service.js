const { User, MentorProfile } = require('../models');
const ApiError = require('../utils/ApiError');
const { SELF_SIGNUP_ROLES } = require('../utils/constants');
const { trackForUser } = require('./funnel.service');

const roleLabel = (role) => ({
  mentor: 'a mentor', startup: 'a startup', incubator: 'an incubator', admin: 'an admin',
}[role]);

// Google sign-in / sign-up with role selection.
// intent: 'login'  -> unknown email is rejected (ACCOUNT_NOT_FOUND) instead of creating an account
//         'signup' -> an existing account is rejected (ACCOUNT_EXISTS), except invited seats being activated
//         omitted  -> sign in if the email exists, otherwise sign up (needs role)
// Returns { user, isNewUser } or { requiresRole: true, profile } when a new
// email signs up without choosing a role yet.
const signInWithGoogle = async (googleProfile, { role, acquisition, intent } = {}) => {
  const { googleId, email, name, avatar } = googleProfile;
  const existing = await User.findOne({ email }).select('+tokenVersion');

  if (existing) {
    if (intent === 'signup' && existing.status !== 'invited') {
      throw ApiError.conflict(`This email is already registered as ${roleLabel(existing.role)}. Sign in instead.`).withCode('ACCOUNT_EXISTS');
    }
    // One email = one role, forever
    if (role && role !== existing.role) {
      throw ApiError.conflict(`This email is already registered as ${roleLabel(existing.role)}. Sign in with that role or use a different email.`)
        .withCode('ROLE_MISMATCH');
    }
    if (existing.googleId && existing.googleId !== googleId) {
      throw ApiError.unauthorized('This email is linked to a different Google account');
    }
    if (existing.status === 'suspended') {
      throw ApiError.forbidden('Your account has been suspended. Contact support.').withCode('ACCOUNT_SUSPENDED');
    }

    // First sign-in of an invited incubator seat (or a pre-created admin) activates it
    if (existing.status === 'invited') {
      existing.status = 'active';
      existing.name = existing.name || name;
    }
    existing.googleId = googleId;
    existing.avatar = existing.avatar || avatar;
    existing.isEmailVerified = true;
    existing.lastLoginAt = new Date();
    await existing.save();

    return { user: existing, isNewUser: false };
  }

  if (intent === 'login') {
    throw ApiError.notFound('No account found for this email. Sign up first.').withCode('ACCOUNT_NOT_FOUND');
  }
  if (!role) {
    return { requiresRole: true, profile: { email, name, avatar } };
  }
  if (!SELF_SIGNUP_ROLES.includes(role)) {
    throw ApiError.badRequest('Invalid role');
  }

  const user = await User.create({
    name,
    email,
    role,
    googleId,
    avatar,
    isEmailVerified: true,
    // Self-registered incubator user is the head; members are invited by them later
    incubatorRole: role === 'incubator' ? 'head' : undefined,
    acquisition,
    lastLoginAt: new Date(),
  });

  // create() does not return select:false fields
  user.tokenVersion = 0;
  if (role === 'startup') await trackForUser(user, 'founder_signed_up');
  return { user, isNewUser: true };
};

// Whether the user still has to finish their role's onboarding (frontend routes on this)
const needsOnboarding = async (user) => {
  switch (user.role) {
    case 'startup': return !user.startup;
    case 'incubator': return !user.incubator;
    case 'mentor': return !(await MentorProfile.exists({ user: user._id }));
    default: return false;
  }
};

module.exports = { signInWithGoogle, needsOnboarding };
