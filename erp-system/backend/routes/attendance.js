const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkAction } = require('../middleware/checkPermission');

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
// exemptRoles: ['shop_user'] on the gated ones below — shop_user's own
// punch/view-own workflow is NOT part of this RBAC surface (same reasoning
// as Entries/Manager Funds Phase 1/2: ROLE_DEFAULTS.shop_user.attendance is
// NO_ACCESS, module-level, by design — these routes must keep working for
// every employee regardless of what an admin sets in Access Control).
// /register and /location-change are NOT gated at all — one-time onboarding
// and correction-request actions with no corresponding key in the declared
// action matrix; flagged as a gap in the Phase 3 report rather than forcing
// a stretched mapping onto them.
router.get('/me',                    authenticateToken, checkAction('attendance.view_own', { exemptRoles: ['shop_user'] }), ctrl.getMyStatus);
router.get('/me/history',            authenticateToken, checkAction('attendance.view_own', { exemptRoles: ['shop_user'] }), ctrl.getMyHistory);
router.get('/me/monthly',            authenticateToken, checkAction('attendance.view_own', { exemptRoles: ['shop_user'] }), ctrl.getMyMonthly);
router.post('/register',             authenticateToken, upload.single('selfie'), ctrl.register);
router.post('/punch-in',             authenticateToken, checkAction('attendance.punch', { exemptRoles: ['shop_user'] }), upload.single('selfie'), ctrl.punchIn);
router.post('/punch-out',            authenticateToken, checkAction('attendance.punch', { exemptRoles: ['shop_user'] }), upload.single('selfie'), ctrl.punchOut);
router.post('/location-change',      authenticateToken, upload.single('selfie'), ctrl.requestLocationChange);

/* ── Settings: read by anyone, write by admin ───────────────────── */
// GET is deliberately left ungated — it's a public config read (shift
// timing/geofence) that the punch UI itself depends on for every role,
// including shop_user. Gating it would risk breaking the punch screen for
// employees. Only the sensitive write is permission-checked.
router.get('/settings',              authenticateToken, ctrl.getSettingsPublic);
router.put('/settings',              authenticateToken, admin, checkAction('attendance_settings.edit'), ctrl.updateSettings);

/* ── Admin/Manager dashboards + tables (shop-scoped for managers) ─ */
router.get('/dashboard',             authenticateToken, adminOrManager, checkAction('attendance.view_team'), ctrl.getDashboardCards);
router.get('/table',                 authenticateToken, adminOrManager, checkAction('attendance.view_team'), ctrl.getAttendanceTable);
router.get('/detail/:id',            authenticateToken, adminOrManager, checkAction('attendance.view_team'), ctrl.getAttendanceDetail);
router.get('/report',                authenticateToken, adminOrManager, checkAction('attendance_reports.view'),   ctrl.getMonthlyReport);
router.get('/export',                authenticateToken, adminOrManager, checkAction('attendance_reports.export'), ctrl.exportReport);
router.get('/shops',                 authenticateToken, adminOrManager, checkAction('attendance.view_team'), ctrl.getScopedShops);
router.get('/recent-activity',       authenticateToken, adminOrManager, checkAction('attendance.view_team'), ctrl.getRecentActivity);

/* ── Payroll: day status, salary config, salary calculation ─────── */
router.put('/day-status',            authenticateToken, adminOrManager, checkAction('attendance.edit'), ctrl.setDayStatus);
router.get('/employees',             authenticateToken, adminOrManager, checkAction('attendance_payroll.view'), ctrl.getEmployeeSalaries);
router.put('/employees/:userId/salary', authenticateToken, admin, checkAction('attendance_payroll.edit'), ctrl.setEmployeeSalary);
router.get('/payroll',               authenticateToken, adminOrManager, checkAction('attendance_payroll.view'), ctrl.getPayroll);

/* ── Per-employee attendance + payroll settings ─────────────────── */
router.get('/user-settings/:userId', authenticateToken, adminOrManager, checkAction('attendance_settings.view'), ctrl.getUserSettings);
router.put('/user-settings/:userId', authenticateToken, admin, checkAction('attendance_settings.edit'), ctrl.saveUserSettings);

/* ── Admin-only approvals + config ──────────────────────────────── */
router.get('/registrations/pending', authenticateToken, admin, checkAction('attendance_approvals.view'),    ctrl.getPendingRegistrations);
router.put('/registrations/:id/approve', authenticateToken, admin, checkAction('attendance_approvals.approve'), ctrl.approveRegistration);
router.put('/registrations/:id/reject',  authenticateToken, admin, checkAction('attendance_approvals.reject'),  ctrl.rejectRegistration);
router.get('/location-changes/pending',  authenticateToken, admin, checkAction('attendance_approvals.view'),    ctrl.getLocationChangeRequests);
router.put('/location-changes/:id/approve', authenticateToken, admin, checkAction('attendance_approvals.approve'), ctrl.approveLocationChange);
router.put('/location-changes/:id/reject',  authenticateToken, admin, checkAction('attendance_approvals.reject'),  ctrl.rejectLocationChange);

/* ── Attendance Assignment Module (Admin only) ──────────────────── */
router.get('/assignments',                          authenticateToken, admin, checkAction('attendance_assignments.view'), ctrl.getAttendanceAssignments);
router.get('/assignments/user/:userId',             authenticateToken, admin, checkAction('attendance_assignments.view'), ctrl.getUserAttendanceShops);
router.post('/assignments/user/:userId',            authenticateToken, admin, checkAction('attendance_assignments.edit'), ctrl.assignUserAttendanceShop);
router.delete('/assignments/user/:userId/shop/:shopId', authenticateToken, admin, checkAction('attendance_assignments.edit'), ctrl.unassignUserAttendanceShop);

module.exports = router;
