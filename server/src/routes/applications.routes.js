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

router.post(
  '/',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(createApplicationSchema),
  applicationController.createApplication
);

router.put(
  '/:id',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(updateApplicationSchema),
  applicationController.updateApplication
);

router.get(
  '/my',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  applicationController.getMyApplications
);

router.get(
  '/:id',
  authMiddleware,
  validate(applicationIdParamSchema),
  applicationController.getApplicationById
);

router.get(
  '/tournament/:tournamentId',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(tournamentApplicationsParamSchema),
  applicationController.getApplicationsByTournament
);

router.patch(
  '/:id/submit',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.submitApplication
);

router.patch(
  '/:id/review',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.markUnderReview
);

router.patch(
  '/:id/approve',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(applicationIdParamSchema),
  applicationController.approveApplication
);

router.patch(
  '/:id/reject',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(rejectApplicationSchema),
  applicationController.rejectApplication
);

module.exports = router;