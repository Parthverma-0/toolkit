// Central config read from .env. Fails fast on missing required values.
const required = ['MONGO_URI', 'GOOGLE_CLIENT_ID', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (process.env.STORAGE_DRIVER === 'cloudinary') {
  ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].forEach((key) => {
    if (!process.env[key]) missing.push(key);
  });
}
if (missing.length && process.env.NODE_ENV !== 'test') {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Mentor availability slots (e.g. "mon 10:00-12:00") are interpreted in this zone
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  mongoUri: process.env.MONGO_URI,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cookie: {
    // 'none' is needed if frontend and API are on different domains in production
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    secure: isProd || process.env.COOKIE_SAMESITE === 'none',
  },
  otp: {
    length: 6,
    ttlMinutes: 10,
    resendCooldownSeconds: 60,
    maxAttempts: 5,
    proofValidMinutes: 60, // how long a verified OTP counts as proof of ownership
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
  },
};
