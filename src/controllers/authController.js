const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { created, ok } = require('../utils/response');
const { issueTokenPair, verifyRefreshToken, hashToken } = require('../utils/tokens');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict('Email is already registered');
  const user = await User.create({ name, email, password, role, phone });
  const tokens = await issueTokenPair(user);
  created(res, { user, ...tokens }, 'Registration successful');
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email / wrong password to avoid user enumeration
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');
  const tokens = await issueTokenPair(user);
  ok(res, { user, ...tokens }, 'Login successful');
});

// Refresh-token rotation: each refresh token is single-use. Re-use of an old token revokes all sessions.
exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid refresh token');

  const hash = hashToken(refreshToken);
  const known = user.refreshTokens.some((t) => t.tokenHash === hash);
  if (!known) {
    await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } }); // possible token theft
    throw ApiError.unauthorized('Refresh token has been revoked. Please log in again');
  }
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { tokenHash: hash } } });
  const tokens = await issueTokenPair(user);
  ok(res, tokens, 'Token refreshed');
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const payload = verifyRefreshToken(refreshToken);
  await User.updateOne({ _id: payload.sub }, { $pull: { refreshTokens: { tokenHash: hashToken(refreshToken) } } });
  ok(res, undefined, 'Logged out');
});
