const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/accountingController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// Financial Years
router.get('/financial-years',       auth, ctrl.getFinancialYears);
router.post('/financial-years',      auth, admin, ctrl.createFinancialYear);
router.put('/financial-years/:id/activate', auth, admin, ctrl.setActiveFY);

// Chart of Accounts
router.get('/accounts',              auth, ctrl.getAccounts);
router.post('/accounts',             auth, admin, ctrl.createAccount);
router.put('/accounts/:id',          auth, admin, ctrl.updateAccount);

// Journal Entries
router.get('/journal',               auth, ctrl.getJournalEntries);
router.get('/journal/:id',           auth, ctrl.getJournalEntry);
router.post('/journal',              auth, admin, ctrl.createJournalEntry);
router.post('/journal/:id/reverse',  auth, admin, ctrl.reverseJournalEntry);

// Vouchers
router.get('/vouchers',              auth, ctrl.getVouchers);
router.post('/vouchers',             auth, admin, ctrl.createVoucher);

// Reports
router.get('/ledger',                auth, ctrl.getLedger);
router.get('/trial-balance',         auth, ctrl.getTrialBalance);
router.get('/profit-loss',           auth, ctrl.getProfitLoss);
router.get('/balance-sheet',         auth, ctrl.getBalanceSheet);
router.get('/day-book',              auth, ctrl.getDayBook);
router.get('/cash-book',             auth, ctrl.getCashBook);
router.get('/bank-book',             auth, ctrl.getBankBook);
router.get('/gst-ledger',            auth, ctrl.getGSTLedger);

module.exports = router;
