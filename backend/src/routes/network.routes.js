const router = require('express').Router();
const network = require('../controllers/network.controller');
const v = require('../validators/network.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const {
  loadStartup, requireCompleteProfile, requireCompleteProfileIfStartup, listOrEmpty,
} = require('../middlewares/startup.middleware');

// Connections, messages, notifications and founder-side investor browsing
router.use(protect);

// Notifications: every signed-in role
router.get('/notifications', v.listNotifications, validate, network.listNotifications);
router.post('/notifications/read', v.markRead, validate, network.markNotificationsRead);

// Connections and messages: investors and founders (a founder needs a complete profile to act)
const parties = authorize('investor', 'startup');
router.get('/connections', parties, listOrEmpty, v.listConnections, validate, network.listConnections);
router.post('/connections', parties, requireCompleteProfileIfStartup, v.createConnection, validate, network.createConnection);
router.patch('/connections/:id', parties, requireCompleteProfileIfStartup, v.respond, validate, network.respondToConnection);
router.route('/connections/:id/messages')
  .get(parties, requireCompleteProfileIfStartup, v.connectionId, validate, network.listMessages)
  .post(parties, requireCompleteProfileIfStartup, v.sendMessage, validate, network.sendMessage);

// Founders browsing registered investors (browsing is open; reporting needs a profile)
router.get('/investors', authorize('startup'), loadStartup, v.listInvestors, validate, network.listInvestors);
router.get('/investors/:id', authorize('startup'), loadStartup, v.investorId, validate, network.getInvestor);
router.post('/investors/:id/report', authorize('startup'), ...requireCompleteProfile, v.report, validate, network.reportInvestor);

module.exports = router;
