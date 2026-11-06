const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const validators = require('../validators/auth.validator');
const validate = require('../middlewares/validate.middleware');
const { protect } = require('../middlewares/auth.middleware');
const { authLimiter, otpSendLimiter } = require('../middlewares/rateLimit.middleware');

router.use(authLimiter);

router.post('/google', validators.googleAuth, validate, auth.googleAuth);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.post('/logout-all', protect, auth.logoutAll);
router.get('/me', protect, auth.me);

router.post('/otp/send', protect, otpSendLimiter, validators.sendOtp, validate, auth.sendOtp);
router.post('/otp/verify', protect, validators.verifyOtp, validate, auth.verifyOtp);

module.exports = router;
