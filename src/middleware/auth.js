const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

// Authentication: validates the Bearer access token and attaches req.user
exports.protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw ApiError.unauthorized('Missing or malformed Authorization header');
  const payload = verifyAccessToken(header.slice(7)); // JWT errors handled centrally
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated');
  req.user = user;
  next();
});

// Authorization (RBAC): allows only the listed roles
exports.restrictTo = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Role '${req.user.role}' is not allowed to access this resource`));
  }
  next();
};
