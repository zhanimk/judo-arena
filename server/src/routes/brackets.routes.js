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

/**
 * @swagger
 * tags:
 *   name: Brackets
 *   description: Tournament bracket management
 */

/**
 * @swagger
 * /brackets/generate/{tournamentId}:
 *   post:
 *     summary: Generate brackets for tournament
 *     tags: [Brackets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Brackets generated
 *       400:
 *         description: Bracket generation failed
 */
router.post(
  '/generate/:tournamentId',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentIdParamSchema),
  bracketController.generateBrackets
);

/**
 * @swagger
 * /brackets/tournament/{tournamentId}:
 *   get:
 *     summary: Get brackets for tournament
 *     tags: [Brackets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament brackets
 */
router.get(
  '/tournament/:tournamentId',
  authMiddleware,
  validate(tournamentIdParamSchema),
  bracketController.getBracketsByTournament
);

/**
 * @swagger
 * /brackets/{id}:
 *   get:
 *     summary: Get bracket by id
 *     tags: [Brackets]
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
 *         description: Bracket details
 *       404:
 *         description: Bracket not found
 */
router.get(
  '/:id',
  authMiddleware,
  validate(bracketIdParamSchema),
  bracketController.getBracketById
);

/**
 * @swagger
 * /brackets/{id}/matches:
 *   get:
 *     summary: Get matches for bracket
 *     tags: [Brackets]
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
 *         description: Bracket matches
 */

router.get(
  '/:id/matches',
  authMiddleware,
  validate(bracketIdParamSchema),
  bracketController.getBracketMatches
);

module.exports = router;