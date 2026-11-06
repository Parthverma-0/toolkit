const { Founder } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { assertEquityWithinLimit, refreshProfileCompletion } = require('../services/startup.service');

// All routes run after requireStartup, so req.startup is the user's startup

const PROFILE_FIELDS = ['fullName', 'designation', 'gender', 'dateOfBirth', 'linkedin', 'equityPercent', 'education', 'experience'];
const CONTACT_FIELDS = ['email', 'phone'];

const findFounder = async (req) => {
  const founder = await Founder.findOne({ _id: req.params.id, startup: req.startup._id });
  if (!founder) throw ApiError.notFound('Founder not found');
  return founder;
};

const assertEmailNotTaken = async (startupId, email, excludeFounderId) => {
  if (await Founder.exists({ startup: startupId, email, _id: { $ne: excludeFounderId } })) {
    throw ApiError.conflict('A founder with this email already exists in your startup');
  }
};

// GET /api/startups/me/founders
const listFounders = asyncHandler(async (req, res) => {
  const founders = await Founder.find({ startup: req.startup._id }).sort({ isPrimary: -1, createdAt: 1 });
  res.json({ success: true, data: founders });
});

// PUT /api/startups/me/founders/primary  (multipart, optional `photo`)
// The logged-in user's own founder profile. Email/phone are taken from the verified account.
const upsertPrimaryFounder = asyncHandler(async (req, res) => {
  if (!req.user.isPhoneVerified) {
    throw ApiError.badRequest('Verify your phone number with OTP first (POST /api/auth/otp/send with channel "phone")');
  }

  let founder = await Founder.findOne({ startup: req.startup._id, isPrimary: true });
  const isNew = !founder;
  const data = pick(req.body, PROFILE_FIELDS);
  await assertEquityWithinLimit(req.startup._id, data.equityPercent, founder?._id);

  if (isNew) founder = new Founder({ startup: req.startup._id, isPrimary: true, user: req.user._id });
  const oldPhoto = founder.photo;
  const photo = req.files?.photo?.[0];
  if (photo) data.photo = toPublicUrl(photo);

  founder.set({
    ...data,
    email: req.user.email,
    phone: req.user.phone,
    isEmailVerified: true,
    isPhoneVerified: true,
  });
  await founder.save();
  if (photo && oldPhoto) await removeFile(oldPhoto);

  if (isNew) {
    req.startup.founders.addToSet(founder._id);
    await req.startup.save();
  }

  const onboarding = await refreshProfileCompletion(req.startup, req.user);
  res.status(isNew ? 201 : 200).json({ success: true, data: founder, onboarding });
});

// POST /api/startups/me/founders  (co-founder, multipart, optional `photo`)
const addCoFounder = asyncHandler(async (req, res) => {
  const data = pick(req.body, [...PROFILE_FIELDS, ...CONTACT_FIELDS]);
  await assertEmailNotTaken(req.startup._id, data.email);
  await assertEquityWithinLimit(req.startup._id, data.equityPercent);

  const photo = req.files?.photo?.[0];
  if (photo) data.photo = toPublicUrl(photo);

  const founder = await Founder.create({ ...data, startup: req.startup._id, isPrimary: false });
  req.startup.founders.addToSet(founder._id);
  await req.startup.save();

  res.status(201).json({ success: true, data: founder });
});

// PATCH /api/startups/me/founders/:id
const updateFounder = asyncHandler(async (req, res) => {
  const founder = await findFounder(req);
  // Primary founder's contact details always mirror the verified account
  const allowed = founder.isPrimary ? PROFILE_FIELDS : [...PROFILE_FIELDS, ...CONTACT_FIELDS];
  const data = pick(req.body, allowed);

  if (data.email && data.email !== founder.email) await assertEmailNotTaken(req.startup._id, data.email, founder._id);
  await assertEquityWithinLimit(req.startup._id, data.equityPercent, founder._id);

  const photo = req.files?.photo?.[0];
  const oldPhoto = founder.photo;
  if (photo) data.photo = toPublicUrl(photo);

  founder.set(data);
  await founder.save();
  if (photo && oldPhoto) await removeFile(oldPhoto);

  res.json({ success: true, data: founder });
});

// DELETE /api/startups/me/founders/:id  (co-founders only)
const deleteFounder = asyncHandler(async (req, res) => {
  const founder = await findFounder(req);
  if (founder.isPrimary) throw ApiError.badRequest('The primary founder cannot be removed');

  await founder.deleteOne();
  req.startup.founders.pull(founder._id);
  await req.startup.save();
  await removeFile(founder.photo);

  res.json({ success: true, message: 'Founder removed' });
});

module.exports = {
  listFounders, upsertPrimaryFounder, addCoFounder, updateFounder, deleteFounder,
};
