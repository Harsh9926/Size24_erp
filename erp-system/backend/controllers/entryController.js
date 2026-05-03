const db = require('../config/db');

/*
 * FIELD CONTRACT
 * ─────────────────────────────────────────────────────────────────
 * excel_total_sale  — locked from Excel; NEVER editable by shop user
 * total_sale        — equals excel_total_sale (kept for analytics joins)
 * cash              — user-entered
 * online            — QR / Card / Bank (user-entered)
 * razorpay          — user-entered
 * approval_status   — PENDING | APPROVED | REJECTED
 *
 * Breakdown validation:  cash + online + razorpay  must == excel_total_sale
 */

const getTodayUTC = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────
// CREATE
// - shop_user: saves as PENDING, date must be today
// - admin:     saves as APPROVED immediately, credits cash to wallet
// ─────────────────────────────────────────────────────────────────
exports.createEntry = async (req, res) => {
    const { shop_id, date, excel_total_sale, cash, online, razorpay } = req.body;
    const isAdmin = req.user.role === 'admin';

    const entryDate = date ? String(date).split('T')[0] : null;
    if (!entryDate) return res.status(400).json({ error: 'Date is required.' });

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
    const breakdownSum = parseFloat(cash || 0) + parseFloat(online || 0) + parseFloat(razorpay || 0);

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

            const result = await client.query(
                `INSERT INTO daily_entries
                    (shop_id, date, total_sale, excel_total_sale, cash, online, razorpay,
                     approval_status, locked, approved_by, approved_at)
                 VALUES ($1, $2, $3, $3, $4, $5, $6, 'APPROVED', true, $7, NOW())
                 RETURNING *`,
                [shop_id, entryDate, excelTotal, cash || 0, online || 0, razorpay || 0, req.user.id],
            );

            // Credit cash portion to shop user's wallet
            const shopResult = await client.query(
                'SELECT user_id FROM shops WHERE id = $1', [shop_id],
            );
            if (shopResult.rows[0]?.user_id) {
                await client.query(
                    'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                    [parseFloat(cash || 0), shopResult.rows[0].user_id],
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

    // ── Shop user path: save as PENDING ───────────────────────────
    try {
        const result = await db.query(
            `INSERT INTO daily_entries
                (shop_id, date, total_sale, excel_total_sale, cash, online, razorpay,
                 approval_status)
             VALUES ($1, $2, $3, $3, $4, $5, $6, 'PENDING')
             RETURNING *`,
            [shop_id, entryDate, excelTotal, cash || 0, online || 0, razorpay || 0],
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
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
    const { cash, online, razorpay, total_sale, excel_total_sale, date } = req.body;

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
        if (entry.approval_status === 'APPROVED' && !isAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Approved entries cannot be edited.' });
        }
        if (!isAdmin && entry.locked) {
            const unlockActive =
                entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);
            if (!unlockActive) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'Entry is locked. Request admin to unlock.' });
            }
        }

        // ── Compute new values ───────────────────────────────────
        const newCash      = parseFloat(cash     ?? entry.cash     ?? 0);
        const newOnline    = parseFloat(online   ?? entry.online   ?? 0);
        const newRazorpay  = parseFloat(razorpay ?? entry.razorpay ?? 0);
        const breakdownSum = newCash + newOnline + newRazorpay;

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
        const setCols  = ['cash = $1', 'online = $2', 'razorpay = $3'];
        const setVals  = [newCash, newOnline, newRazorpay];
        let   pIdx     = 4;

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
                const shopRes = await client.query(
                    'SELECT user_id FROM shops WHERE id = $1', [entry.shop_id],
                );
                if (shopRes.rows[0]?.user_id) {
                    await client.query(
                        'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                        [cashDelta, shopRes.rows[0].user_id],
                    );
                    console.log(`[updateEntry] Wallet adjusted by ₹${cashDelta} for user #${shopRes.rows[0].user_id}`);
                }
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
        const { status, date_from, date_to, shop_id, page, limit = 20 } = req.query;

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
            LEFT JOIN users su  ON s.user_id     = su.id
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

        const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
        const order = ' ORDER BY e.date DESC, e.created_at DESC';

        // Without ?page — return flat array (backward compat for AdminApprovalPage)
        if (!page) {
            const result = await db.query(baseSelect + where + order, params);
            return res.json(result.rows);
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
            entries: result.rows,
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
             LEFT JOIN users u  ON s.user_id  = u.id
             WHERE e.approval_status = 'PENDING'
             ORDER BY e.created_at ASC`,
        );
        res.json(result.rows);
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
        const shopResult = await client.query(
            'SELECT user_id FROM shops WHERE id = $1',
            [entry.shop_id],
        );

        if (shopResult.rows.length > 0 && shopResult.rows[0].user_id) {
            const shopUserId = shopResult.rows[0].user_id;
            const cashAmt    = parseFloat(entry.cash || 0);

            await client.query(
                'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2',
                [cashAmt, shopUserId],
            );

            console.log(
                `[approveEntry] Entry #${id} approved. ₹${cashAmt} credited to user #${shopUserId} wallet.`,
            );
        }

        // 3. Audit log
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2::jsonb, $3::jsonb, $4)`,
            [id, JSON.stringify(entry), JSON.stringify(updated.rows[0]), req.user.id],
        );

        await client.query('COMMIT');

        res.json({ message: 'Entry approved successfully.', entry: updated.rows[0] });
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
// ─────────────────────────────────────────────────────────────────
exports.rejectEntry = async (req, res) => {
    try {
        const { id }            = req.params;
        const { rejection_note } = req.body;

        const entryResult = await db.query(
            'SELECT * FROM daily_entries WHERE id = $1', [id],
        );
        if (entryResult.rows.length === 0)
            return res.status(404).json({ error: 'Entry not found' });

        if (entryResult.rows[0].approval_status !== 'PENDING')
            return res.status(400).json({
                error: `Entry is already ${entryResult.rows[0].approval_status.toLowerCase()}. Only PENDING entries can be rejected.`,
            });

        const result = await db.query(
            `UPDATE daily_entries
             SET approval_status = 'REJECTED',
                 approved_by     = $1,
                 approved_at     = NOW(),
                 rejection_note  = $2
             WHERE id = $3
             RETURNING *`,
            [req.user.id, rejection_note || null, id],
        );

        // Audit
        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('daily_entries', $1, $2, $3, $4)`,
            [id, entryResult.rows[0], result.rows[0], req.user.id],
        );

        res.json({ message: 'Entry rejected.', entry: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
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

        // Reverse the cash that was credited to the shop wallet on approval
        if (entry.approval_status === 'APPROVED') {
            const shopResult = await client.query(
                'SELECT user_id FROM shops WHERE id = $1', [entry.shop_id],
            );
            if (shopResult.rows[0]?.user_id) {
                await client.query(
                    'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) - $1 WHERE id = $2',
                    [parseFloat(entry.cash || 0), shopResult.rows[0].user_id],
                );
            }
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
