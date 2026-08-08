const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// In-memory storage — buffer is handed to storageService (S3 or local disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Only image selfies are allowed'));
    },
});

const admin = requireRole('admin');
const adminOrManager = requireRole('admin', 'manager');

/* ── SELF (all authenticated roles: employee/manager/admin) ─────── */
router.get('/me',                    authenticateToken, ctrl.getMyStatus);
router.get('/me/history',            authenticateToken, ctrl.getMyHistory);
router.get('/me/monthly',            authenticateToken, ctrl.getMyMonthly);
router.post('/register',             authenticateToken, upload.single('selfie'), ctrl.register);
router.post('/punch-in',             authenticateToken, upload.single('selfie'), ctrl.punchIn);
router.post('/punch-out',            authenticateToken, upload.single('selfie'), ctrl.punchOut);
router.post('/location-change',      authenticateToken, upload.single('selfie'), ctrl.requestLocationChange);

/* ── Settings: read by anyone, write by admin ───────────────────── */
router.get('/settings',              authenticateToken, ctrl.getSettingsPublic);
router.put('/settings',              authenticateToken, admin, ctrl.updateSettings);

/* ── Admin/Manager dashboards + tables (shop-scoped for managers) ─ */
router.get('/dashboard',             authenticateToken, adminOrManager, ctrl.getDashboardCards);
router.get('/table',                 authenticateToken, adminOrManager, ctrl.getAttendanceTable);
router.get('/detail/:id',            authenticateToken, adminOrManager, ctrl.getAttendanceDetail);
router.get('/report',                authenticateToken, adminOrManager, ctrl.getMonthlyReport);
router.get('/export',                authenticateToken, adminOrManager, ctrl.exportReport);
router.get('/shops',                 authenticateToken, adminOrManager, ctrl.getScopedShops);

/* ── Admin-only approvals + config ──────────────────────────────── */
router.get('/registrations/pending', authenticateToken, admin, ctrl.getPendingRegistrations);
router.put('/registrations/:id/approve', authenticateToken, admin, ctrl.approveRegistration);
router.put('/registrations/:id/reject',  authenticateToken, admin, ctrl.rejectRegistration);
router.get('/location-changes/pending',  authenticateToken, admin, ctrl.getLocationChangeRequests);
router.put('/location-changes/:id/approve', authenticateToken, admin, ctrl.approveLocationChange);
router.put('/location-changes/:id/reject',  authenticateToken, admin, ctrl.rejectLocationChange);

module.exports = router;
