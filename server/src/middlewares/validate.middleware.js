const ApiError = require('../utils/ApiError');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const details = error.details.map((d) => ({
        message: d.message,
        path: d.path.join('.'),
      }));

      return next(
        new ApiError(
          400,
          'Validation error',
          'VALIDATION_ERROR',
          details
        )
      );
    }

    req.body = value.body;
    req.query = value.query;
    req.params = value.params;

    next();
  };
}

module.exports = validate;
