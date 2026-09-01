const db      = require('../config/db');
const msg     = require('../services/msg91Service');
const wa      = require('../services/aiSensyService');
const anomaly = require('../services/anomalyService');
const { getViewUrl } = require('../services/storageService');

const PHOTO_PROOF_REQUIRED_MSG = 'Photo Proof is required to submit this entry.';

// Attach a presigned view URL for each row's photo_proof_key (private-S3 safe).
async function attachProofUrls(rows) {
    await Promise.all(rows.map(async (r) => {
        if (r && r.photo_proof_key) r.photo_proof_url = await getViewUrl(r.photo_proof_key);
    }));
    return rows;
}

const emitDashboard = (req, payload) => {
    try { req.app.get('io')?.emit('dashboard_update', payload); } catch (_) {}
};

/*
 * FIELD CONTRACT
 * ─────────────────────────────────────────────────────────────────
 * excel_total_sale  — locked from Excel; NEVER editable by shop user
 * total_sale        — equals excel_total_sale (kept for analytics joins)
 * cash              — user-entered
 * online            — QR / Card / Bank (user-entered)
 * razorpay          — user-entered
 * cheque            — user-entered
 * approval_status   — PENDING | APPROVED | REJECTED
 *
 * Breakdown validation:  cash + online + razorpay + cheque  must == excel_total_sale
 */

