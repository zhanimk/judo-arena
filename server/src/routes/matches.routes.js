const express = require('express');

const matchController = require('../controllers/match.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  matchIdParamSchema,
  myMatchesQuerySchema,
  updateScoreSchema,
  updatePenaltiesSchema,
  finishMatchSchema,
  reopenMatchSchema,
  tournamentIdParamSchema,
} = require('../validators/match.validator');

const router = express.Router();

router.get(
  '/my',
  authMiddleware,
  allowRoles('ATHLETE'),
  validate(myMatchesQuerySchema),
  matchController.getMyMatches
);

router.get(
  '/tournament/:tournamentId',
  authMiddleware,
  allowRoles('ADMIN', 'JUDGE'),
  validate(tournamentIdParamSchema),
  matchController.getMatchesByTournament
);

router.get(
  '/:id',
  authMiddleware,
  validate(matchIdParamSchema),
  matchController.getMatchById
);

router.patch(
  '/:id/start',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(matchIdParamSchema),
  matchController.startMatch
);

router.patch(
  '/:id/score',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(updateScoreSchema),
  matchController.updateScore
);

router.patch(
  '/:id/penalties',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(updatePenaltiesSchema),
  matchController.updatePenalties
);

router.patch(
  '/:id/finish',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(finishMatchSchema),
  matchController.finishMatch
);

router.patch(
  '/:id/reopen',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(reopenMatchSchema),
  matchController.reopenMatch
);

module.exports = router;
