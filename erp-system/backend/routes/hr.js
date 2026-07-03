const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/hrController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/stats',                 auth, ctrl.getHRStats);
router.get('/employees',             auth, ctrl.listEmployees);
router.get('/employees/:id',         auth, ctrl.getEmployee);
router.post('/employees',            auth, admin, ctrl.createEmployee);
router.put('/employees/:id',         auth, admin, ctrl.updateEmployee);

router.get('/attendance',            auth, ctrl.getAttendance);
router.post('/attendance',           auth, admin, ctrl.markAttendance);

router.get('/salary-slips',          auth, ctrl.getSalarySlips);
router.post('/salary-slips/generate',auth, admin, ctrl.generateSalary);
router.put('/salary-slips/:id/approve', auth, admin, ctrl.approveSalarySlip);

router.get('/leaves',                auth, ctrl.getLeaves);
router.post('/leaves',               auth, ctrl.applyLeave);
router.put('/leaves/:id/approve',    auth, admin, ctrl.approveLeave);

router.get('/tailor-work',           auth, ctrl.getTailorWork);
router.post('/tailor-work',          auth, admin, ctrl.addTailorWork);
router.post('/tailor-work/mark-paid',auth, admin, ctrl.markTailorPaid);

module.exports = router;
