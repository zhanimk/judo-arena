const express = require('express');

const controller = require('../controllers/notification.controller');

const auth = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', auth, controller.getMyNotifications);

router.patch('/:id/read', auth, controller.markRead);

router.patch('/read-all', auth, controller.markAllRead);

module.exports = router;