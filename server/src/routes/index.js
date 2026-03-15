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

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/clubs', clubsRoutes);
router.use('/tournaments', tournamentsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/brackets', bracketsRoutes);
router.use('/matches', matchesRoutes);
router.use('/judges', judgesRoutes);
router.use("/admin", adminRoutes);
router.use('/notifications', notificationRoutes);

// TODO:
// router.use('/admin', require('./admin.routes'));
// router.use('/uploads', require('./uploads.routes'));
// router.use('/notifications', require('./notifications.routes'));

module.exports = router;