const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Otp } = require('../models');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { sendEmail, sendSms } = require('./messaging.service');

const PURPOSE_BY_CHANNEL = { email: 'verify_email', phone: 'verify_phone' };

const minutesFromNow = (min) => new Date(Date.now() + min * 60 * 1000);

const generateCode = () => {
  const { length } = config.otp;
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
};

const sendOtp = async ({ userId, channel, target }) => {
  const purpose = PURPOSE_BY_CHANNEL[channel];

  const last = await Otp.findOne({ user: userId, target, purpose }).sort({ createdAt: -1 });
  if (last && !last.verifiedAt) {
    const secondsSince = (Date.now() - last.createdAt.getTime()) / 1000;
    if (secondsSince < config.otp.resendCooldownSeconds) {
      const wait = Math.ceil(config.otp.resendCooldownSeconds - secondsSince);
      throw ApiError.tooMany(`Please wait ${wait}s before requesting a new OTP`);
    }
  }

  // Only the newest code is valid
  await Otp.deleteMany({ user: userId, target, purpose, verifiedAt: { $exists: false } });

  const code = generateCode();
  await Otp.create({
    user: userId,
    channel,
    target,
    purpose,
    codeHash: await bcrypt.hash(code, 10),
    expiresAt: minutesFromNow(config.otp.ttlMinutes),
  });

  const text = `Your Toolkit verification code is ${code}. It expires in ${config.otp.ttlMinutes} minutes.`;
  if (channel === 'email') {
    await sendEmail({ to: target, subject: 'Your Toolkit verification code', text });
  } else {
    await sendSms({ to: target, text });
  }

  return { expiresInSeconds: config.otp.ttlMinutes * 60 };
};

const verifyOtp = async ({ userId, channel, target, code }) => {
  const purpose = PURPOSE_BY_CHANNEL[channel];
  const otp = await Otp.findOne({
    user: userId,
    target,
    purpose,
    verifiedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) throw ApiError.badRequest('OTP expired or not found. Request a new one.');
  if (otp.attempts >= config.otp.maxAttempts) {
    throw ApiError.tooMany('Too many wrong attempts. Request a new OTP.');
  }

  if (!(await otp.verifyCode(code))) {
    otp.attempts += 1;
    await otp.save();
    throw ApiError.badRequest('Incorrect OTP', { attemptsLeft: config.otp.maxAttempts - otp.attempts });
  }

  otp.verifiedAt = new Date();
  otp.expiresAt = minutesFromNow(config.otp.proofValidMinutes);
  await otp.save();
  return otp;
};

// For later profile endpoints: has this user proven ownership of `target` recently?
const isTargetVerified = async ({ userId, channel, target }) =>
  Boolean(await Otp.exists({
    user: userId,
    target,
    purpose: PURPOSE_BY_CHANNEL[channel],
    verifiedAt: { $exists: true },
    expiresAt: { $gt: new Date() },
  }));

module.exports = { sendOtp, verifyOtp, isTargetVerified };
