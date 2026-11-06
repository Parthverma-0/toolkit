// Dashboard "Tools" section - catalog only until the tools are built
const router = require('express').Router();
const tool = require('../controllers/tool.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfile } = require('../middlewares/startup.middleware');

router.use(protect, authorize('startup'), requireCompleteProfile);

router.get('/', tool.listTools);
router.get('/:type', tool.getTool);

module.exports = router;
