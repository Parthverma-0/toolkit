const router = require('express').Router();
const admin = require('../controllers/admin.controller');
const v = require('../validators/admin.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.use(protect, authorize('admin'));

router.get('/stats', admin.getStats);

router.get('/incubators', v.listIncubators, validate, admin.listIncubators);
router.route('/incubators/:id')
  .get(v.id, validate, admin.getIncubator)
  .patch(v.updateIncubator, validate, admin.updateIncubator);

router.get('/mentors', v.listMentors, validate, admin.listMentors);
router.patch('/mentors/:id/verify', v.verifyMentor, validate, admin.verifyMentor);

router.get('/users', v.listUsers, validate, admin.listUsers);
router.patch('/users/:id/status', v.setUserStatus, validate, admin.setUserStatus);

router.get('/startups', v.listStartups, validate, admin.listStartups);

router.route('/grants')
  .get(v.listGrants, validate, admin.listGrants)
  .post(v.createGrant, validate, admin.createGrant);
router.route('/grants/:id')
  .patch(v.updateGrant, validate, admin.updateGrant)
  .delete(v.id, validate, admin.deleteGrant);

router.patch('/investors/:id', v.setInvestorActive, validate, admin.setInvestorActive);

module.exports = router;
