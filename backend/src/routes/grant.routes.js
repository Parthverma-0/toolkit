// Startup-facing grants: browse + apply
const router = require('express').Router();
const grant = require('../controllers/grantApplication.controller');
const v = require('../validators/grantApplication.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { loadStartup, requireCompleteProfile, listOrEmpty } = require('../middlewares/startup.middleware');
const { grantDocumentsUpload } = require('../middlewares/upload.middleware');

// Browsing is open to every startup; applying needs a complete profile
router.use(protect, authorize('startup'));

// "applications" routes first so they aren't matched as /:id
router.get('/applications/mine', listOrEmpty, v.listMine, validate, grant.listMyApplications);
router.route('/applications/:applicationId')
  .patch(requireCompleteProfile, grantDocumentsUpload, v.updateApplication, validate, grant.updateMyApplication)
  .delete(requireCompleteProfile, v.applicationId, validate, grant.deleteDraft);

router.get('/', v.browseGrants, validate, grant.browseGrants);
router.get('/:id', loadStartup, v.grantId, validate, grant.getGrant);
router.post('/:id/applications', requireCompleteProfile, grantDocumentsUpload, v.apply, validate, grant.apply);

module.exports = router;
