const { Notification, InvestorProfile, User } = require('../models');
const { NOTIFICATION_PREFS } = require('../utils/investorOptions');

// Creates an in-app notification. Investors can switch categories off in their settings
// (connections / messages / matches / announcements); everyone else always gets them.
// Never throws: a failed notification must not fail the action that caused it.
const notify = async (userId, {
  type, title, body, link,
}) => {
  try {
    const prefKey = NOTIFICATION_PREFS[type];
    if (prefKey) {
      const profile = await InvestorProfile.findOne({ user: userId }).select(`notificationPrefs.${prefKey}`).lean();
      if (profile && profile.notificationPrefs?.[prefKey] === false) return null;
    }
    return await Notification.create({
      user: userId, type, title, body, link,
    });
  } catch (err) {
    console.error(`Failed to create notification: ${err.message}`);
    return null;
  }
};

// Announcement from the platform to every active investor
const announceToInvestors = async ({ title, body, link }) => {
  const ids = await User.find({ role: 'investor', status: 'active' }).distinct('_id');
  await Promise.all(ids.map((id) => notify(id, {
    type: 'announcement', title, body, link,
  })));
  return ids.length;
};

module.exports = { notify, announceToInvestors };
