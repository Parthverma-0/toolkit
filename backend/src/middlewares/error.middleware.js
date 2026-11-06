const ApiError = require('../utils/ApiError');
const config = require('../config');
const { removeRequestFiles } = require('../services/storage.service');

const DUPLICATE_MESSAGES = {
  email: 'This email is already registered with another role',
  cin: 'A startup with this CIN is already registered',
  dpiitNumber: 'A startup with this DPIIT number is already registered',
  owner: 'You have already created a startup profile',
};

const notFound =(req, res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, details } = err;

  // Don't leave orphan files on disk when the request failed
  removeRequestFiles(req);

  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `${err.field} is too large` : err.message;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = DUPLICATE_MESSAGES[field] || `${field} already exists`;
  } else if (!(err instanceof ApiError) && statusCode === 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err instanceof ApiError && err.code && { code: err.code }),
    ...(details && { details }),
    ...(!config.isProd && statusCode === 500 && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
