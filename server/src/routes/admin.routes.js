const express = require('express');

const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const { overrideMatchSchema } = require('../validators/admin.validator');

const router = express.Router();

router.patch(
  "/matches/:id/override",
  authMiddleware,
  allowRoles("ADMIN"),
  validate(overrideMatchSchema),
  adminController.overrideMatchResult
);

router.patch(
  "/matches/:id/replay",
  authMiddleware,
  allowRoles("ADMIN"),
  adminController.requireReplay
);

router.patch(
  "/matches/:id/rollback",
  authMiddleware,
  allowRoles("ADMIN"),
  adminController.rollbackBracket
);

module.exports = router;