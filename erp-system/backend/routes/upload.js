const express = require('express');
const router = express.Router();
const { upload, uploadFile, uploadMem, uploadPhotoProof } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, upload.single('photo'), uploadFile);

// Daily-Entry Photo Proof → private S3, returns { key }
router.post('/photo-proof', authenticateToken, uploadMem.single('photo'), uploadPhotoProof);

module.exports = router;
