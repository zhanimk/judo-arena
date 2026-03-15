const express = require('express');

const clubController = require('../controllers/club.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  createClubSchema,
  updateClubSchema,
  clubIdParamSchema,
  clubAthleteParamSchema,
} = require('../validators/club.validator');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Clubs
 *   description: Club management API
 */

/**
 * @swagger
 * /clubs:
 *   get:
 *     summary: Get list of clubs
 *     tags: [Clubs]
 *     responses:
 *       200:
 *         description: List of clubs
 */
router.get('/', clubController.getClubs);

/**
 * @swagger
 * /clubs/{id}:
 *   get:
 *     summary: Get club by id
 *     tags: [Clubs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Club details
 *       404:
 *         description: Club not found
 */
router.get(
  '/:id',
  validate(clubIdParamSchema),
  clubController.getClubById
);

/**
 * @swagger
 * /clubs:
 *   post:
 *     summary: Create a new club
 *     tags: [Clubs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - city
 *             properties:
 *               name:
 *                 type: string
 *                 example: Astana Judo Club
 *               city:
 *                 type: string
 *                 example: Astana
 *     responses:
 *       201:
 *         description: Club created
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(createClubSchema),
  clubController.createClub
);

/**
 * @swagger
 * /clubs/{id}:
 *   put:
 *     summary: Update club
 *     tags: [Clubs]
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
 *         description: Club updated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put(
  '/:id',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(updateClubSchema),
  clubController.updateClub
);

/**
 * @swagger
 * /clubs/{id}/join-request:
 *   post:
 *     summary: Athlete requests to join club
 *     tags: [Clubs]
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
 *         description: Join request sent
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/join-request',
  authMiddleware,
  allowRoles('ATHLETE'),
  validate(clubIdParamSchema),
  clubController.sendJoinRequest
);

/**
 * @swagger
 * /clubs/{id}/members/{athleteId}/approve:
 *   patch:
 *     summary: Approve athlete to join club
 *     tags: [Clubs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Athlete approved
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/:id/members/:athleteId/approve',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.approveAthlete
);

/**
 * @swagger
 * /clubs/{id}/members/{athleteId}/reject:
 *   patch:
 *     summary: Reject athlete join request
 *     tags: [Clubs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Athlete rejected
 */
router.patch(
  '/:id/members/:athleteId/reject',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.rejectAthlete
);

/**
 * @swagger
 * /clubs/{id}/members/{athleteId}/remove:
 *   patch:
 *     summary: Remove athlete from club
 *     tags: [Clubs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: athleteId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Athlete removed
 */
router.patch(
  '/:id/members/:athleteId/remove',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.removeAthlete
);

module.exports = router;