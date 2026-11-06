const {
  Enrollment, Startup, User, EmailCampaign,
} = require('../models');
const ApiError = require('../utils/ApiError');
const config = require('../config');
const { sendEmail } = require('./messaging.service');

// Startup contact emails = startup email + the founder's login email (deduped)
const startupEmails = async (startupIds) => {
  const startups = await Startup.find({ _id: { $in: startupIds } }).select('startupEmail owner');
  const owners = await User.find({ _id: { $in: startups.map((s) => s.owner) } }).select('email');
  return [...startups.map((s) => s.startupEmail), ...owners.map((u) => u.email)];
};

const resolveRecipients = async (campaign) => {
  const { audience } = campaign;
  let emails = [];

  if (audience.type === 'cohort') {
    if (!campaign.cohort) throw ApiError.badRequest('Pick a cohort for a cohort campaign');
    const ids = await Enrollment.distinct('startup', { cohort: campaign.cohort, incubator: campaign.incubator, status: 'active' });
    emails = await startupEmails(ids);
  } else if (audience.type === 'startups') {
    // Only startups that belong to this incubator
    const allowed = await Enrollment.distinct('startup', { incubator: campaign.incubator, startup: { $in: audience.startups } });
    emails = await startupEmails(allowed);
  } else {
    emails = audience.emails;
  }

  return [...new Set(emails.filter(Boolean).map((e) => e.toLowerCase()))];
};

// Links in the email can carry these params so sign-ups / applications are
// attributed to this campaign in the IC funnel.
const trackingParams = (campaign) => `source=email_campaign&campaign=${campaign._id}&incubator=${campaign.incubator}`;

// Atomically moves one campaign to 'sending'. Only the caller that wins the update sends,
// so a double-clicked Send or a second server instance can't email the list twice.
const claim = (filter) => EmailCampaign.findOneAndUpdate(filter, { $set: { status: 'sending' } }, { new: true });

const deliver = async (campaign, recipients) => {
  campaign.stats = { recipients: recipients.length, delivered: 0, opened: 0, failed: 0 };
  await campaign.save();

  const html = campaign.bodyHtml.replaceAll('{{trackingParams}}', trackingParams(campaign))
    .replaceAll('{{appUrl}}', config.clientUrl);

  // Sequential to stay within SMTP provider rate limits
  for (const to of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        to, subject: campaign.subject, html, text: html.replace(/<[^>]+>/g, ' '),
      });
      campaign.stats.delivered += 1;
    } catch (err) {
      console.error(`Campaign ${campaign._id}: failed to send to ${to}: ${err.message}`);
      campaign.stats.failed += 1;
    }
  }

  campaign.status = campaign.stats.delivered ? 'sent' : 'failed';
  campaign.sentAt = new Date();
  await campaign.save();
  return campaign;
};

// "Send now" for a draft or a scheduled campaign
const sendCampaign = async (campaign) => {
  if (!['draft', 'scheduled'].includes(campaign.status)) throw ApiError.badRequest(`This campaign is already ${campaign.status}`);
  const recipients = await resolveRecipients(campaign);
  if (!recipients.length) throw ApiError.badRequest('This campaign has no recipients');

  const claimed = await claim({ _id: campaign._id, status: campaign.status });
  if (!claimed) throw ApiError.conflict('This campaign is already being sent');
  return deliver(claimed, recipients);
};

// Called by the scheduler: sends every scheduled campaign whose time has come
const runDueCampaigns = async (now = new Date()) => {
  const results = [];
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const campaign = await claim({ status: 'scheduled', scheduledAt: { $lte: now } });
    if (!campaign) break;
    try {
      // eslint-disable-next-line no-await-in-loop
      const recipients = await resolveRecipients(campaign);
      if (!recipients.length) throw new Error('no recipients at send time');
      // eslint-disable-next-line no-await-in-loop
      await deliver(campaign, recipients);
    } catch (err) {
      console.error(`Scheduled campaign ${campaign._id} failed: ${err.message}`);
      campaign.status = 'failed';
      campaign.sentAt = new Date();
      // eslint-disable-next-line no-await-in-loop
      await campaign.save();
    }
    results.push({ id: campaign._id, status: campaign.status });
  }
  return results;
};

module.exports = { resolveRecipients, sendCampaign, runDueCampaigns };
