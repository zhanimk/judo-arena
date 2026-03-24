const express = require('express');

const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  getUserByIdSchema,
  updateMyProfileSchema,
  updateUserStatusSchema,
} = require('../validators/user.validator');

const router = express.Router();

router.get(
  '/profile',
  authMiddleware,
  userController.getProfile
);

router.put(
  '/profile',
  authMiddleware,
  validate(updateMyProfileSchema),
  userController.updateProfile
);


router.get(
  '/me/profile',
  authMiddleware,
  userController.getProfile
);

router.put(
  '/me/profile',
  authMiddleware,
  validate(updateMyProfileSchema),
  userController.updateProfile
);

router.get(
  '/:id',
  authMiddleware,
  validate(getUserByIdSchema),
  userController.getUserById
);

router.patch(
  '/:id/status',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateUserStatusSchema),
  userController.updateUserStatus
);

module.exports = router;