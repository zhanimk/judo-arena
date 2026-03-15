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

router.get('/', clubController.getClubs);

router.get(
  '/:id',
  validate(clubIdParamSchema),
  clubController.getClubById
);

router.post(
  '/',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(createClubSchema),
  clubController.createClub
);

router.put(
  '/:id',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(updateClubSchema),
  clubController.updateClub
);

router.post(
  '/:id/join-request',
  authMiddleware,
  allowRoles('ATHLETE'),
  validate(clubIdParamSchema),
  clubController.sendJoinRequest
);

router.patch(
  '/:id/members/:athleteId/approve',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.approveAthlete
);

router.patch(
  '/:id/members/:athleteId/reject',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.rejectAthlete
);

router.patch(
  '/:id/members/:athleteId/remove',
  authMiddleware,
  allowRoles('COACH', 'ADMIN'),
  validate(clubAthleteParamSchema),
  clubController.removeAthlete
);

module.exports = router;