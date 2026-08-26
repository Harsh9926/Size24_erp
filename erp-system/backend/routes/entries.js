const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/entryController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkAction } = require('../middleware/checkPermission');

// ── IMPORTANT: Named routes MUST come before /:id param routes ────
// GET /pending would match /:id = "pending" if placed after put('/:id')

// NOTE on GET '/', POST '/', PUT '/:id': these are shared by shop_user
// (submitting/viewing their OWN entry) and admin/manager (viewing/creating/
// editing ANY entry). ROLE_DEFAULTS.shop_user.entries is NO_ACCESS in the
// existing module-permission system (it was designed for the admin/manager
// RBAC surface, not the core shop_user submission pipeline). checkAction()
// is applied below with { exemptRoles: ['shop_user'] } — shop_user's request
// skips the permission layer entirely and falls straight through to the
// controller's existing role branching (entryController.js already scopes
// shop_user to req.user.shopId and blocks cross-shop access there — that
// business logic is untouched). admin/manager requests ARE now gated by
// entries.view/create/edit, closing the gap from Phase 1's first pass.
//
// entries.submit: there is no separate "submit" action in the codebase —
// POST '/' IS the submission endpoint for shop_user, and the identical
// business operation for admin/manager (auto-approved on create). It is
// gated here via entries.create (the one real action that exists); there is
// no additional entries.submit-specific route to enforce independently.

// ── Admin-only named routes ───────────────────────────────────────
router.get(  '/pending',      authenticateToken, requireRole('admin', 'manager'), checkAction('entries.view'), ctrl.getPendingEntries);
router.get(  '/today-status', authenticateToken, requireRole('admin', 'manager'), checkAction('entries.view'), ctrl.getTodayStatus);
router.post( '/bulk-action',  authenticateToken, requireRole('admin', 'manager'),
             checkAction(req => req.body.action === 'reject' ? 'entries.reject' : 'entries.approve'), ctrl.bulkAction);

// ── Shop user / general ───────────────────────────────────────────
router.get( '/',              authenticateToken, checkAction('entries.view',   { exemptRoles: ['shop_user'] }), ctrl.getEntries);
router.get( '/:id/photo-proof', authenticateToken, requireRole('admin', 'manager'), checkAction('entries.view'), ctrl.getEntryPhotoProof);
router.post('/',              authenticateToken, checkAction('entries.create', { exemptRoles: ['shop_user'] }), ctrl.createEntry);
router.put( '/:id',          authenticateToken, checkAction('entries.edit',    { exemptRoles: ['shop_user'] }), ctrl.updateEntry);

// ── Admin param routes ────────────────────────────────────────────
router.post(  '/:id/approve',  authenticateToken, requireRole('admin', 'manager'), checkAction('entries.approve'), ctrl.approveEntry);
router.post(  '/:id/reject',   authenticateToken, requireRole('admin', 'manager'), checkAction('entries.reject'),  ctrl.rejectEntry);
router.post(  '/:id/unlock',   authenticateToken, requireRole('admin'),          checkAction('entries.unlock'),   ctrl.unlockEntry);
router.delete('/:id',          authenticateToken, requireRole('admin'),          checkAction('entries.delete'),   ctrl.deleteEntry);

module.exports = router;

