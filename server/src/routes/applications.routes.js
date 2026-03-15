const express = require('express');

const applicationController = require('../controllers/application.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdParamSchema,
  tournamentApplicationsParamSchema,
  rejectApplicationSchema,
} = require('../validators/application.validator');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Applications
 *   description: Tournament application management
 */

/**
 * @swagger
 * /applications:
 *   post:
 *     summary: Create tournament application
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Application created
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(createApplicationSchema),
  applicationController.createApplication
);

/**
 * @swagger
 * /applications/{id}:
 *   put:
 *     summary: Update application
 *     tags: [Applications]
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
 *         description: Application updated
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/:id',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(updateApplicationSchema),
  applicationController.updateApplication
);

/**
 * @swagger
 * /applications/my:
 *   get:
 *     summary: Get my applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of applications
 */
router.get(
  '/my',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  applicationController.getMyApplications
);

/**
 * @swagger
 * /applications/{id}:
 *   get:
 *     summary: Get application by id
 *     tags: [Applications]
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
 *         description: Application details
 *       404:
 *         description: Application not found
 */
router.get(
  '/:id',
  authMiddleware,
  validate(applicationIdParamSchema),
  applicationController.getApplicationById
);

/**
 * @swagger
 * /applications/tournament/{tournamentId}:
 *   get:
 *     summary: Get applications by tournament
 *     tags: [Applications]
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
 *         description: Tournament applications
 */
router.get(
  '/tournament/:tournamentId',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentApplicationsParamSchema),
  applicationController.getApplicationsByTournament
);

/**
 * @swagger
 * /applications/{id}/submit:
 *   patch:
 *     summary: Submit application
 *     tags: [Applications]
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
 *         description: Application submitted
 */
router.patch(
  '/:id/submit',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.submitApplication
);

/**
 * @swagger
 * /applications/{id}/review:
 *   patch:
 *     summary: Mark application under review
 *     tags: [Applications]
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
 *         description: Application marked as under review
 */

router.patch(
  '/:id/review',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.markUnderReview
);

/**
 * @swagger
 * /applications/{id}/approve:
 *   patch:
 *     summary: Approve application
 *     tags: [Applications]
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
 *         description: Application approved
 */
router.patch(
  '/:id/approve',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.approveApplication
);

/**
 * @swagger
 * /applications/{id}/reject:
 *   patch:
 *     summary: Reject application
 *     tags: [Applications]
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
 *         description: Application rejected
 */
router.patch(
  '/:id/reject',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(rejectApplicationSchema),
  applicationController.rejectApplication
);

module.exports = router;