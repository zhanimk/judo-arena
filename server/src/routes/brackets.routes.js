const express = require('express');

const bracketController = require('../controllers/bracket.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  tournamentIdParamSchema,
  bracketIdParamSchema,
} = require('../validators/bracket.validator');

const router = express.Router();

router.post(
  '/generate/:tournamentId',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  bracketController.generateBrackets
);

router.get(
  '/tournament/:tournamentId',
  authMiddleware,
  validate(tournamentIdParamSchema),
  bracketController.getBracketsByTournament
);

router.get(
  '/:id',
  authMiddleware,
  validate(bracketIdParamSchema),
  bracketController.getBracketById
);

router.get(
  '/:id/matches',
  authMiddleware,
  validate(bracketIdParamSchema),
  bracketController.getBracketMatches
);

module.exports = router;