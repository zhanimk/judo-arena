const express = require('express');

const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/me', authMiddleware, dashboardController.getMyDashboard);

module.exports = router;
