const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/crmController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/dashboard',             auth, ctrl.getCRMDashboard);
router.get('/birthdays',             auth, ctrl.getBirthdayReminders);

router.get('/leads',                 auth, ctrl.getLeads);
router.get('/leads/:id',             auth, ctrl.getLead);
router.post('/leads',                auth, ctrl.createLead);
router.put('/leads/:id',             auth, ctrl.updateLead);
router.post('/leads/:id/convert',    auth, admin, ctrl.convertLead);

router.get('/followups',             auth, ctrl.getFollowups);
router.post('/followups',            auth, ctrl.addFollowup);

router.get('/quotations',            auth, ctrl.getQuotations);
router.post('/quotations',           auth, ctrl.createQuotation);
router.put('/quotations/:id/status', auth, ctrl.updateQuotationStatus);

router.get('/tasks',                 auth, ctrl.getTasks);
router.post('/tasks',                auth, ctrl.createTask);
router.put('/tasks/:id',             auth, ctrl.updateTask);

module.exports = router;
