const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

// validate(schema, 'body' | 'query' | 'params') - Joi validation + sanitisation
exports.validate = (schema, source = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(ApiError.badRequest('Validation failed', details));
  }
  if (source === 'query') {
    // Express 4 allows reassigning; keep sanitised values
    req.query = value;
  } else {
    req[source] = value;
  }
  next();
};

// Ensures :id style params are valid Mongo ObjectIds
exports.validateObjectId = (...names) => (req, _res, next) => {
  for (const n of names.length ? names : ['id']) {
    if (!mongoose.isValidObjectId(req.params[n])) return next(ApiError.badRequest(`Invalid ${n}`));
  }
  next();
};
