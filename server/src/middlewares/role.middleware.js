const ApiError = require('../utils/ApiError');

function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden: insufficient permissions', 'FORBIDDEN'));
    }

    next();
  };
}

module.exports = allowRoles;
