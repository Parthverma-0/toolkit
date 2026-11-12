// Direct browser -> Cloudinary uploads (see services/directUpload.service.js)
const router = require('express').Router();
const { protect } = require('../middlewares/auth.middleware');
const { useCloud } = require('../services/storage.service');
const directUpload = require('../services/directUpload.service');

router.use(protect);

// POST /api/uploads/sign { mimetype }
// direct:false means "send the file with the form as usual" (local disk storage)
router.post('/sign', (req, res) => {
  if (!useCloud()) return res.json({ success: true, data: { direct: false } });
  res.json({ success: true, data: { direct: true, ...directUpload.issue(req.user, req.body?.mimetype) } });
});

module.exports = router;
