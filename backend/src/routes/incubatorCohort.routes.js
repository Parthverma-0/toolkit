// Mounted inside /api/incubators/me (after authorize('incubator') + requireIncubator)
const router = require('express').Router();
const cohort = require('../controllers/cohort.controller');
const application = require('../controllers/application.controller');
const enrollment = require('../controllers/enrollment.controller');
const v = require('../validators/cohort.validator');
const validate = require('../middlewares/validate.middleware');
const { agreementFormatUpload, signedAgreementUpload } = require('../middlewares/upload.middleware');

// Cohorts
router.route('/cohorts')
  .get(v.listCohorts, validate, cohort.listCohorts)
  .post(agreementFormatUpload, v.createCohort, validate, cohort.createCohort);
router.route('/cohorts/:id')
  .get(v.cohortId, validate, cohort.getCohort)
  .patch(agreementFormatUpload, v.updateCohort, validate, cohort.updateCohort)
  .delete(v.cohortId, validate, cohort.deleteCohort);
router.patch('/cohorts/:id/status', v.changeStatus, validate, cohort.changeStatus);

// Applications
router.get('/cohorts/:id/applications', v.listApplications, validate, application.listApplications);
router.get('/applications/:applicationId', v.applicationId, validate, application.getApplication);
router.patch('/applications/:applicationId/review', v.reviewApplication, validate, application.reviewApplication);

// Enrollments (onboarded startups)
router.route('/cohorts/:id/enrollments')
  .get(v.listEnrollments, validate, enrollment.listCohortEnrollments)
  .post(v.enroll, validate, enrollment.enroll);
router.route('/enrollments/:enrollmentId')
  .get(v.enrollmentId, validate, enrollment.getIncubatorEnrollment)
  .patch(v.updateEnrollment, validate, enrollment.updateEnrollment);
router.post('/enrollments/:enrollmentId/agreement', signedAgreementUpload, v.signAgreement, validate, enrollment.signAgreement);
router.patch('/enrollments/:enrollmentId/checklist/:itemId', v.checklistItem, validate, enrollment.incubatorChecklistItem);
router.post('/enrollments/:enrollmentId/milestones', v.addMilestone, validate, enrollment.addMilestone);
router.patch('/enrollments/:enrollmentId/milestones/:milestoneId', v.incubatorMilestone, validate, enrollment.incubatorMilestone);
router.post('/enrollments/:enrollmentId/exit', v.exitEnrollment, validate, enrollment.exitEnrollment);
router.route('/enrollments/:enrollmentId/metrics')
  .get(v.enrollmentId, v.metricsRange, validate, enrollment.listEnrollmentMetrics)
  .post(v.enrollmentMetric, validate, enrollment.recordEnrollmentMetric);

module.exports = router;
