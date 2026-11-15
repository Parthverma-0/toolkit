// Dashboard "Tools": the catalog is visible to every startup; generating a report needs a
// complete profile (403 PROFILE_INCOMPLETE opens the "complete your profile" popup).
const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const tool = require('../controllers/tool.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfile, listOrEmpty, loadStartup } = require('../middlewares/startup.middleware');
const { reportLimiter } = require('../middlewares/rateLimit.middleware');
const ApiError = require('../utils/ApiError');

// Pitch decks are sent to the AI straight from memory and not stored.
// 4 MB keeps the whole request under Vercel's 4.5 MB body limit.
const deckUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (file.mimetype === 'application/pdf'
    ? cb(null, true)
    : cb(ApiError.badRequest('Upload the deck as a PDF file'))),
}).single('deck');

const validId = (req, res, next) => (mongoose.isValidObjectId(req.params.id) ? next() : next(ApiError.notFound('Report not found')));
const needStartup = (req, res, next) => (req.startup ? next() : next(ApiError.notFound('Report not found')));

router.use(protect, authorize('startup'));

router.get('/', tool.listTools);

router.get('/reports/:id', validId, loadStartup, needStartup, tool.getReport);
router.delete('/reports/:id', validId, loadStartup, needStartup, tool.deleteReport);

router.get('/:type', tool.getTool);
router.get('/:type/reports', listOrEmpty, tool.listReports);
router.post('/:type/reports', requireCompleteProfile, reportLimiter, deckUpload, tool.createReport);

module.exports = router;
