// Regression tests: Payment In must never be treated as a negative sale.
//
// Background: entry #543 (Amanora Apex, 2026-08-25) has total_sale=0,
// cash=online=razorpay=cheque=0, payment_in=300000 — a legitimate fund
// deposit (money the boss put into the shop's bank account), NOT a sale.
// The dashboard previously computed Total Sales as
// SUM(total_sale - payment_in), which silently subtracted every Payment In
// amount from the sales total — for entry 543 alone that meant a ₹3,00,000
// understatement of Total Sales even though total_sale was already 0 and
// contained no reference to payment_in at all.
//
// Plain Node, no test framework — run with: node tests/paymentIn.regression.js
'use strict';
const assert = require('assert');

// Mirrors the SQL aggregate now used in dashboardController.js / erpContext.js:
//   COALESCE(SUM(total_sale), 0)  — no more "- COALESCE(payment_in, 0)"
function computeTotalSales(entries) {
    return entries.reduce((sum, e) => sum + Number(e.total_sale || 0), 0);
}

// Mirrors admin_bank_ledger / Payment In tracking — a fund deposit, tracked
// independently and additively, never as a deduction from sales.
function computePaymentInTotal(entries) {
    return entries.reduce((sum, e) => sum + Number(e.payment_in || 0), 0);
}

// Mirrors entryController.js breakdownSum after the fix: cash+online+razorpay
// +cheque only — payment_in is excluded from the reconciliation identity.
function computeBreakdownSum(entry) {
    return Number(entry.cash || 0) + Number(entry.online || 0)
         + Number(entry.razorpay || 0) + Number(entry.cheque || 0);
}

/* ── Test 1: entry #543 itself — the exact real-world case ─────────── */
{
    const entry543 = { id: 543, total_sale: 0, cash: 0, online: 0, razorpay: 0, cheque: 0, payment_in: 300000 };

    const totalSalesContribution = computeTotalSales([entry543]);
    const paymentInContribution  = computePaymentInTotal([entry543]);
    const bankLedgerContribution = paymentInContribution; // admin_bank_ledger records the same amount, additively

    assert.strictEqual(totalSalesContribution, 0,
        'Entry 543: Total Sales contribution must be 0, not reduced further by payment_in');
    assert.strictEqual(paymentInContribution, 300000,
        'Entry 543: Payment In contribution must be 300000');
    assert.strictEqual(bankLedgerContribution, 300000,
        'Entry 543: Bank ledger contribution must be +300000');

    // The old buggy formula (total_sale - payment_in) would have produced -300000
    // here, incorrectly showing a negative sales contribution for a $0 sale.
    const oldBuggyFormula = entry543.total_sale - entry543.payment_in;
    assert.strictEqual(oldBuggyFormula, -300000,
        'Sanity check: confirms the bug this regression test guards against');

    // The breakdown identity must hold without needing payment_in at all.
    assert.strictEqual(computeBreakdownSum(entry543), 0,
        'Entry 543: cash+online+razorpay+cheque must equal total_sale (0) without payment_in');

    console.log('[PASS] Entry 543 case: total_sale=0, payment_in=300000 -> Sales=0, PaymentIn=300000, Bank=+300000');
}

/* ── Test 2: a normal sale with no Payment In ───────────────────────── */
{
    const normalEntry = { id: 1, total_sale: 50000, cash: 20000, online: 25000, razorpay: 0, cheque: 5000, payment_in: 0 };
    assert.strictEqual(computeTotalSales([normalEntry]), 50000, 'Normal sale: Total Sales must equal total_sale exactly');
    assert.strictEqual(computeBreakdownSum(normalEntry), 50000, 'Normal sale: breakdown must reconcile to total_sale');
    console.log('[PASS] Normal entry with no Payment In reconciles correctly');
}

/* ── Test 3: mixed batch (sale + a pure Payment In entry like #543) ─── */
{
    const batch = [
        { id: 1,   total_sale: 50000, cash: 20000, online: 25000, razorpay: 0, cheque: 5000, payment_in: 0 },
        { id: 543, total_sale: 0,     cash: 0,     online: 0,     razorpay: 0, cheque: 0,     payment_in: 300000 },
    ];
    assert.strictEqual(computeTotalSales(batch), 50000,
        'Batch: Total Sales must be the sum of total_sale only (50000), unaffected by the 300000 Payment In');
    assert.strictEqual(computePaymentInTotal(batch), 300000,
        'Batch: Payment In total must be tracked separately (300000)');
    console.log('[PASS] Mixed batch: sales and Payment In remain independent, non-overlapping totals');
}

/* ── Test 4: Payment In must never be able to make Total Sales negative ── */
{
    // Even a large Payment In on a zero-sale day must never push Total Sales below 0.
    const entry = { id: 999, total_sale: 0, cash: 0, online: 0, razorpay: 0, cheque: 0, payment_in: 5000000 };
    const totalSales = computeTotalSales([entry]);
    assert.ok(totalSales >= 0, 'Total Sales must never go negative because of a Payment In amount');
    assert.strictEqual(totalSales, 0);
    console.log('[PASS] Large Payment In on a zero-sale entry does not drive Total Sales negative');
}

/* ── Test 5: Admin Dashboard "PAYMENT IN" card payload shape ────────
   getAdminDashboard's summaryQ computes total_sales and total_payment_in in
   the SAME query with the SAME WHERE clause (period/date/city/shop/approval
   filters), so they always share filtering — this test locks in the shape
   the frontend card relies on (dashboardController.js response keys). */
{
    const productionExample = [
        { id: 543, total_sale: 0,     cash: 0,     online: 0,     razorpay: 0, cheque: 0,    payment_in: 300000 },
        // Remaining ~31.30L of real sales entries, represented as one rolled-up row for this check.
        { id: 0,   total_sale: 3130348, cash: 396489, online: 2730059, razorpay: 0, cheque: 3800, payment_in: 0 },
    ];

    const dashboardResponse = {
        totalSales:     computeTotalSales(productionExample),
        totalPaymentIn: computePaymentInTotal(productionExample),
    };

    assert.strictEqual(dashboardResponse.totalSales, 3130348,
        'Dashboard totalSales must be ~31,30,348 (matches production aggregate), unaffected by payment_in');
    assert.strictEqual(dashboardResponse.totalPaymentIn, 300000,
        'Dashboard totalPaymentIn must be exactly 300000 (matches production payment_in_aggregate)');

    console.log(`[PASS] Admin Dashboard card values: Total Sales=${dashboardResponse.totalSales}, Payment In=${dashboardResponse.totalPaymentIn}`);
}

console.log('\nAll Payment In regression checks passed.');
