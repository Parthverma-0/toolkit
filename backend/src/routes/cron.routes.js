// Jobs triggered over HTTP, for hosts without a long-running process (Vercel Cron).
// Locally the in-process scheduler (services/scheduler.service.js) does the same work.
const router = require('express').Router();
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { runDueCampaigns } = require('../services/campaign.service');

router.use((req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) return next(ApiError.unauthorized());
  next();
});

// GET /api/cron/campaigns - sends every scheduled campaign that is due
router.get('/campaigns', asyncHandler(async (req, res) => {
  const results = await runDueCampaigns();
  res.json({ success: true, data: { processed: results.length } });
}));

module.exports = router;
