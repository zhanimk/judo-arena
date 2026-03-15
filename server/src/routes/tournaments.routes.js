const express = require('express');

const tournamentController = require('../controllers/tournament.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  createTournamentSchema,
  updateTournamentSchema,
  tournamentIdParamSchema,
  updateTournamentStatusSchema,
  updateTournamentVisibilitySchema,
  updateTournamentCategoriesSchema,
} = require('../validators/tournament.validator');

const router = express.Router();

router.get('/', authMiddleware, tournamentController.getTournaments);

router.get(
  '/:id',
  authMiddleware,
  validate(tournamentIdParamSchema),
  tournamentController.getTournamentById
);

router.post(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(createTournamentSchema),
  tournamentController.createTournament
);

router.put(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentSchema),
  tournamentController.updateTournament
);

router.delete(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.deleteTournament
);

router.patch(
  '/:id/status',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentStatusSchema),
  tournamentController.updateTournamentStatus
);

router.patch(
  '/:id/visibility',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentVisibilitySchema),
  tournamentController.updateTournamentVisibility
);

router.patch(
  '/:id/publish',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.publishTournament
);

router.patch(
  '/:id/unpublish',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.unpublishTournament
);

router.patch(
  '/:id/archive',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.archiveTournament
);

router.patch(
  '/:id/restore',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.restoreTournament
);

router.patch(
  '/:id/categories',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentCategoriesSchema),
  tournamentController.updateTournamentCategories
);

module.exports = router;