const router = require('express').Router();
const incubator = require('../controllers/incubator.controller');
const member = require('../controllers/member.controller');
const program = require('../controllers/program.controller');
const grant = require('../controllers/incubatorGrant.controller');
const { SECTIONS, makeSectionController } = require('../controllers/incubatorSection.controller');
const validators = require('../validators/incubator.validator');
const programValidators = require('../validators/program.validator');
const grantValidators = require('../validators/grant.validator');
const grantApplication = require('../controllers/grantApplication.controller');
const grantAppValidators = require('../validators/grantApplication.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireIncubator, requireIncubatorHead } = require('../middlewares/incubator.middleware');
const { incubatorLogoUpload, policyDocumentUpload } = require('../middlewares/upload.middleware');

router.use(protect);

// ---------- My incubator (seat holders) ----------
const me = require('express').Router();
me.use(authorize('incubator'));

// Registration happens before the user has an incubator, so it skips requireIncubator
me.post('/', incubatorLogoUpload, validators.registerIncubator, validate, incubator.registerIncubator);

me.use(requireIncubator);
me.route('/')
  .get(incubator.getMyIncubator)
  .patch(incubatorLogoUpload, validators.updateIncubator, validate, incubator.updateMyIncubator);

// Seats (5 per unit) - head manages
me.get('/members', member.listMembers);
me.post('/members', requireIncubatorHead, validators.inviteMember, validate, member.inviteMember);
me.post('/members/:memberId/resend-invite', requireIncubatorHead, validators.memberId, validate, member.resendInvite);
me.delete('/members/:memberId', requireIncubatorHead, validators.memberId, validate, member.removeMember);

// Profile sections: services, policies, accessibilities
SECTIONS.forEach((section) => {
  const ctrl = makeSectionController(section);
  const v = validators.sectionValidators[section];
  me.route(`/${section}`)
    .get(ctrl.list)
    .post(policyDocumentUpload, v.create, validate, ctrl.create);
  me.route(`/${section}/:itemId`)
    .patch(policyDocumentUpload, v.update, validate, ctrl.update)
    .delete(v.remove, validate, ctrl.remove);
});

// Programs
me.route('/programs')
  .get(programValidators.listPrograms, validate, program.listPrograms)
  .post(programValidators.createProgram, validate, program.createProgram);
me.route('/programs/:id')
  .get(programValidators.programId, validate, program.getProgram)
  .patch(programValidators.updateProgram, validate, program.updateProgram)
  .delete(programValidators.programId, validate, program.deleteProgram);

// Incubator-offered grants
me.route('/grants')
  .get(grantValidators.listGrants, validate, grant.listGrants)
  .post(grantValidators.createGrant, validate, grant.createGrant);
me.route('/grants/:id')
  .get(grantValidators.grantId, validate, grant.getGrant)
  .patch(grantValidators.updateGrant, validate, grant.updateGrant)
  .delete(grantValidators.grantId, validate, grant.deleteGrant);

// Applications to the incubator's own grants
me.get('/grants/:id/applications', grantAppValidators.listForGrant, validate, grantApplication.listGrantApplications);
me.get('/grant-applications/:applicationId', grantAppValidators.applicationId, validate, grantApplication.getGrantApplication);
me.patch('/grant-applications/:applicationId/review', grantAppValidators.review, validate, grantApplication.reviewGrantApplication);

// Cohort management: cohorts, applications, enrollments
me.use(require('./incubatorCohort.routes'));

// Dashboard, startup database, funding, achievements, email campaigns
me.use(require('./incubatorDashboard.routes'));

// Reports, financial records, compliance documents
me.use(require('./incubatorLegal.routes'));

router.use('/me', me);

// ---------- Public directory (any logged-in user) ----------
router.get('/', validators.listIncubators, validate, incubator.listIncubators);
router.get('/:id', validators.incubatorId, validate, incubator.getIncubator);

module.exports = router;