const getTodayUTC = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────
// CREATE
// - shop_user: saves as PENDING, date must be today
// - admin:     saves as APPROVED immediately, credits cash to wallet
// ─────────────────────────────────────────────────────────────────
exports.createEntry = async (req, res) => {
    const { shop_id, date, excel_total_sale, cash, online, razorpay, cheque, entry_type,
            payment_in, payment_in_admin_id, photo_proof_key } = req.body;
    const isAdmin   = req.user.role === 'admin';
    const entryType = entry_type === 'no_sale' ? 'no_sale' : 'normal';

    const entryDate = date ? String(date).split('T')[0] : null;
    if (!entryDate) return res.status(400).json({ error: 'Date is required.' });

    // ── Mandatory Photo Proof (all roles) — cannot be bypassed via API ──
    const proofKey = typeof photo_proof_key === 'string' ? photo_proof_key.trim() : '';
    if (!proofKey) return res.status(400).json({ error: PHOTO_PROOF_REQUIRED_MSG });

    // Shop users can only submit today's entry
    if (!isAdmin) {
        const today = getTodayUTC();
        if (entryDate !== today) {
            return res.status(400).json({
                error: 'Only today\'s data is allowed. Past or future dates are rejected.',
            });
        }
    }

    const excelTotal   = parseFloat(excel_total_sale || 0);
    // Payment In is a non-sales fund deposit (e.g. money the boss deposits into
    // the shop's bank account) — it must NEVER be required to reconcile against
    // Total Sale. Matches the documented FIELD CONTRACT above: only the actual
    // sales payment modes (cash/online/razorpay/cheque) need to sum to the total.
    const breakdownSum = parseFloat(cash || 0) + parseFloat(online || 0) + parseFloat(razorpay || 0) + parseFloat(cheque || 0);

    // Breakdown validation — strict for shop users, advisory-only for admin
    if (!isAdmin && Math.abs(excelTotal - breakdownSum) > 0.01) {
        return res.status(400).json({
            error: `Breakdown (₹${breakdownSum.toFixed(2)}) does not match Total Sale (₹${excelTotal.toFixed(2)}). Fix before submitting.`,
        });
    }

    // ── Admin path: auto-approve in a transaction + credit wallet ──
    if (isAdmin) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const piAmt   = parseFloat(payment_in || 0);
            const piAdmin = payment_in_admin_id ? parseInt(payment_in_admin_id) : null;

            const result = await client.query(
                `INSERT INTO daily_entries
                    (shop_id, date, total_sale, excel_total_sale, cash, online, razorpay, cheque,
                     payment_in, payment_in_admin_id, photo_proof_key,
                     approval_status, locked, approved_by, approved_at, wallet_credited, entry_type, created_by)
                 VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $12, 'APPROVED', true, $10, NOW(), true, $11, $10)
                 RETURNING *`,
                [shop_id, entryDate, excelTotal, cash || 0, online || 0, razorpay || 0, cheque || 0,
                 piAmt, piAdmin, req.user.id, entryType, proofKey],
            );

            // Credit cash portion to shop wallet
            await client.query(
                'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                [parseFloat(cash || 0), shop_id],
            );

            // Record Payment In to admin bank ledger (auto-approved path)
            if (piAmt > 0 && piAdmin) {
                const shopQ = await client.query('SELECT shop_name FROM shops WHERE id = $1', [shop_id]);
                const adminQ = await client.query('SELECT name FROM users WHERE id = $1', [piAdmin]);
                await client.query(
                    `INSERT INTO admin_bank_ledger
                        (transaction_type, amount, shop_id, shop_name, admin_id,
                         ref_id, remarks, created_by, created_by_name)
                     VALUES ('PAYMENT_IN', $1, $2, $3, $4, $5, $6, $7, $8)`,
                    [piAmt, shop_id, shopQ.rows[0]?.shop_name || null, piAdmin,
                     result.rows[0].id, null, req.user.id, 'System (entry)'],
                );
            }

            await client.query(
                `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
                 VALUES ('daily_entries', $1, '{}'::jsonb, $2::jsonb, $3)`,
                [result.rows[0].id, JSON.stringify(result.rows[0]), req.user.id],
            );

            await client.query('COMMIT');
            return res.status(201).json(result.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            if (err.constraint === 'daily_entries_shop_id_date_key') {
                return res.status(409).json({ error: 'An entry for this shop and date already exists.' });
            }
            return res.status(500).json({ error: err.message });
        } finally {
            client.release();
        }
    }

    // ── Shop user path: save as PENDING + credit CASH to wallet ──
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const piAmt   = parseFloat(payment_in || 0);
        const piAdmin = payment_in_admin_id ? parseInt(payment_in_admin_id) : null;

        const result = await client.query(
            `INSERT INTO daily_entries
                (shop_id, date, total_sale, excel_total_sale, cash, online, razorpay, cheque,
                 payment_in, payment_in_admin_id, photo_proof_key,
                 approval_status, wallet_credited, entry_type, created_by)
             VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $12, 'PENDING', true, $10, $11)
             RETURNING *`,
            [shop_id, entryDate, excelTotal, cash || 0, online || 0, razorpay || 0, cheque || 0,
             piAmt, piAdmin, entryType, req.user.id, proofKey],
        );

        // Credit ONLY the cash portion to the shop wallet immediately on submission
        const cashAmt = parseFloat(cash || 0);
        await client.query(
            'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
            [cashAmt, shop_id],
        );
        console.log(`[createEntry] ₹${cashAmt} credited to shop #${shop_id} wallet on submission.`);

        await client.query('COMMIT');

        const newEntry = result.rows[0];
        res.status(201).json(newEntry);

        /* fire-and-forget: anomaly check + socket broadcast */
        anomaly.checkEntry(newEntry.id).then(flags => {
            emitDashboard(req, {
                type: 'entry_submitted',
                entry_id: newEntry.id,
                shop_id,
                date: entryDate,
                total_sale: excelTotal,
                anomaly_flags: flags,
            });
        }).catch(() => {
            emitDashboard(req, { type: 'entry_submitted', shop_id, date: entryDate, total_sale: excelTotal });
        });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.constraint === 'daily_entries_shop_id_date_key') {
            const existing = await db.query(
                'SELECT * FROM daily_entries WHERE shop_id = $1 AND date = $2',
                [shop_id, entryDate],
            );
            return res.status(409).json({
                error: 'Entry for this date already exists.',
                existing: existing.rows[0] || null,
            });
        }
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// UPDATE
// - shop_user: can update breakdown on PENDING/unlocked entries
// - admin:     can update any entry (including APPROVED) + editable
//              fields total_sale, excel_total_sale, date; wallet is
//              adjusted by the cash delta when editing APPROVED rows
// ─────────────────────────────────────────────────────────────────
exports.updateEntry = async (req, res) => {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const { cash, online, razorpay, cheque, total_sale, excel_total_sale, date,
            payment_in, payment_in_admin_id, photo_proof_key } = req.body;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const entryResult = await client.query(
            'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE', [id],
        );
        if (!entryResult.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Entry not found' });
        }
        const entry = entryResult.rows[0];

        // ── Auth checks ──────────────────────────────────────────
        if (req.user.role === 'shop_user' && entry.shop_id !== req.user.shopId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'This entry does not belong to your shop.' });
        }
        if (!isAdmin) {
            const unlockActive =
                entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);
            if ((entry.approval_status === 'APPROVED' || entry.locked) && !unlockActive) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Entry is locked. Request admin to unlock.' });
            }
        }

        // ── Compute new values ───────────────────────────────────
        const newCash      = parseFloat(cash     ?? entry.cash     ?? 0);
        const newOnline    = parseFloat(online   ?? entry.online   ?? 0);
        const newRazorpay  = parseFloat(razorpay ?? entry.razorpay ?? 0);
        const newCheque    = parseFloat(cheque   ?? entry.cheque   ?? 0);
        const newPiAmtVal  = payment_in !== undefined ? parseFloat(payment_in || 0) : parseFloat(entry.payment_in || 0);
        // Payment In excluded — non-sales fund deposit, must not be required to
        // reconcile against Total Sale (see FIELD CONTRACT comment at top of file).
        const breakdownSum = newCash + newOnline + newRazorpay + newCheque;

        // Admin can override totals; for shop_user the excel total is immutable
        const newTotal = isAdmin && total_sale !== undefined
            ? parseFloat(total_sale)
            : parseFloat(entry.excel_total_sale || entry.total_sale || 0);
        const newExcelTotal = isAdmin && excel_total_sale !== undefined
            ? parseFloat(excel_total_sale)
            : newTotal;

        // Strict breakdown check for shop_user only
        if (!isAdmin && Math.abs(newTotal - breakdownSum) > 0.01) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Breakdown (₹${breakdownSum.toFixed(2)}) does not match Total Sale (₹${newTotal.toFixed(2)}).`,
            });
        }

        // ── Build SET clause dynamically ─────────────────────────
        const newPiAdmin = payment_in_admin_id !== undefined
            ? (payment_in_admin_id ? parseInt(payment_in_admin_id) : null)
            : entry.payment_in_admin_id;

        // ── Mandatory Photo Proof — keep existing unless a new one is provided; never allow blank ──
        const providedProof = typeof photo_proof_key === 'string' ? photo_proof_key.trim() : '';
        const effectiveProof = providedProof || entry.photo_proof_key;
        if (!effectiveProof) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: PHOTO_PROOF_REQUIRED_MSG });
        }

        const setCols  = ['cash = $1', 'online = $2', 'razorpay = $3', 'cheque = $4', 'payment_in = $5', 'payment_in_admin_id = $6'];
        const setVals  = [newCash, newOnline, newRazorpay, newCheque, newPiAmtVal, newPiAdmin];
        let   pIdx     = 7;

        setCols.push(`photo_proof_key = $${pIdx++}`); setVals.push(effectiveProof);

        if (isAdmin) {
            setCols.push(`total_sale = $${pIdx++}`);       setVals.push(newTotal);
            setCols.push(`excel_total_sale = $${pIdx++}`); setVals.push(newExcelTotal);
            if (date) { setCols.push(`date = $${pIdx++}`); setVals.push(date); }
            // approval_status stays as-is when admin edits an approved entry
        } else {
            setCols.push(`approval_status = 'PENDING'`);
        }
        setVals.push(id); // always last

        const result = await client.query(
            `UPDATE daily_entries SET ${setCols.join(', ')} WHERE id = $${pIdx} RETURNING *`,
            setVals,
        );

        // ── Wallet delta for admin edits on APPROVED entries ─────
        if (isAdmin && entry.approval_status === 'APPROVED') {
            const cashDelta = newCash - parseFloat(entry.cash || 0);
            if (Math.abs(cashDelta) > 0.001) {
                await client.query(
                    'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                    [cashDelta, entry.shop_id],
                );
                console.log(`[updateEntry] Shop #${entry.shop_id} wallet adjusted by ₹${cashDelta}`);
            }
        }

        // ── Wallet delta for shop user edits on PENDING wallet_credited entries ─
        if (!isAdmin && entry.wallet_credited && entry.approval_status === 'PENDING') {
            const cashDelta = newCash - parseFloat(entry.cash || 0);
            if (Math.abs(cashDelta) > 0.001) {
                await client.query(
                    'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                    [cashDelta, entry.shop_id],
                );
                console.log(`[updateEntry] Shop #${entry.shop_id} wallet adjusted by ₹${cashDelta} (PENDING update)`);
            }
        }

        // ── Audit log ────────────────────────────────────────────
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, $3::jsonb, $4)`,
            [id, JSON.stringify(entry), JSON.stringify(result.rows[0]), req.user.id],
        );

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[updateEntry] error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// GET ALL  (role-aware, date-range filter, paginated when ?page= set)
// ─────────────────────────────────────────────────────────────────
exports.getEntries = async (req, res) => {
    try {
        const { status, date_from, date_to, shop_id, page, limit = 20, entry_type: entryTypeFilter } = req.query;

        const baseSelect = `
            SELECT e.*, s.shop_name, s.shop_address,
                   c.name  AS city_name,
                   au.name AS approved_by_name,
                   su.name AS submitted_by_name,
                   su.mobile AS submitted_by_mobile
            FROM daily_entries e
            JOIN shops s   ON e.shop_id    = s.id
            LEFT JOIN cities c  ON s.city_id    = c.id
            LEFT JOIN users au  ON e.approved_by = au.id
            LEFT JOIN users su  ON e.created_by  = su.id
        `;

        const params  = [];
        const clauses = [];

        if (req.user.role === 'shop_user') {
            clauses.push(`e.shop_id = $${params.length + 1}`);
            params.push(req.user.shopId);
        }
        if (status && req.user.role !== 'shop_user') {
            clauses.push(`e.approval_status = $${params.length + 1}`);
            params.push(status.toUpperCase());
        }
        if (date_from) {
            clauses.push(`e.date >= $${params.length + 1}`);
            params.push(date_from);
        }
        if (date_to) {
            clauses.push(`e.date <= $${params.length + 1}`);
            params.push(date_to);
        }
        if (shop_id && req.user.role !== 'shop_user') {
            clauses.push(`e.shop_id = $${params.length + 1}`);
            params.push(parseInt(shop_id));
        }
        if (entryTypeFilter && ['normal', 'no_sale'].includes(entryTypeFilter)) {
            clauses.push(`e.entry_type = $${params.length + 1}`);
            params.push(entryTypeFilter);
        }

        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const order = ' ORDER BY e.date DESC, e.created_at DESC';

        // Without ?page — return flat array (backward compat for AdminApprovalPage)
        if (!page) {
            const result = await db.query(baseSelect + where + order, params);
            return res.json(await attachProofUrls(result.rows));
        }

        // With ?page — return paginated wrapper
        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const offset   = (pageNum - 1) * limitNum;

        const countResult = await db.query(
            `SELECT COUNT(*) FROM daily_entries e JOIN shops s ON e.shop_id = s.id${where}`,
            params,
        );
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...params, limitNum, offset];
        const result = await db.query(
            baseSelect + where + order + ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams,
        );

        res.json({
            entries: await attachProofUrls(result.rows),
            total,
            page:  pageNum,
            pages: Math.ceil(total / limitNum) || 1,
            limit: limitNum,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET PHOTO PROOF  (fresh presigned S3 URL, generated on demand)
// Keeps the bucket private and credentials backend-only.
// ─────────────────────────────────────────────────────────────────
exports.getEntryPhotoProof = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT photo_proof_key FROM daily_entries WHERE id = $1', [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Entry not found' });
        const key = rows[0].photo_proof_key;
        if (!key) return res.status(404).json({ error: 'No Photo Proof' });

        const url = await getViewUrl(key);
        if (!url) return res.status(502).json({ error: 'Could not generate photo link. Please retry.' });
        res.json({ url });
    } catch (err) {
        console.error('[getEntryPhotoProof]', err.message);
        res.status(500).json({ error: 'Failed to load photo proof' });
    }
};

// ─────────────────────────────────────────────────────────────────
// GET PENDING  (admin convenience endpoint)
// ─────────────────────────────────────────────────────────────────
exports.getPendingEntries = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT e.*, s.shop_name, s.shop_address,
                    c.name AS city_name,
                    u.name AS submitted_by_name, u.mobile AS submitted_by_mobile
             FROM daily_entries e
             JOIN shops s ON e.shop_id = s.id
             LEFT JOIN cities c ON s.city_id = c.id
             LEFT JOIN users u  ON e.created_by = u.id
             WHERE e.approval_status = 'PENDING'
             ORDER BY e.created_at ASC`,
        );
        res.json(await attachProofUrls(result.rows));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// APPROVE  (admin only)
