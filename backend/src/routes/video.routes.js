const router = require('express').Router();
const video = require('../controllers/video.controller');
const validators = require('../validators/video.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { videoUpload } = require('../middlewares/upload.middleware');

router.use(protect);

router.route('/')
  .get(validators.listVideos, validate, video.listVideos)
  .post(authorize('mentor'), videoUpload, validators.createVideo, validate, video.createVideo);

router.get('/mine', authorize('mentor'), validators.listMine, validate, video.listMyVideos);

router.route('/:id')
  .get(validators.videoId, validate, video.getVideo)
  .patch(authorize('mentor'), videoUpload, validators.updateVideo, validate, video.updateVideo)
  .delete(authorize('mentor'), validators.videoId, validate, video.deleteVideo);

router.post('/:id/like', validators.videoId, validate, video.toggleLike);

module.exports = router;
