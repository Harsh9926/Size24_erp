'use strict';
const db = require('../config/db');

/* ── helpers ─────────────────────────────────────────────── */
async function nextJENumber(client) {
    const { rows } = await client.query(
        `UPDATE inv_counters SET last_number = last_number+1 WHERE counter_name='journal_entry' RETURNING last_number`
    );
    return `JE-${String(rows[0].last_number).padStart(5,'0')}`;
}
async function nextVoucherNumber(client, type) {
    const key = `voucher_${type}`;
    const pre = type === 'payment' ? 'PV' : type === 'receipt' ? 'RV' : 'CV';
    const { rows } = await client.query(
        `UPDATE inv_counters SET last_number = last_number+1 WHERE counter_name=$1 RETURNING last_number`, [key]
    );
    return `${pre}-${String(rows[0].last_number).padStart(5,'0')}`;
}

async function getActiveFY(client) {
    const { rows } = await (client || db).query(`SELECT id FROM acc_financial_years WHERE is_active=true LIMIT 1`);
    return rows[0]?.id || null;
}

/* ── auto-post journal entry ─────────────────────────────── */
async function postJournal(client, { entry_date, entry_type, narration, ref_type, ref_id, lines, created_by }) {
    const fy = await getActiveFY(client);
    const entry_number = await nextJENumber(client);
    const { rows: [je] } = await client.query(
        `INSERT INTO acc_journal_entries (entry_number,entry_date,entry_type,narration,ref_type,ref_id,financial_year_id,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [entry_number, entry_date || new Date().toISOString().split('T')[0], entry_type, narration, ref_type, ref_id, fy, created_by]
    );
    for (const l of lines) {
        await client.query(
            `INSERT INTO acc_journal_lines (entry_id, account_id, dr_amount, cr_amount, narration)
             VALUES ($1, $2, $3, $4, $5)`,
            [je.id, l.account_id, l.dr || 0, l.cr || 0, l.narration || narration]
        );
    }
    return je.id;
}
exports.postJournal = postJournal;

/* ── resolve account by code helper ─────────────────────── */
async function accountByCode(code) {
    const { rows } = await db.query(`SELECT id FROM acc_accounts WHERE code=$1`, [code]);
    return rows[0]?.id;
}
exports.accountByCode = accountByCode;

/* ── auto-post SALES invoice ─────────────────────────────── */
exports.autoPostSales = async (client, { invoice_id, invoice_date, customer_name, total, gst_total, taxable, cgst, sgst, igst, created_by }) => {
    const [ar, rev, cgstOut, sgstOut, igstOut] = await Promise.all([
        accountByCode('1130'), accountByCode('4100'), accountByCode('2121'), accountByCode('2122'), accountByCode('2123')
    ]);
    const lines = [{ account_id: ar, dr: total, narration: `Sales to ${customer_name}` }];
    if (taxable) lines.push({ account_id: rev, cr: taxable });
    if (cgst) lines.push({ account_id: cgstOut, cr: cgst });
    if (sgst) lines.push({ account_id: sgstOut, cr: sgst });
    if (igst) lines.push({ account_id: igstOut, cr: igst });
    await postJournal(client, { entry_date: invoice_date, entry_type: 'sales_auto', narration: `Sales Invoice #${invoice_id}`, ref_type: 'invoice', ref_id: invoice_id, lines, created_by });
};

/* ── auto-post PURCHASE ─────────────────────────────────── */
exports.autoPostPurchase = async (client, { purchase_id, purchase_date, supplier_name, total, gst_total, taxable, cgst, sgst, created_by }) => {
    const [ap, purchAcc, cgstIn, sgstIn] = await Promise.all([
        accountByCode('2110'), accountByCode('5110'), accountByCode('1151'), accountByCode('1152')
    ]);
    const lines = [
        { account_id: purchAcc, dr: taxable || total },
        ...(cgst ? [{ account_id: cgstIn, dr: cgst }] : []),
        ...(sgst ? [{ account_id: sgstIn, dr: sgst }] : []),
        { account_id: ap, cr: total },
    ];
    await postJournal(client, { entry_date: purchase_date, entry_type: 'purchase_auto', narration: `Purchase from ${supplier_name}`, ref_type: 'purchase', ref_id: purchase_id, lines, created_by });
};

/* ── auto-post EXPENSE ──────────────────────────────────── */
exports.autoPostExpense = async (client, { expense_id, expense_date, description, amount, expense_account_id, created_by }) => {
    const cash = await accountByCode('1110');
    const expAcc = expense_account_id || await accountByCode('5260');
    const lines = [{ account_id: expAcc, dr: amount }, { account_id: cash, cr: amount }];
    await postJournal(client, { entry_date: expense_date, entry_type: 'expense_auto', narration: `Expense: ${description}`, ref_type: 'expense', ref_id: expense_id, lines, created_by });
};

/* ═══════════════════════════════════════════════════════════
   API CONTROLLERS
═══════════════════════════════════════════════════════════ */

/* ── Chart of Accounts ─────────────────────────────────── */
exports.getAccounts = async (req, res) => {
    try {
        const { type, search } = req.query;
        let q = `SELECT a.*, p.name AS parent_name FROM acc_accounts a LEFT JOIN acc_accounts p ON p.id=a.parent_id WHERE 1=1`;
        const params = [];
        if (type) { params.push(type); q += ` AND a.type=$${params.length}`; }
        if (search) { params.push(`%${search}%`); q += ` AND (a.name ILIKE $${params.length} OR a.code ILIKE $${params.length})`; }
        q += ` ORDER BY a.code`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createAccount = async (req, res) => {
    try {
        const { code, name, type, sub_type, parent_id, is_group, gst_applicable, opening_dr, opening_cr, description } = req.body;
        const { rows: [acc] } = await db.query(
            `INSERT INTO acc_accounts (code,name,type,sub_type,parent_id,is_group,gst_applicable,opening_dr,opening_cr,description)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [code, name, type, sub_type, parent_id||null, is_group||false, gst_applicable||false, opening_dr||0, opening_cr||0, description||null]
        );
        res.json(acc);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, sub_type, parent_id, gst_applicable, opening_dr, opening_cr, description, is_active } = req.body;
        const { rows: [acc] } = await db.query(
            `UPDATE acc_accounts SET name=$1,sub_type=$2,parent_id=$3,gst_applicable=$4,opening_dr=$5,opening_cr=$6,description=$7,is_active=$8
             WHERE id=$9 AND is_system=false RETURNING *`,
            [name, sub_type, parent_id||null, gst_applicable||false, opening_dr||0, opening_cr||0, description||null, is_active!==false, id]
        );
        if (!acc) return res.status(404).json({ error: 'Account not found or is a system account' });
        res.json(acc);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Journal Entries ───────────────────────────────────── */
exports.getJournalEntries = async (req, res) => {
    try {
        const { from, to, entry_type, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const params = [];
        let q = `SELECT je.*, u.name AS created_by_name FROM acc_journal_entries je LEFT JOIN users u ON u.id=je.created_by WHERE 1=1`;
        if (from)  { params.push(from); q += ` AND je.entry_date>=$${params.length}`; }
        if (to)    { params.push(to);   q += ` AND je.entry_date<=$${params.length}`; }
        if (entry_type) { params.push(entry_type); q += ` AND je.entry_type=$${params.length}`; }
        if (search) { params.push(`%${search}%`); q += ` AND (je.entry_number ILIKE $${params.length} OR je.narration ILIKE $${params.length})`; }
        q += ` ORDER BY je.entry_date DESC, je.id DESC LIMIT ${limit} OFFSET ${offset}`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getJournalEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const [{ rows: [je] }, { rows: lines }] = await Promise.all([
            db.query(`SELECT je.*, u.name AS created_by_name FROM acc_journal_entries je LEFT JOIN users u ON u.id=je.created_by WHERE je.id=$1`, [id]),
            db.query(`SELECT jl.*, a.name AS account_name, a.code AS account_code FROM acc_journal_lines jl JOIN acc_accounts a ON a.id=jl.account_id WHERE jl.entry_id=$1 ORDER BY jl.id`, [id]),
        ]);
        if (!je) return res.status(404).json({ error: 'Not found' });
        res.json({ ...je, lines });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createJournalEntry = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { entry_date, narration, lines } = req.body;
        const totalDr = lines.reduce((s, l) => s + parseFloat(l.dr_amount || 0), 0);
        const totalCr = lines.reduce((s, l) => s + parseFloat(l.cr_amount || 0), 0);
        if (Math.abs(totalDr - totalCr) > 0.01) throw new Error('Journal entry must balance (Dr = Cr)');
        const je_id = await postJournal(client, {
            entry_date, entry_type: 'journal', narration, created_by: req.user.id,
            lines: lines.map(l => ({ account_id: l.account_id, dr: parseFloat(l.dr_amount||0), cr: parseFloat(l.cr_amount||0), narration: l.narration })),
        });
        await client.query('COMMIT');
        res.json({ id: je_id });
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

exports.reverseJournalEntry = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { rows: [orig] } = await client.query(`SELECT * FROM acc_journal_entries WHERE id=$1`, [id]);
        if (!orig || orig.is_reversed) throw new Error('Entry not found or already reversed');
        const { rows: origLines } = await client.query(`SELECT * FROM acc_journal_lines WHERE entry_id=$1`, [id]);
        const revId = await postJournal(client, {
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: orig.entry_type,
            narration: `REVERSAL of ${orig.entry_number} — ${orig.narration}`,
            lines: origLines.map(l => ({ account_id: l.account_id, dr: l.cr_amount, cr: l.dr_amount })),
            created_by: req.user.id,
        });
        await client.query(`UPDATE acc_journal_entries SET is_reversed=true, reversed_by=$1 WHERE id=$2`, [revId, id]);
        await client.query('COMMIT');
        res.json({ reversal_id: revId });
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

/* ── Vouchers ──────────────────────────────────────────── */
exports.getVouchers = async (req, res) => {
    try {
        const { voucher_type, from, to, page = 1 } = req.query;
        const offset = (page - 1) * 50;
        const params = [];
        let q = `SELECT v.*, u.name AS created_by_name FROM acc_vouchers v LEFT JOIN users u ON u.id=v.created_by WHERE 1=1`;
        if (voucher_type) { params.push(voucher_type); q += ` AND v.voucher_type=$${params.length}`; }
        if (from) { params.push(from); q += ` AND v.voucher_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND v.voucher_date<=$${params.length}`; }
        q += ` ORDER BY v.voucher_date DESC, v.id DESC LIMIT 50 OFFSET ${offset}`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createVoucher = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { voucher_type, voucher_date, party_type, party_id, party_name, amount, payment_mode, bank_account, cheque_number, cheque_date, narration, debit_account_id, credit_account_id } = req.body;
        const voucher_number = await nextVoucherNumber(client, voucher_type);
        const je_id = await postJournal(client, {
            entry_date: voucher_date, entry_type: voucher_type, narration,
            lines: [
                { account_id: debit_account_id,  dr: amount },
                { account_id: credit_account_id, cr: amount },
            ],
            created_by: req.user.id,
        });
        const { rows: [v] } = await client.query(
            `INSERT INTO acc_vouchers (voucher_number,voucher_type,voucher_date,party_type,party_id,party_name,amount,payment_mode,bank_account,cheque_number,cheque_date,narration,journal_entry_id,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [voucher_number, voucher_type, voucher_date, party_type, party_id||null, party_name, amount, payment_mode, bank_account, cheque_number, cheque_date||null, narration, je_id, req.user.id]
        );
        await client.query('COMMIT');
        res.json(v);
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

/* ── General Ledger ────────────────────────────────────── */
exports.getLedger = async (req, res) => {
    try {
        const { account_id, from, to } = req.query;
        if (!account_id) return res.status(400).json({ error: 'account_id required' });

        const { rows: [acc] } = await db.query(`SELECT * FROM acc_accounts WHERE id=$1`, [account_id]);
        if (!acc) return res.status(404).json({ error: 'Account not found' });

        const params = [account_id];
        let q = `SELECT jl.*, je.entry_date, je.entry_number, je.narration AS je_narration, je.entry_type
                 FROM acc_journal_lines jl
                 JOIN acc_journal_entries je ON je.id=jl.entry_id
                 WHERE jl.account_id=$1 AND je.is_posted=true`;
        if (from) { params.push(from); q += ` AND je.entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND je.entry_date<=$${params.length}`; }
        q += ` ORDER BY je.entry_date, je.id, jl.id`;
        const { rows: txns } = await db.query(q, params);

        // Opening balance = entries BEFORE from date
        let openDr = acc.opening_dr || 0, openCr = acc.opening_cr || 0;
        if (from) {
            const { rows: [ob] } = await db.query(
                `SELECT COALESCE(SUM(jl.dr_amount),0) AS dr, COALESCE(SUM(jl.cr_amount),0) AS cr
                 FROM acc_journal_lines jl JOIN acc_journal_entries je ON je.id=jl.entry_id
                 WHERE jl.account_id=$1 AND je.entry_date<$2 AND je.is_posted=true`,
                [account_id, from]
            );
            openDr += parseFloat(ob.dr); openCr += parseFloat(ob.cr);
        }

        let balance = openDr - openCr;
        const ledger = txns.map(t => {
            balance += parseFloat(t.dr_amount) - parseFloat(t.cr_amount);
            return { ...t, running_balance: balance };
        });
        res.json({ account: acc, opening_dr: openDr, opening_cr: openCr, ledger });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Trial Balance ─────────────────────────────────────── */
exports.getTrialBalance = async (req, res) => {
    try {
        const { from, to } = req.query;
        const params = [];
        let dateFilter = '';
        if (from) { params.push(from); dateFilter += ` AND je.entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   dateFilter += ` AND je.entry_date<=$${params.length}`; }

        const { rows } = await db.query(`
            SELECT a.id, a.code, a.name, a.type, a.sub_type,
                   a.opening_dr, a.opening_cr,
                   COALESCE(SUM(jl.dr_amount),0) AS period_dr,
                   COALESCE(SUM(jl.cr_amount),0) AS period_cr,
                   a.opening_dr + COALESCE(SUM(jl.dr_amount),0) AS total_dr,
                   a.opening_cr + COALESCE(SUM(jl.cr_amount),0) AS total_cr
            FROM acc_accounts a
            LEFT JOIN acc_journal_lines jl ON jl.account_id=a.id
            LEFT JOIN acc_journal_entries je ON je.id=jl.entry_id AND je.is_posted=true ${dateFilter}
            WHERE a.is_group=false AND a.is_active=true
            GROUP BY a.id, a.code, a.name, a.type, a.sub_type, a.opening_dr, a.opening_cr
            ORDER BY a.code
        `, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Profit & Loss ─────────────────────────────────────── */
exports.getProfitLoss = async (req, res) => {
    try {
        const { from, to } = req.query;
        const params = [];
        let dateFilter = `WHERE je.is_posted=true AND a.type IN ('revenue','expense')`;
        if (from) { params.push(from); dateFilter += ` AND je.entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   dateFilter += ` AND je.entry_date<=$${params.length}`; }

        const { rows } = await db.query(`
            SELECT a.code, a.name, a.type, a.sub_type,
                   COALESCE(SUM(jl.dr_amount),0) AS dr_total,
                   COALESCE(SUM(jl.cr_amount),0) AS cr_total
            FROM acc_journal_lines jl
            JOIN acc_journal_entries je ON je.id=jl.entry_id
            JOIN acc_accounts a ON a.id=jl.account_id
            ${dateFilter}
            GROUP BY a.code, a.name, a.type, a.sub_type
            ORDER BY a.type DESC, a.code
        `, params);

        const revenue  = rows.filter(r => r.type === 'revenue').map(r => ({ ...r, amount: r.cr_total - r.dr_total }));
        const expenses = rows.filter(r => r.type === 'expense').map(r => ({ ...r, amount: r.dr_total - r.cr_total }));
        const totalRev = revenue.reduce((s, r) => s + parseFloat(r.amount), 0);
        const totalExp = expenses.reduce((s, r) => s + parseFloat(r.amount), 0);
        res.json({ revenue, expenses, total_revenue: totalRev, total_expenses: totalExp, net_profit: totalRev - totalExp });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Balance Sheet ─────────────────────────────────────── */
exports.getBalanceSheet = async (req, res) => {
    try {
        const { as_of } = req.query;
        const params = [];
        let dateFilter = '';
        if (as_of) { params.push(as_of); dateFilter = ` AND je.entry_date<=$${params.length}`; }

        const { rows } = await db.query(`
            SELECT a.code, a.name, a.type, a.sub_type,
                   a.opening_dr + COALESCE(SUM(jl.dr_amount),0) AS total_dr,
                   a.opening_cr + COALESCE(SUM(jl.cr_amount),0) AS total_cr
            FROM acc_accounts a
            LEFT JOIN acc_journal_lines jl ON jl.account_id=a.id
            LEFT JOIN acc_journal_entries je ON je.id=jl.entry_id AND je.is_posted=true ${dateFilter}
            WHERE a.is_group=false AND a.is_active=true AND a.type IN ('asset','liability','equity')
            GROUP BY a.code, a.name, a.type, a.sub_type, a.opening_dr, a.opening_cr
            ORDER BY a.type, a.code
        `, params);

        const assets      = rows.filter(r => r.type === 'asset').map(r => ({ ...r, amount: r.total_dr - r.total_cr }));
        const liabilities = rows.filter(r => r.type === 'liability').map(r => ({ ...r, amount: r.total_cr - r.total_dr }));
        const equity      = rows.filter(r => r.type === 'equity').map(r => ({ ...r, amount: r.total_cr - r.total_dr }));
        res.json({
            assets, liabilities, equity,
            total_assets:      assets.reduce((s,r) => s + parseFloat(r.amount), 0),
            total_liabilities: liabilities.reduce((s,r) => s + parseFloat(r.amount), 0),
            total_equity:      equity.reduce((s,r) => s + parseFloat(r.amount), 0),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Day Book ──────────────────────────────────────────── */
exports.getDayBook = async (req, res) => {
    try {
        const { date } = req.query;
        const d = date || new Date().toISOString().split('T')[0];
        const { rows } = await db.query(`
            SELECT je.id, je.entry_number, je.entry_type, je.narration, je.ref_type, je.ref_id,
                   json_agg(json_build_object(
                       'account_code', a.code, 'account_name', a.name,
                       'dr', jl.dr_amount, 'cr', jl.cr_amount
                   ) ORDER BY jl.id) AS lines,
                   SUM(jl.dr_amount) AS total_dr
            FROM acc_journal_entries je
            JOIN acc_journal_lines jl ON jl.entry_id=je.id
            JOIN acc_accounts a ON a.id=jl.account_id
            WHERE je.entry_date=$1 AND je.is_posted=true
            GROUP BY je.id, je.entry_number, je.entry_type, je.narration, je.ref_type, je.ref_id
            ORDER BY je.id
        `, [d]);
        res.json({ date: d, entries: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Cash Book ─────────────────────────────────────────── */
exports.getCashBook = async (req, res) => {
    try {
        const { from, to } = req.query;
        const cashId = await accountByCode('1110');
        if (!cashId) return res.status(404).json({ error: 'Cash account not configured' });
        const params = [cashId];
        let q = `SELECT jl.dr_amount, jl.cr_amount, jl.narration AS line_narration,
                        je.entry_date, je.entry_number, je.narration, je.entry_type
                 FROM acc_journal_lines jl
                 JOIN acc_journal_entries je ON je.id=jl.entry_id
                 WHERE jl.account_id=$1 AND je.is_posted=true`;
        if (from) { params.push(from); q += ` AND je.entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND je.entry_date<=$${params.length}`; }
        q += ` ORDER BY je.entry_date, je.id`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Bank Book ─────────────────────────────────────────── */
exports.getBankBook = async (req, res) => {
    try {
        const { from, to, account_id } = req.query;
        const bankId = account_id || await accountByCode('1121');
        if (!bankId) return res.status(404).json({ error: 'Bank account not configured' });
        const params = [bankId];
        let q = `SELECT jl.dr_amount, jl.cr_amount, jl.narration AS line_narration,
                        je.entry_date, je.entry_number, je.narration, je.entry_type
                 FROM acc_journal_lines jl
                 JOIN acc_journal_entries je ON je.id=jl.entry_id
                 WHERE jl.account_id=$1 AND je.is_posted=true`;
        if (from) { params.push(from); q += ` AND je.entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND je.entry_date<=$${params.length}`; }
        q += ` ORDER BY je.entry_date, je.id`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── GST Ledger ────────────────────────────────────────── */
exports.getGSTLedger = async (req, res) => {
    try {
        const { from, to, gst_type } = req.query;
        const params = [];
        let q = `SELECT * FROM acc_gst_ledger WHERE 1=1`;
        if (from) { params.push(from); q += ` AND entry_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND entry_date<=$${params.length}`; }
        if (gst_type) { params.push(gst_type); q += ` AND gst_type=$${params.length}`; }
        q += ` ORDER BY entry_date DESC`;
        const { rows } = await db.query(q, params);
        const totals = rows.reduce((s, r) => ({
            taxable: s.taxable + parseFloat(r.taxable_amount||0),
            cgst: s.cgst + parseFloat(r.cgst||0),
            sgst: s.sgst + parseFloat(r.sgst||0),
            igst: s.igst + parseFloat(r.igst||0),
            total: s.total + parseFloat(r.total_gst||0),
        }), { taxable:0, cgst:0, sgst:0, igst:0, total:0 });
        res.json({ ledger: rows, totals });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Financial Years ────────────────────────────────────── */
exports.getFinancialYears = async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT * FROM acc_financial_years ORDER BY start_date DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createFinancialYear = async (req, res) => {
    try {
        const { name, start_date, end_date } = req.body;
        const { rows: [fy] } = await db.query(
            `INSERT INTO acc_financial_years (name,start_date,end_date) VALUES ($1,$2,$3) RETURNING *`,
            [name, start_date, end_date]
        );
        res.json(fy);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.setActiveFY = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(`UPDATE acc_financial_years SET is_active=false`);
        const { rows: [fy] } = await db.query(`UPDATE acc_financial_years SET is_active=true WHERE id=$1 RETURNING *`, [id]);
        res.json(fy);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
