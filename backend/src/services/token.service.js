const jwt = require('jsonwebtoken');
const config = require('../config');

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_PATH = '/api/auth';

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.accessSecret, { expiresIn: config.jwt.accessExpiresIn });

// tv = tokenVersion; bumping it on the user invalidates all refresh tokens
const signRefreshToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

const baseCookie = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
});

const toMs = (expiresIn) => {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return undefined;
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[match[2]];
  return Number(match[1]) * unit;
};

const setAuthCookies = (res, user) => {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), { ...baseCookie(), maxAge: toMs(config.jwt.accessExpiresIn) });
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), {
    ...baseCookie(),
    path: REFRESH_PATH,
    maxAge: toMs(config.jwt.refreshExpiresIn),
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, baseCookie());
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_PATH });
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
