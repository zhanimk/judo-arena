const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Authorization token is missing', 'UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return next(new ApiError(401, 'User not found', 'USER_NOT_FOUND'));
    }

    if (user.status === 'BLOCKED' || user.isActive === false) {
      return next(new ApiError(403, 'Account is blocked or inactive', 'ACCOUNT_BLOCKED'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new ApiError(401, 'Invalid or expired token', 'INVALID_TOKEN'));
  }
}

module.exports = authMiddleware;
