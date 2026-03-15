const bcrypt = require('bcrypt');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

const REGISTERABLE_ROLES = ['ATHLETE', 'COACH'];

async function registerUser(payload) {
  const {
    fullName,
    email,
    password,
    role,
  } = payload;

  const normalizedEmail = email.trim().toLowerCase();

  if (!REGISTERABLE_ROLES.includes(role)) {
    throw new ApiError(400, 'Invalid role for self-registration', 'INVALID_ROLE');
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
  });

  const token = signToken({
    userId: user._id,
    role: user.role,
  });

  return {
    user: user.toJSON(),
    token,
  };
}

async function loginUser(payload) {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const { password } = payload;

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'BLOCKED' || user.isActive === false) {
    throw new ApiError(403, 'Account is blocked or inactive', 'ACCOUNT_BLOCKED');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken({
    userId: user._id,
    role: user.role,
  });

  return {
    user: user.toJSON(),
    token,
  };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId).select('-passwordHash');

  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
};