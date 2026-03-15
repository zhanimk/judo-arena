const express = require('express');

const controller = require('../controllers/tournament-live.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { tournamentLiveParamSchema } = require('../validators/tournament-live.validator');

const router = express.Router();

router.get(
  '/:id/live',
  authMiddleware,
  validate(tournamentLiveParamSchema),
  controller.getTournamentLiveState
);

router.patch(
  '/:id/start',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentLiveParamSchema),
  controller.startTournament
);

router.patch(
  '/:id/pause',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentLiveParamSchema),
  controller.pauseTournament
);

router.patch(
  '/:id/resume',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentLiveParamSchema),
  controller.resumeTournament
);

router.patch(
  '/:id/complete',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentLiveParamSchema),
  controller.completeTournament
);

module.exports = router;