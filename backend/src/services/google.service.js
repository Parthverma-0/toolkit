const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const client = new OAuth2Client(config.googleClientId);

// Verifies the ID token ("credential") the frontend gets from Google Sign-In
const verifyGoogleIdToken = async (idToken) => {
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized('Invalid or expired Google credential');
  }

  if (!payload.email || !payload.email_verified) {
    throw ApiError.unauthorized('Google account email is not verified');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatar: payload.picture,
  };
};

module.exports = { verifyGoogleIdToken };
