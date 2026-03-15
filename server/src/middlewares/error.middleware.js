const mongoose = require('mongoose');

function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let details = err.details || null;

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error';
    code = 'DUPLICATE_KEY';
    details = err.keyValue || null;
  }

  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
    code = 'INVALID_OBJECT_ID';
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    details,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

module.exports = errorMiddleware;
