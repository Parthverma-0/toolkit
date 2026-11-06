// Startup-facing cohort browsing and applying
const router = require('express').Router();
const application = require('../controllers/application.controller');
const v = require('../validators/cohort.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { loadStartup, requireCompleteProfile } = require('../middlewares/startup.middleware');

router.use(protect, authorize('startup'));

router.get('/', v.browseCohorts, validate, application.browseOpenCohorts);
router.get('/:id', v.cohortId, validate, loadStartup, application.getCohortForStartup);
router.post('/:id/apply', v.apply, validate, requireCompleteProfile, application.applyToCohort);

module.exports = router;
