const nodemailer = require('nodemailer');
const config = require('../config');

// Email goes through SMTP when configured; otherwise (and for SMS until a
// provider like MSG91 is chosen) messages are logged to the console in dev.

const transporter = config.smtp.host
  ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
  : null;

const devLog = (channel, to, text) => {
  if (config.isProd) throw new Error(`No ${channel} provider configured`);
  console.log(`[dev ${channel}] to=${to} | ${text}`);
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) return devLog('email', to, text);
  return transporter.sendMail({ from: config.smtp.from, to, subject, text, html });
};

const sendSms = async ({ to, text }) => devLog('sms', to, text);

module.exports = { sendEmail, sendSms };
