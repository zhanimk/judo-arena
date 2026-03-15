const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function getMyProfile(userId) {
  const user = await User.findById(userId).select('-passwordHash');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

async function updateMyProfile(userId, payload) {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const allowedFields = [
    'fullName',
    'dateOfBirth',
    'gender',
    'city',
    'weight',
    'rank',
  ];

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      user[field] = payload[field];
    }
  });

  await user.save();

  return user.toJSON();
}

async function getUserById(targetUserId) {
  const user = await User.findById(targetUserId)
    .select('-passwordHash')
    .populate('clubId', 'name city')
    .populate('coachId', 'fullName email role');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

async function updateUserStatus(targetUserId, status) {
  const allowedStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid user status', 'INVALID_USER_STATUS');
  }

  const user = await User.findById(targetUserId);

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  user.status = status;
  user.isActive = status !== 'BLOCKED' && status !== 'INACTIVE';

  await user.save();

  return user.toJSON();
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getUserById,
  updateUserStatus,
};