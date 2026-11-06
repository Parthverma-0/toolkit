// Startup-facing grants: browse + apply
const router = require('express').Router();
const grant = require('../controllers/grantApplication.controller');
const v = require('../validators/grantApplication.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfile } = require('../middlewares/startup.middleware');
const { grantDocumentsUpload } = require('../middlewares/upload.middleware');

router.use(protect, authorize('startup'), requireCompleteProfile);

// "applications" routes first so they aren't matched as /:id
router.get('/applications/mine', v.listMine, validate, grant.listMyApplications);
router.route('/applications/:applicationId')
  .patch(grantDocumentsUpload, v.updateApplication, validate, grant.updateMyApplication)
  .delete(v.applicationId, validate, grant.deleteDraft);

router.get('/', v.browseGrants, validate, grant.browseGrants);
router.get('/:id', v.grantId, validate, grant.getGrant);
router.post('/:id/applications', grantDocumentsUpload, v.apply, validate, grant.apply);

module.exports = router;
