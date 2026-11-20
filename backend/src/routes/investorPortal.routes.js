const router = require('express').Router();
const portal = require('../controllers/investorPortal.controller');
const v = require('../validators/investorPortal.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { investorProfileUpload, investorDocumentUpload } = require('../middlewares/upload.middleware');

// Everything for the investor role itself (profile, documents, discovery, shortlist, dashboard)
router.use(protect, authorize('investor'));

router.route('/me/profile')
  .get(portal.getMyProfile)
  .put(investorProfileUpload, v.profile, validate, portal.upsertMyProfile);
router.patch('/me/settings', v.settings, validate, portal.updateSettings);
router.post('/me/resubmit', portal.resubmit);
router.post('/me/deactivate', v.deactivate, validate, portal.deactivate);

router.post('/me/documents', investorDocumentUpload, v.document, validate, portal.addDocument);
router.delete('/me/documents/:docId', v.docId, validate, portal.removeDocument);
router.get('/me/documents/:docId/file', v.docId, validate, portal.openDocument);

router.get('/dashboard', portal.getDashboard);

router.get('/startups', v.discover, validate, portal.discoverStartups);
router.get('/startups/recommended', v.discover, validate, portal.recommendedStartups);
router.get('/startups/:startupId', v.startupId, validate, portal.getStartup);

router.get('/shortlist', portal.listShortlist);
router.route('/shortlist/:startupId')
  .put(v.shortlist, validate, portal.saveToShortlist)
  .delete(v.startupId, validate, portal.removeFromShortlist);

module.exports = router;
