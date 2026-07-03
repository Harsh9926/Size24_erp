const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/settingsController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin');

router.get('/settings',              auth, ctrl.getSettings);
router.put('/settings',              auth, admin, ctrl.updateSettings);
router.get('/settings/:key',         auth, ctrl.getSetting);

router.get('/branches',              auth, ctrl.getBranches);
router.post('/branches',             auth, admin, ctrl.createBranch);
router.put('/branches/:id',          auth, admin, ctrl.updateBranch);

router.get('/notif-templates',       auth, ctrl.getNotifTemplates);
router.post('/notif-templates',      auth, admin, ctrl.upsertNotifTemplate);

router.get('/notif-logs',            auth, ctrl.getNotifLogs);
router.post('/send-notification',    auth, ctrl.sendNotification);

// AI + Master Reports
router.get('/ai-insights',           auth, ctrl.getAIInsights);
router.get('/master-report',         auth, ctrl.getMasterReport);

module.exports = router;
