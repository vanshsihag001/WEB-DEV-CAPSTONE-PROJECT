const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cfg = require('../config/env');
const User = require('../models/User');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

exports.hashToken = hashToken;

exports.signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, cfg.accessSecret, { expiresIn: cfg.accessExpires });

exports.verifyAccessToken = (token) => jwt.verify(token, cfg.accessSecret);
exports.verifyRefreshToken = (token) => jwt.verify(token, cfg.refreshSecret);

// Issues an access/refresh pair. Only a SHA-256 hash of the refresh token is stored in the DB.
exports.issueTokenPair = async (user) => {
  const accessToken = exports.signAccessToken(user);
  const refreshToken = jwt.sign(
    { sub: user._id.toString(), jti: crypto.randomUUID() },
    cfg.refreshSecret,
    { expiresIn: cfg.refreshExpires }
  );
  const { exp } = jwt.decode(refreshToken);
  const now = new Date();
  // prune expired tokens, then push the new one (keep max 5 sessions)
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { expiresAt: { $lt: now } } } });
  await User.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [{ tokenHash: hashToken(refreshToken), expiresAt: new Date(exp * 1000) }], $slice: -5 } } }
  );
  return { accessToken, refreshToken };
};
