const express = require('express');
const router = express.Router();
const { upload, uploadFile } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, upload.single('photo'), uploadFile);

module.exports = router;
