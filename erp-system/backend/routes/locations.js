const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/states', authenticateToken, requireRole('admin'), locationController.createState);
router.get('/states', authenticateToken, locationController.getStates);

router.post('/cities', authenticateToken, requireRole('admin'), locationController.createCity);
router.get('/cities/:stateId', authenticateToken, locationController.getCitiesByState);

module.exports = router;
