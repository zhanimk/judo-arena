const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');

const listUsers = asyncHandler(async (req, res) => {
  const data = await userService.listUsers(req.query);

  res.status(200).json({
    success: true,
    data,
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getMyProfile(req.user._id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateMyProfile(req.user._id, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.status);

  res.status(200).json({
    success: true,
    message: 'User status updated successfully',
    data: user,
  });
});

module.exports = {
  listUsers,
  getProfile,
  updateProfile,
  getUserById,
  updateUserStatus,
};
