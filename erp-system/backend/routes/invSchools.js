const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/invSchoolsController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/',                    auth, ctrl.getSchools);
router.get('/:id',                 auth, ctrl.getSchool);
router.post('/',                   auth, admin, ctrl.createSchool);
router.put('/:id',                 auth, admin, ctrl.updateSchool);
router.get('/:id/products',        auth, ctrl.getSchoolProducts);
router.put('/:id/products',        auth, admin, ctrl.setSchoolProducts);
router.post('/:id/products',       auth, admin, ctrl.addSchoolProduct);
router.delete('/:id/products/:productId', auth, admin, ctrl.removeSchoolProduct);
router.get('/:id/stock',           auth, ctrl.getSchoolStock);

module.exports = router;