// Atomically: mark entry APPROVED + credit cash → shop user's wallet
// Uses a DB transaction with FOR UPDATE to prevent double-processing.
// ─────────────────────────────────────────────────────────────────
exports.approveEntry = async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Lock this entry row — prevents concurrent approval of the same record
        const entryResult = await client.query(
            'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE',
            [id],
        );
        if (entryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Entry not found' });
        }

        const entry = entryResult.rows[0];

        if (entry.approval_status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Entry is already ${entry.approval_status.toLowerCase()}. Only PENDING entries can be approved.`,
            });
        }

        // 1. Mark entry as APPROVED
        const updated = await client.query(
            `UPDATE daily_entries
             SET approval_status = 'APPROVED',
                 approved_by     = $1,
                 approved_at     = NOW(),
                 rejection_note  = NULL,
                 locked          = true
             WHERE id = $2
             RETURNING *`,
            [req.user.id, id],
        );

        // 2. Credit ONLY the cash portion to the shop user's wallet_balance.
        //    wallet_balance is the sole source of truth for transferable funds —
        //    it must never be edited manually or topped up any other way.
        //    Skip if already credited at submission time (wallet_credited = true).
        const cashAmt = parseFloat(entry.cash || 0);
        if (!entry.wallet_credited) {
            await client.query(
                'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                [cashAmt, entry.shop_id],
            );
            console.log(`[approveEntry] Entry #${id} approved. ₹${cashAmt} credited to shop #${entry.shop_id} wallet.`);
        } else {
            console.log(`[approveEntry] Entry #${id} approved. Wallet already credited at submission (₹${cashAmt}), skipping.`);
        }

        // 3. Payment In → admin bank ledger (only if not yet recorded at submission)
        const piAmt   = parseFloat(entry.payment_in || 0);
        const piAdmin = entry.payment_in_admin_id ? parseInt(entry.payment_in_admin_id) : null;
        if (piAmt > 0 && piAdmin) {
            const already = await client.query(
                `SELECT id FROM admin_bank_ledger WHERE transaction_type = 'PAYMENT_IN' AND ref_id = $1`,
                [parseInt(id)],
            );
            if (already.rows.length === 0) {
                const shopQ  = await client.query('SELECT shop_name FROM shops WHERE id = $1', [entry.shop_id]);
                const adminQ = await client.query('SELECT name FROM users WHERE id = $1', [piAdmin]);
                await client.query(
                    `INSERT INTO admin_bank_ledger
                        (transaction_type, amount, shop_id, shop_name, admin_id,
                         ref_id, remarks, created_by, created_by_name)
                     VALUES ('PAYMENT_IN', $1, $2, $3, $4, $5, $6, $7, $8)`,
                    [piAmt, entry.shop_id, shopQ.rows[0]?.shop_name || null, piAdmin,
                     parseInt(id), null, req.user.id, 'System (approval)'],
                );
            }
        }

        // 4. Audit log
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, $3::jsonb, $4)`,
            [id, JSON.stringify(entry), JSON.stringify(updated.rows[0]), req.user.id],
        );

        await client.query('COMMIT');

        // Notify shop user via WhatsApp (fire-and-forget)
        try {
            const shopRes = await db.query(
                `SELECT s.shop_name, u.mobile
                 FROM shops s
                 JOIN shop_users su ON su.shop_id = s.id
                 JOIN users u ON u.id = su.user_id
                 WHERE s.id = $1 AND u.mobile IS NOT NULL
                 LIMIT 1`,
                [entry.shop_id],
            );
            if (shopRes.rows[0]?.mobile) {
                const dateStr  = String(entry.date).split('T')[0];
                const mobile   = shopRes.rows[0].mobile;
                const shopName = shopRes.rows[0].shop_name || `Shop #${entry.shop_id}`;
                const amount   = parseFloat(entry.total_sale || 0).toFixed(2);
                wa.notifyEntryApproved(mobile, shopName, dateStr, amount).catch(() => {});
                msg.notifyEntryApproved(mobile, entry.shop_id, dateStr, amount).catch(() => {});
            }
        } catch { /* notification errors must never break the response */ }

        res.json({ message: 'Entry approved successfully.', entry: updated.rows[0] });
        emitDashboard(req, { type: 'entry_approved', entry_id: id, shop_id: entry.shop_id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[approveEntry] Transaction rolled back:', err.message);
        res.status(500).json({ error: err.message, detail: err.detail || null });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// REJECT  (admin only)
// Reverses wallet credit if it was credited at submission time.
// ─────────────────────────────────────────────────────────────────
exports.rejectEntry = async (req, res) => {
    const { id } = req.params;
    const { rejection_note } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const entryResult = await client.query(
            'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE', [id],
        );
        if (entryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Entry not found' });
        }

        const entry = entryResult.rows[0];

        if (entry.approval_status !== 'PENDING') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Entry is already ${entry.approval_status.toLowerCase()}. Only PENDING entries can be rejected.`,
            });
        }

        const result = await client.query(
            `UPDATE daily_entries
             SET approval_status = 'REJECTED',
                 approved_by     = $1,
                 approved_at     = NOW(),
                 rejection_note  = $2
             WHERE id = $3
             RETURNING *`,
            [req.user.id, rejection_note || null, id],
        );

        // Reverse wallet credit if it was credited at submission time
        if (entry.wallet_credited) {
            const cashAmt = parseFloat(entry.cash || 0);
            await client.query(
                'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2',
                [cashAmt, entry.shop_id],
            );
            console.log(`[rejectEntry] ₹${cashAmt} reversed from shop #${entry.shop_id} wallet on rejection.`);
        }

        // Audit
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, $3::jsonb, $4)`,
            [id, JSON.stringify(entry), JSON.stringify(result.rows[0]), req.user.id],
        );

        await client.query('COMMIT');

        // Notify shop user via WhatsApp (fire-and-forget)
        try {
            const shopRes = await db.query(
                `SELECT s.shop_name, u.mobile
                 FROM shops s
                 JOIN shop_users su ON su.shop_id = s.id
                 JOIN users u ON u.id = su.user_id
                 WHERE s.id = $1 AND u.mobile IS NOT NULL
                 LIMIT 1`,
                [entry.shop_id],
            );
            if (shopRes.rows[0]?.mobile) {
                const dateStr  = String(entry.date).split('T')[0];
                const mobile   = shopRes.rows[0].mobile;
                const shopName = shopRes.rows[0].shop_name || `Shop #${entry.shop_id}`;
                const reason   = rejection_note || 'No reason provided';
                wa.notifyEntryRejected(mobile, shopName, dateStr, reason).catch(() => {});
                msg.notifyEntryRejected(mobile, entry.shop_id, dateStr, reason).catch(() => {});
            }
        } catch { /* notification errors must never break the response */ }

        res.json({ message: 'Entry rejected.', entry: result.rows[0] });
        emitDashboard(req, { type: 'entry_rejected', entry_id: id });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// DELETE  (admin only)
