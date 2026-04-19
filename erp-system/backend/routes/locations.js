const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, locationController.getAllLocations);
router.get('/states', authenticateToken, locationController.getStates);
router.get('/cities/:stateId', authenticateToken, locationController.getCitiesByState);

router.post('/states', authenticateToken, requireRole('admin'), locationController.createState);
router.post('/cities', authenticateToken, requireRole('admin'), locationController.createCity);

module.exports = router;
