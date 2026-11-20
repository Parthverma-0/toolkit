const router = require('express').Router();
const admin = require('../controllers/adminInvestor.controller');
const v = require('../validators/adminInvestor.validator');
const validate = require('../middlewares/validate.middleware');

// Mounted under /api/admin/investor-network (admin.routes already requires an admin)
router.get('/stats', admin.getStats);
router.get('/export', v.list, validate, admin.exportInvestors);

router.get('/investors', v.list, validate, admin.listInvestors);
router.get('/investors/:id', v.id, validate, admin.getInvestor);
router.patch('/investors/:id/verification', v.setVerification, validate, admin.setVerification);
router.patch('/investors/:id/feature', v.setFeatured, validate, admin.setFeatured);
router.get('/investors/:id/documents/:docId/file', v.document, validate, admin.openDocument);

router.get('/connections', v.listConnections, validate, admin.listConnections);
router.get('/reports', v.listReports, validate, admin.listReports);
router.patch('/reports/:id', v.resolveReport, validate, admin.resolveReport);

router.post('/announcements', v.announce, validate, admin.announce);

module.exports = router;
