// Mounted inside /api/incubators/me (after authorize('incubator') + requireIncubator)
const router = require('express').Router();
const dashboard = require('../controllers/incubatorDashboard.controller');
const funding = require('../controllers/funding.controller');
const achievement = require('../controllers/achievement.controller');
const campaign = require('../controllers/campaign.controller');
const v = require('../validators/incubatorDashboard.validator');
const validate = require('../middlewares/validate.middleware');
const { fundingDocumentsUpload } = require('../middlewares/upload.middleware');

// Dashboard analytics
router.get('/dashboard', v.summary, validate, dashboard.getDashboard);
router.get('/dashboard/funnel', v.funnel, validate, dashboard.getFunnel);
router.get('/dashboard/revenue', v.revenue, validate, dashboard.getRevenue);

// Startup database
router.get('/startups', v.startupDatabase, validate, dashboard.listStartups);
router.get('/startups/:startupId', v.startupId, validate, dashboard.getStartup);

// Funding ledger (fund raised / distributed / external)
router.route('/funding')
  .get(v.listFunding, validate, funding.listFunding)
  .post(fundingDocumentsUpload, v.createFunding, validate, funding.createFunding);
router.route('/funding/:id')
  .patch(fundingDocumentsUpload, v.updateFunding, validate, funding.updateFunding)
  .delete(v.fundingId, validate, funding.deleteFunding);

// Startup achievements
router.route('/achievements')
  .get(v.listAchievements, validate, achievement.listAchievements)
  .post(v.createAchievement, validate, achievement.createAchievement);
router.route('/achievements/:id')
  .patch(v.updateAchievement, validate, achievement.updateAchievement)
  .delete(v.achievementId, validate, achievement.deleteAchievement);

// Email marketing
router.route('/campaigns')
  .get(v.listCampaigns, validate, campaign.listCampaigns)
  .post(v.createCampaign, validate, campaign.createCampaign);
router.route('/campaigns/:id')
  .get(v.campaignId, validate, campaign.getCampaign)
  .patch(v.updateCampaign, validate, campaign.updateCampaign)
  .delete(v.campaignId, validate, campaign.deleteCampaign);
router.get('/campaigns/:id/recipients', v.campaignId, validate, campaign.previewRecipients);
router.post('/campaigns/:id/send', v.campaignId, validate, campaign.sendCampaign);
router.post('/campaigns/:id/schedule', v.scheduleCampaign, validate, campaign.scheduleCampaign);
router.post('/campaigns/:id/unschedule', v.campaignId, validate, campaign.unscheduleCampaign);

module.exports = router;
