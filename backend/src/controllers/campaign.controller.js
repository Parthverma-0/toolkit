const { EmailCampaign, Cohort } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const campaigns = require('../services/campaign.service');

// Email marketing (after requireIncubator). In bodyHtml, {{appUrl}} and
// {{trackingParams}} are replaced at send time, e.g.
// <a href="{{appUrl}}/cohorts/123?{{trackingParams}}">Apply</a>
const FIELDS = ['name', 'subject', 'bodyHtml', 'cohort', 'audience'];

const findCampaign = async (req) => {
  const campaign = await EmailCampaign.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return campaign;
};

const assertCohort = async (req, cohortId) => {
  if (cohortId && !(await Cohort.exists({ _id: cohortId, incubator: req.incubator._id }))) {
    throw ApiError.badRequest('Cohort not found in your incubator');
  }
};

// GET /api/incubators/me/campaigns?status=
const listCampaigns = asyncHandler(async (req, res) => {
  const filter = { incubator: req.incubator._id };
  if (req.query.status) filter.status = req.query.status;
  const items = await EmailCampaign.find(filter).select('-bodyHtml').populate('cohort', 'name').sort({ createdAt: -1 });
  res.json({ success: true, data: items });
});

// GET /api/incubators/me/campaigns/:id
const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  res.json({ success: true, data: campaign });
});

// POST /api/incubators/me/campaigns  (saved as draft)
const createCampaign = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  await assertCohort(req, data.cohort);
  const campaign = await EmailCampaign.create({
    ...data, incubator: req.incubator._id, createdBy: req.user._id, status: 'draft',
  });
  res.status(201).json({ success: true, data: campaign });
});

// PATCH /api/incubators/me/campaigns/:id  (drafts only)
const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  if (campaign.status === 'scheduled') throw ApiError.badRequest('Unschedule this campaign before editing it');
  if (campaign.status !== 'draft') throw ApiError.badRequest('Sent campaigns cannot be edited');
  const data = pick(req.body, FIELDS);
  await assertCohort(req, data.cohort);
  campaign.set(data);
  await campaign.save();
  res.json({ success: true, data: campaign });
});

// DELETE /api/incubators/me/campaigns/:id  (drafts only)
const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  if (campaign.status === 'scheduled') throw ApiError.badRequest('Unschedule this campaign before deleting it');
  if (campaign.status !== 'draft') throw ApiError.badRequest('Sent campaigns are kept for your records');
  await campaign.deleteOne();
  res.json({ success: true, message: 'Campaign deleted' });
});

// GET /api/incubators/me/campaigns/:id/recipients  (preview before sending)
const previewRecipients = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  const recipients = await campaigns.resolveRecipients(campaign);
  res.json({ success: true, data: { count: recipients.length, recipients } });
});

// POST /api/incubators/me/campaigns/:id/send  (send now; works for drafts and scheduled campaigns)
const sendCampaign = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  const sent = await campaigns.sendCampaign(campaign);
  res.json({ success: true, data: sent });
});

// POST /api/incubators/me/campaigns/:id/schedule  { scheduledAt }  (schedule a draft or move the time)
const scheduleCampaign = asyncHandler(async (req, res) => {
  const campaign = await findCampaign(req);
  if (!['draft', 'scheduled'].includes(campaign.status)) throw ApiError.badRequest(`This campaign is already ${campaign.status}`);
  const recipients = await campaigns.resolveRecipients(campaign);
  if (!recipients.length) throw ApiError.badRequest('This campaign has no recipients');

  campaign.set({ status: 'scheduled', scheduledAt: req.body.scheduledAt });
  campaign.stats.recipients = recipients.length;
  await campaign.save();
  res.json({ success: true, data: campaign });
});

// POST /api/incubators/me/campaigns/:id/unschedule  (back to draft)
const unscheduleCampaign = asyncHandler(async (req, res) => {
  const campaign = await EmailCampaign.findOneAndUpdate(
    { _id: req.params.id, incubator: req.incubator._id, status: 'scheduled' },
    { $set: { status: 'draft' }, $unset: { scheduledAt: 1 } },
    { new: true },
  );
  if (!campaign) throw ApiError.badRequest('Campaign is not scheduled (it may already be sending)');
  res.json({ success: true, data: campaign });
});

module.exports = {
  listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign, previewRecipients, sendCampaign,
  scheduleCampaign, unscheduleCampaign,
};
