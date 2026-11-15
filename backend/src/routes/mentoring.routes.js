const router = require('express').Router();
const mentoring = require('../controllers/mentoring.controller');
const v = require('../validators/mentoring.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfileIfStartup, listOrEmpty } = require('../middlewares/startup.middleware');

router.use(protect, authorize('startup', 'mentor'));

// A startup without a profile sees an empty list; everything else needs the profile
router.get('/sessions', listOrEmpty, v.listSessions, validate, mentoring.listSessions);
router.use(requireCompleteProfileIfStartup);

router.post('/sessions', authorize('startup'), v.requestSession, validate, mentoring.requestSession);
router.get('/sessions/:id', v.sessionId, validate, mentoring.getSession);
router.patch('/sessions/:id/confirm', authorize('mentor'), v.confirm, validate, mentoring.confirmSession);
router.patch('/sessions/:id/reject', authorize('mentor'), v.reason, validate, mentoring.rejectSession);
router.patch('/sessions/:id/cancel', v.reason, validate, mentoring.cancelSession);
router.patch('/sessions/:id/complete', authorize('mentor'), v.complete, validate, mentoring.completeSession);
router.post('/sessions/:id/feedback', authorize('startup'), v.feedback, validate, mentoring.sessionFeedback);

module.exports = router;
