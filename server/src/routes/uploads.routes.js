const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/upload.controller');

router.get('/:filename', uploadController.getFile);

module.exports = router;