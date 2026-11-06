const router = require('express').Router();
const mentor = require('../controllers/mentor.controller');
const validators = require('../validators/mentor.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { mentorPhotoUpload } = require('../middlewares/upload.middleware');

router.use(protect);

router.route('/me/profile')
  .get(authorize('mentor'), mentor.getMyProfile)
  .put(authorize('mentor'), mentorPhotoUpload, validators.upsertProfile, validate, mentor.upsertMyProfile);

router.get('/', validators.listMentors, validate, mentor.listMentors);
router.get('/:id', validators.mentorId, validate, mentor.getMentor);

module.exports = router;
