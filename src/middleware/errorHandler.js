const ApiError = require('../utils/ApiError');
const { nodeEnv } = require('../config/env');

exports.notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// Centralized error handler: converts every error into the standard JSON envelope
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) { // Mongoose validation
    status = 400; message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400; message = `Invalid value for '${err.path}'`;
  } else if (err.code === 11000) { // duplicate key
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for '${field}'`;
  } else if (err.name === 'TokenExpiredError') {
    status = 401; message = 'Token expired';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    status = 401; message = 'Invalid token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
    if (nodeEnv === 'production') message = 'Internal server error';
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  if (nodeEnv !== 'production' && status >= 500) body.stack = err.stack;
  res.status(status).json(body);
};
