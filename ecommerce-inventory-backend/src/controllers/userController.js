const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');

exports.getMe = asyncHandler(async (req, res) => ok(res, req.user));

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  ['name', 'phone', 'password'].forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
  await user.save(); // pre-save hook re-hashes the password if changed
  if (req.body.password) await User.updateOne({ _id: user._id }, { $set: { refreshTokens: [] } }); // force re-login
  ok(res, user, 'Profile updated');
});

// ---- Admin ----
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) filter.$or = [{ name: new RegExp(escapeRegex(req.query.q), 'i') }, { email: new RegExp(escapeRegex(req.query.q), 'i') }];
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  ok(res, items, undefined, buildMeta(page, limit, total));
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user);
});

exports.updateUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id && (req.body.role || req.body.isActive === false)) {
    throw ApiError.badRequest('You cannot change your own role or deactivate yourself');
  }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user, 'User updated');
});

exports.deactivateUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw ApiError.badRequest('You cannot deactivate yourself');
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false, refreshTokens: [] }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user, 'User deactivated');
});

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