// Reverses wallet credit if entry was APPROVED, then hard-deletes.
// ─────────────────────────────────────────────────────────────────
exports.deleteEntry = async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const entryResult = await client.query(
            'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE', [id],
        );
        if (entryResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Entry not found.' });
        }

        const entry = entryResult.rows[0];

        // Reverse the cash that was credited to the shop wallet (at submission or approval)
        if (entry.wallet_credited) {
            await client.query(
                'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2',
                [parseFloat(entry.cash || 0), entry.shop_id],
            );
        }

        // Audit log before deletion
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, '{"action":"deleted"}'::jsonb, $3)`,
            [id, JSON.stringify(entry), req.user.id],
        );

        await client.query('DELETE FROM daily_entries WHERE id = $1', [id]);
        await client.query('COMMIT');

        res.json({
            message: 'Entry deleted successfully.',
            reversedCash: parseFloat(entry.cash || 0),
            wasApproved: entry.approval_status === 'APPROVED',
        });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// BULK APPROVE / REJECT  (admin / manager)
// Body: { ids: number[], action: 'approve'|'reject', rejection_note?: string }
// ─────────────────────────────────────────────────────────────────
exports.bulkAction = async (req, res) => {
    const { ids, action, rejection_note } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ error: 'ids array is required' });
    if (!['approve', 'reject'].includes(action))
        return res.status(400).json({ error: 'action must be approve or reject' });

    const succeeded = [];
    const failed    = [];

    for (const id of ids) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const entryResult = await client.query(
                'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE', [id],
            );
            if (entryResult.rows.length === 0) {
                await client.query('ROLLBACK');
                failed.push({ id, error: 'Not found' });
                continue;
            }
            const entry = entryResult.rows[0];

            if (entry.approval_status !== 'PENDING') {
                await client.query('ROLLBACK');
                failed.push({ id, error: `Already ${entry.approval_status}` });
                continue;
            }

            if (action === 'approve') {
                const updated = await client.query(
                    `UPDATE daily_entries
                     SET approval_status = 'APPROVED', approved_by = $1,
                         approved_at = NOW(), rejection_note = NULL, locked = true
                     WHERE id = $2 RETURNING *`,
                    [req.user.id, id],
                );
                if (!entry.wallet_credited) {
                    await client.query(
                        'UPDATE shops SET wallet_balance = COALESCE(wallet_balance,0) + $1 WHERE id = $2',
                        [parseFloat(entry.cash || 0), entry.shop_id],
                    );
                }
                await client.query(
                    `INSERT INTO audit_logs (table_name,record_id,old_value,new_value,edited_by)
                     VALUES ('daily_entries',$1,$2::jsonb,$3::jsonb,$4)`,
                    [id, JSON.stringify(entry), JSON.stringify(updated.rows[0]), req.user.id],
                );
            } else {
                const updated = await client.query(
                    `UPDATE daily_entries
                     SET approval_status = 'REJECTED', approved_by = $1,
                         approved_at = NOW(), rejection_note = $2
                     WHERE id = $3 RETURNING *`,
                    [req.user.id, rejection_note || null, id],
                );
                if (entry.wallet_credited) {
                    await client.query(
                        'UPDATE shops SET wallet_balance = COALESCE(wallet_balance,0) - $1 WHERE id = $2',
                        [parseFloat(entry.cash || 0), entry.shop_id],
                    );
                }
                await client.query(
                    `INSERT INTO audit_logs (table_name,record_id,old_value,new_value,edited_by)
                     VALUES ('daily_entries',$1,$2::jsonb,$3::jsonb,$4)`,
                    [id, JSON.stringify(entry), JSON.stringify(updated.rows[0]), req.user.id],
                );
            }

            await client.query('COMMIT');
            succeeded.push(id);
        } catch (err) {
            await client.query('ROLLBACK');
            failed.push({ id, error: err.message });
        } finally {
            client.release();
        }
    }

    res.json({
        message: `Bulk ${action}: ${succeeded.length} succeeded, ${failed.length} failed`,
        success: succeeded.length,
        failed:  failed.length,
        errors:  failed,
    });
};

// ─────────────────────────────────────────────────────────────────
// UNLOCK  (admin only — re-opens a locked/approved entry briefly)
// ─────────────────────────────────────────────────────────────────
exports.unlockEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const unlockTill = new Date();
        unlockTill.setMinutes(unlockTill.getMinutes() + 10);

        const result = await db.query(
            `UPDATE daily_entries
             SET locked = true, edit_enabled_till = $1
             WHERE id = $2
             RETURNING *`,
            [unlockTill, id],
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Entry not found' });

        res.json({ message: 'Entry unlocked for 10 minutes', entry: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// TODAY STATUS — which shops have/haven't submitted today
// ─────────────────────────────────────────────────────────────────
exports.getTodayStatus = async (req, res) => {
    try {
        const today = getTodayUTC();
        const from = req.query.from || req.query.date || today;
        const to   = req.query.to   || from;
        const shopsQ = await db.query(`SELECT id, shop_name FROM shops ORDER BY shop_name`);

        const allShops = shopsQ.rows;
        if (allShops.length === 0) {
            return res.json({ from, to, totalShops: 0, submittedCount: 0, pendingCount: 0, allShops: [] });
        }

        const shopIds     = allShops.map(s => s.id);
        const placeholder = shopIds.map((_, i) => `$${i + 3}`).join(',');
        const entriesQ    = await db.query(
            `SELECT shop_id, COUNT(*) AS entry_count, MAX(date) AS last_date
             FROM daily_entries
             WHERE date >= $1 AND date <= $2 AND shop_id IN (${placeholder})
             GROUP BY shop_id`,
            [from, to, ...shopIds]
        );

        const map = {};
        entriesQ.rows.forEach(r => { map[r.shop_id] = { count: parseInt(r.entry_count), lastDate: r.last_date }; });

        const shopsWithStatus = allShops.map(s => ({
            id:         s.id,
            shop_name:  s.shop_name,
            submitted:  !!map[s.id],
            entryCount: map[s.id]?.count  || 0,
            lastDate:   map[s.id]?.lastDate || null,
        }));

        res.json({
            from,
            to,
            totalShops:     allShops.length,
            submittedCount: shopsWithStatus.filter(s => s.submitted).length,
            pendingCount:   shopsWithStatus.filter(s => !s.submitted).length,
            allShops:       shopsWithStatus,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────
// DELETE ENTRY (Admin only)
// Permanently deletes daily entry + related records (excel, bank ledger, audit logs)
// Reverses credited cash from shop wallet if entry was approved
// ─────────────────────────────────────────────────────────────────
exports.deleteEntry = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only Admin users can delete daily entries.' });
    }

    const uCheck = await db.query('SELECT mobile FROM users WHERE id = $1', [req.user.id]);
    if (uCheck.rows[0]?.mobile !== '8817654579') {
        return res.status(403).json({ error: 'Permission denied. Only user 8817654579 is allowed to delete entries.' });
    }

    const { id } = req.params;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Lock entry row
        const entryRes = await client.query(
            'SELECT * FROM daily_entries WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (entryRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.json({ message: 'Entry already deleted or not found.', id: parseInt(id) });
        }

        const entry = entryRes.rows[0];

        // 1. Reverse shop wallet credit if entry was APPROVED and wallet was credited
        const cashAmt = parseFloat(entry.cash || 0);
        if (entry.approval_status === 'APPROVED' && (entry.wallet_credited || cashAmt > 0)) {
            await client.query(
                'UPDATE shops SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2',
                [cashAmt, entry.shop_id]
            );
            console.log(`[deleteEntry] Reversed ₹${cashAmt} cash credit from shop #${entry.shop_id} wallet.`);
        }

        // 2. Delete linked excel upload for this shop & date if exists
        const dateStr = entry.date ? (entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : String(entry.date).split('T')[0]) : null;
        if (dateStr) {
            await client.query(
                'DELETE FROM excel_uploads WHERE shop_id = $1 AND upload_date = $2',
                [entry.shop_id, dateStr]
            );
        }

        // 3. Delete linked admin bank ledger payment_in entries
        await client.query(
            "DELETE FROM admin_bank_ledger WHERE transaction_type = 'PAYMENT_IN' AND ref_id = $1",
            [parseInt(id)]
        );

        // 4. Delete linked audit logs for this daily_entries record
        await client.query(
            "DELETE FROM audit_logs WHERE table_name = 'daily_entries' AND record_id = $1",
            [parseInt(id)]
        );

        // 5. Delete entry itself
        await client.query('DELETE FROM daily_entries WHERE id = $1', [id]);

        // 6. Record system audit log for entry deletion
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, '{"action":"DELETED"}'::jsonb, $3)`,
            [parseInt(id), JSON.stringify(entry), req.user.id]
        );

        await client.query('COMMIT');

        emitDashboard(req, { type: 'entry_deleted', id: parseInt(id) });

        return res.json({ message: 'Daily entry and all related records deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[deleteEntry error]', err);
        return res.status(500).json({ error: err.message || 'Failed to delete daily entry' });
    } finally {
        client.release();
    }
};

