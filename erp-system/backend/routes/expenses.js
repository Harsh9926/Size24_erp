const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/expenseController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get(   '/',    authenticateToken, requireRole('admin', 'manager'), ctrl.getExpenses);
router.post(  '/',    authenticateToken, requireRole('admin', 'manager'), ctrl.createExpense);
router.put(   '/:id', authenticateToken, requireRole('admin', 'manager'), ctrl.updateExpense);
router.delete('/:id', authenticateToken, requireRole('admin'),            ctrl.deleteExpense);

module.exports = router;
