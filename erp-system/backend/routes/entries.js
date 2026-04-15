const express = require('express');
const router = express.Router();
const entryController = require('../controllers/entryController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, entryController.createEntry);
router.put('/:id', authenticateToken, entryController.updateEntry);
router.get('/', authenticateToken, entryController.getEntries);
router.post('/:id/unlock', authenticateToken, requireRole('admin'), entryController.unlockEntry);

module.exports = router;
