const { Incubator, User } = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { sendEmail } = require('./messaging.service');

const roleLabel = (role) => ({ mentor: 'a mentor', startup: 'a startup', incubator: 'an incubator user' }[role]);

// Atomically takes a seat: only succeeds while members.length < units * seatsPerUnit,
// so two simultaneous invites can never exceed the limit.
const claimSeat = async (incubatorId, userId) => {
  const result = await Incubator.updateOne(
    {
      _id: incubatorId,
      members: { $ne: userId },
      $expr: { $lt: [{ $size: '$members' }, { $multiply: ['$units', '$seatsPerUnit'] }] },
    },
    { $push: { members: userId } },
  );
  return result.modifiedCount === 1;
};

const sendInviteEmail = (incubator, user, invitedBy) => sendEmail({
  to: user.email,
  subject: `You've been added to ${incubator.name} on Toolkit`,
  text: `${invitedBy.name} added you to ${incubator.name} on Toolkit.\n\n`
    + `Sign in with Google using this email (${user.email}) to get started: ${config.clientUrl}/login`,
});

// Head invites a member into a free seat. The email must not belong to any
// other role or incubator (one email = one role). A member removed earlier
// from this same incubator can be re-invited.
const inviteMember = async (incubator, head, { name, email }) => {
  let user = await User.findOne({ email });
  let created = false;

  if (user) {
    if (user.role !== 'incubator') {
      throw ApiError.conflict(`This email is already registered as ${roleLabel(user.role)}`);
    }
    if (!user.incubator?.equals(incubator._id)) {
      throw ApiError.conflict('This email already belongs to another incubator');
    }
    if (incubator.members.some((id) => id.equals(user._id))) {
      throw ApiError.conflict('This person already holds a seat');
    }
  } else {
    user = await User.create({
      name,
      email,
      role: 'incubator',
      incubatorRole: 'member',
      incubator: incubator._id,
      invitedBy: head._id,
      status: 'invited',
    });
    created = true;
  }

  if (!(await claimSeat(incubator._id, user._id))) {
    if (created) await user.deleteOne();
    throw ApiError.conflict(`All ${incubator.seatLimit} seats are in use. Remove a member to free a seat.`);
  }

  // Returning member: previously suspended on removal
  if (!created) {
    user.status = user.googleId ? 'active' : 'invited';
    user.invitedBy = head._id;
    await user.save();
  }

  await sendInviteEmail(incubator, user, head);
  return user;
};

// Frees the seat. The account is kept (suspended) so its email stays tied to
// this incubator and past records keep their author; never-used invites are deleted.
const removeMember = async (incubator, memberId) => {
  const user = await User.findOne({ _id: memberId, incubator: incubator._id });
  if (!user || !incubator.members.some((id) => id.equals(user._id))) throw ApiError.notFound('Member not found');
  if (user.incubatorRole === 'head') throw ApiError.badRequest('The incubator head cannot be removed');

  await Incubator.updateOne({ _id: incubator._id }, { $pull: { members: user._id } });

  if (user.status === 'invited' && !user.googleId) {
    await user.deleteOne();
  } else {
    user.status = 'suspended';
    await user.save();
    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } }); // end their sessions
  }
};

module.exports = { inviteMember, removeMember, sendInviteEmail };
