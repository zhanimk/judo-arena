const express = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const clubsRoutes = require('./clubs.routes');
const tournamentsRoutes = require('./tournaments.routes');
const applicationsRoutes = require('./applications.routes');
const bracketsRoutes = require('./brackets.routes');
const matchesRoutes = require('./matches.routes');
const judgesRoutes = require('./judges.routes');
const adminRoutes = require('./admin.routes');
const notificationRoutes = require('./notifications.routes');
const tournamentLiveRoutes = require('./tournament-live.routes');
const uploadRoutes = require('./uploads.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/clubs', clubsRoutes);
router.use('/tournaments', tournamentsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/brackets', bracketsRoutes);
router.use('/matches', matchesRoutes);
router.use('/judges', judgesRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tournament-live', tournamentLiveRoutes);
router.use('/uploads', uploadRoutes);

module.exports = router;
