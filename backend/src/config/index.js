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

// On Vercel the frontend and the API share one domain, so CLIENT_URL is optional there
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

module.exports = {
  isProd,
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || vercelUrl || 'http://localhost:5173',
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
  // AI reports for the dashboard tools. Without GEMINI_API_KEY the tools answer "not set up yet".
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Empty = pick the newest stable "flash" model the key can use
    model: process.env.GEMINI_MODEL,
    // Google Search grounding (citations) for Market Research and Competitor Analysis.
    // Not available on the free tier for current models, so it is opt-in.
    webSearch: process.env.GEMINI_WEB_SEARCH === 'true',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 240000,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
  },
};
