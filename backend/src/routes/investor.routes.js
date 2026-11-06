const router = require('express').Router();
const investor = require('../controllers/investor.controller');
const v = require('../validators/investor.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfile } = require('../middlewares/startup.middleware');
const { requireIncubator } = require('../middlewares/incubator.middleware');

router.use(protect);

const startupOnly = [authorize('startup'), ...requireCompleteProfile];
const incubatorOnly = [authorize('incubator'), requireIncubator];

// Startup connection pipeline (before /:id so "connections" isn't read as an id)
router.get('/connections', startupOnly, v.listConnections, validate, investor.listMyConnections);
router.route('/connections/:connectionId')
  .patch(startupOnly, v.updateConnection, validate, investor.updateConnection)
  .delete(startupOnly, v.connectionId, validate, investor.withdrawConnection);

// Directory
router.route('/')
  .get(v.listInvestors, validate, investor.listInvestors)
  .post(incubatorOnly, v.createInvestor, validate, investor.createInvestor);
router.route('/:id')
  .get(v.investorId, validate, investor.getInvestor)
  .patch(incubatorOnly, v.updateInvestor, validate, investor.updateInvestor)
  .delete(incubatorOnly, v.investorId, validate, investor.deleteInvestor);
router.post('/:id/connect', startupOnly, v.connect, validate, investor.connect);

module.exports = router;
