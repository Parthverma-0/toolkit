const router = require('express').Router();
const startup = require('../controllers/startup.controller');
const founder = require('../controllers/founder.controller');
const application = require('../controllers/application.controller');
const enrollment = require('../controllers/enrollment.controller');
const metric = require('../controllers/metric.controller');
const dashboard = require('../controllers/dashboard.controller');
const achievement = require('../controllers/achievement.controller');
const dashboardValidators = require('../validators/incubatorDashboard.validator');
const validators = require('../validators/startup.validator');
const cohortValidators = require('../validators/cohort.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireStartup, requireCompleteProfile } = require('../middlewares/startup.middleware');
const { startupLogoUpload, founderPhotoUpload } = require('../middlewares/upload.middleware');

router.use(protect, authorize('startup'));

// Startup profile (one per startup user)
router.route('/me')
  .get(startup.getMyStartup)
  .post(startupLogoUpload, validators.createStartup, validate, startup.createMyStartup)
  .patch(startupLogoUpload, validators.updateStartup, validate, startup.updateMyStartup);

// Founder profiles
router.get('/me/founders', requireStartup, founder.listFounders);
router.put('/me/founders/primary', requireStartup, founderPhotoUpload, validators.upsertPrimaryFounder, validate, founder.upsertPrimaryFounder);
router.post('/me/founders', requireStartup, founderPhotoUpload, validators.addCoFounder, validate, founder.addCoFounder);
router.route('/me/founders/:id')
  .patch(requireStartup, founderPhotoUpload, validators.updateFounder, validate, founder.updateFounder)
  .delete(requireStartup, validators.founderId, validate, founder.deleteFounder);

// Dashboard home (locked until onboarding is complete)
router.get('/me/dashboard', requireCompleteProfile, dashboard.getStartupDashboard);

// Cohort applications
router.get('/me/applications', requireStartup, application.listMyApplications);
router.post('/me/applications/:applicationId/withdraw', requireStartup, cohortValidators.applicationId, validate, application.withdrawApplication);

// My cohort enrollments (milestones, marketing checklist)
router.get('/me/enrollments', requireStartup, enrollment.listMyEnrollments);
router.get('/me/enrollments/:enrollmentId', requireStartup, cohortValidators.enrollmentId, validate, enrollment.getMyEnrollment);
router.patch('/me/enrollments/:enrollmentId/checklist/:itemId', requireStartup, cohortValidators.checklistItem, validate, enrollment.myChecklistItem);
router.patch('/me/enrollments/:enrollmentId/milestones/:milestoneId', requireStartup, cohortValidators.startupMilestone, validate, enrollment.myMilestone);

// Achievements (self-reported; the incubator verifies)
router.route('/me/achievements')
  .get(requireStartup, achievement.listMyAchievements)
  .post(requireStartup, dashboardValidators.createMyAchievement, validate, achievement.createMyAchievement);
router.delete('/me/achievements/:id', requireStartup, dashboardValidators.achievementId, validate, achievement.deleteMyAchievement);

// Monthly growth metrics
router.route('/me/metrics')
  .get(requireStartup, cohortValidators.metricsRange, validate, metric.listMyMetrics)
  .post(requireStartup, cohortValidators.startupMetric, validate, metric.recordMyMetric);

module.exports = router;