const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/cron', require('./cron.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/uploads', require('./upload.routes'));
router.use('/mentors', require('./mentor.routes'));
router.use('/videos', require('./video.routes'));
router.use('/startups', require('./startup.routes'));
router.use('/incubators', require('./incubator.routes'));
router.use('/cohorts', require('./cohort.routes'));
router.use('/mentoring', require('./mentoring.routes'));
router.use('/investors', require('./investor.routes'));
router.use('/grants', require('./grant.routes'));
router.use('/events', require('./event.routes'));
router.use('/tools', require('./tool.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
