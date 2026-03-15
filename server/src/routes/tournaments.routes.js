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

/**
 * @swagger
 * tags:
 *   name: Tournaments
 *   description: Tournament management API
 */

/**
 * @swagger
 * /tournaments:
 *   get:
 *     summary: Get list of tournaments
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tournaments
 */
router.get('/', authMiddleware, tournamentController.getTournaments);

/**
 * @swagger
 * /tournaments/{id}:
 *   get:
 *     summary: Get tournament by id
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament details
 *       404:
 *         description: Tournament not found
 */
router.get(
  '/:id',
  authMiddleware,
  validate(tournamentIdParamSchema),
  tournamentController.getTournamentById
);

/**
 * @swagger
 * /tournaments:
 *   post:
 *     summary: Create tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tournament created
 */
router.post(
  '/',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(createTournamentSchema),
  tournamentController.createTournament
);

/**
 * @swagger
 * /tournaments/{id}:
 *   put:
 *     summary: Update tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament updated
 */
router.put(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentSchema),
  tournamentController.updateTournament
);

/**
 * @swagger
 * /tournaments/{id}:
 *   delete:
 *     summary: Delete tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament deleted
 */
router.delete(
  '/:id',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.deleteTournament
);

/**
 * @swagger
 * /tournaments/{id}/status:
 *   patch:
 *     summary: Update tournament status
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament status updated
 */
router.patch(
  '/:id/status',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentStatusSchema),
  tournamentController.updateTournamentStatus
);

/**
 * @swagger
 * /tournaments/{id}/visibility:
 *   patch:
 *     summary: Update tournament visibility
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament visibility updated
 */
router.patch(
  '/:id/visibility',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentVisibilitySchema),
  tournamentController.updateTournamentVisibility
);

/**
 * @swagger
 * /tournaments/{id}/publish:
 *   patch:
 *     summary: Publish tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament published
 */
router.patch(
  '/:id/publish',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.publishTournament
);

/**
 * @swagger
 * /tournaments/{id}/unpublish:
 *   patch:
 *     summary: Unpublish tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament unpublished
 */
router.patch(
  '/:id/unpublish',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.unpublishTournament
);

/**
 * @swagger
 * /tournaments/{id}/archive:
 *   patch:
 *     summary: Archive tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament archived
 */
router.patch(
  '/:id/archive',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.archiveTournament
);

/**
 * @swagger
 * /tournaments/{id}/restore:
 *   patch:
 *     summary: Restore archived tournament
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament restored
 */
router.patch(
  '/:id/restore',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  tournamentController.restoreTournament
);

/**
 * @swagger
 * /tournaments/{id}/categories:
 *   patch:
 *     summary: Update tournament categories
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories updated
 */
router.patch(
  '/:id/categories',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(updateTournamentCategoriesSchema),
  tournamentController.updateTournamentCategories
);

module.exports = router;