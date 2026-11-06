const router = require('express').Router();
const event = require('../controllers/event.controller');
const v = require('../validators/event.validator');
const validate = require('../middlewares/validate.middleware');
const { protect, authorize } = require('../middlewares/auth.middleware');
const { requireCompleteProfileIfStartup } = require('../middlewares/startup.middleware');
const { eventBannerUpload } = require('../middlewares/upload.middleware');

router.use(protect, requireCompleteProfileIfStartup);

const organizer = authorize('incubator', 'mentor');

router.get('/mine', organizer, v.listMine, validate, event.listMyEvents);
router.get('/registrations/mine', event.listMyRegistrations);

router.route('/')
  .get(v.listEvents, validate, event.listEvents)
  .post(organizer, eventBannerUpload, v.createEvent, validate, event.createEvent);
router.route('/:id')
  .get(v.eventId, validate, event.getEvent)
  .patch(organizer, eventBannerUpload, v.updateEvent, validate, event.updateEvent)
  .delete(organizer, v.eventId, validate, event.deleteEvent);
router.patch('/:id/status', organizer, v.changeStatus, validate, event.changeStatus);

router.route('/:id/register')
  .post(v.eventId, validate, event.register)
  .delete(v.eventId, validate, event.cancelRegistration);

router.get('/:id/registrations', organizer, v.eventId, validate, event.listRegistrations);
router.patch('/:id/registrations/:registrationId', organizer, v.markAttendance, validate, event.markAttendance);

module.exports = router;
