const express = require('express');
const router = express.Router();
const { uploadExcel, processExcel, getHistory, getOne, checkToday } = require('../controllers/excelController');
const { authenticateToken } = require('../middleware/auth');

router.post('/upload',       authenticateToken, uploadExcel.single('excel'), processExcel);
router.get('/history',       authenticateToken, getHistory);
router.get('/check-today',   authenticateToken, checkToday);   // ← before /:id
router.get('/:id',           authenticateToken, getOne);

module.exports = router;
