const express = require('express');

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  registerSchema,
  loginSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post(
  '/register',
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  validate(loginSchema),
  authController.login
);

router.get(
  '/me',
  authMiddleware,
  authController.me
);

module.exports = router;
