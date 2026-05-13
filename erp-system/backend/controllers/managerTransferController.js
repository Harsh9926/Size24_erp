const db      = require('../config/db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

/* ── Multer setup for bank receipts ──────────────────────────────── */
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req, file, cb) => {
        const uid = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'receipt-' + uid + path.extname(file.originalname));
    },
});
const fileFilter = (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|pdf/.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only jpg, png, webp, or pdf files are allowed.'));
};
exports.upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

/* ─────────────────────────────────────────────────────────────────
   POST /api/manager-transfers
   Manager creates a pending transfer request (to admin or bank).
   Money is NOT deducted until admin approves.
───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/admins
   Manager fetches the list of admins to choose who to send cash to.
───────────────────────────────────────────────────────────────── */
exports.getAdmins = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile
             FROM users WHERE role = 'admin' AND is_approved = true
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createTransfer = async (req, res) => {
    const { amount, type, note, to_admin_id, category } = req.body;
    const managerId  = req.user.id;
    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const amt = parseFloat(amount);
    if (!type || !['manager_to_admin', 'manager_to_bank', 'manager_expense'].includes(type))
        return res.status(400).json({ error: 'Invalid transfer type.' });
    if (isNaN(amt) || amt <= 0)
        return res.status(400).json({ error: 'A positive amount is required.' });
    if (type === 'manager_to_bank' && !receiptUrl)
        return res.status(400).json({ error: 'Receipt upload is mandatory for bank deposits.' });
    if (type === 'manager_expense' && !note?.trim())
        return res.status(400).json({ error: 'Description is required for expenses.' });

    try {
        const balQ = await db.query(
            `SELECT
                COALESCE((
                    SELECT SUM(amount) FROM cash_transfers
                    WHERE to_user_id = $1 AND status IN ('accepted', 'approved')
                ), 0)
                -
                COALESCE((
                    SELECT SUM(amount) FROM manager_transfers
                    WHERE manager_id = $1 AND status IN ('approved', 'pending')
                ), 0) AS available`,
            [managerId]
        );
        const available = parseFloat(balQ.rows[0].available);
        if (available < amt)
            return res.status(400).json({
                error: `Insufficient balance. Available after pending transfers: ₹${available.toFixed(2)}`,
            });

        const result = await db.query(
            `INSERT INTO manager_transfers (manager_id, to_admin_id, amount, type, note, receipt_url, category, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
            [managerId, to_admin_id ? parseInt(to_admin_id) : null, amt, type, note || null, receiptUrl, category || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[ManagerTransfer] createTransfer:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/mine
   Manager sees all their own transfer requests (to admin or bank).
───────────────────────────────────────────────────────────────── */
exports.getMyTransfers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT mt.*, u.name AS approved_by_name
             FROM manager_transfers mt
             LEFT JOIN users u ON mt.approved_by = u.id
             WHERE mt.manager_id = $1
             ORDER BY mt.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/managers
   Admin: list of all managers with wallet balances.
───────────────────────────────────────────────────────────────── */
exports.getManagersList = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile, wallet_balance
             FROM users WHERE role = 'manager' AND is_approved = true
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/all
   Admin: all transfers — BOTH user→manager AND manager→admin/bank —
   in a single unified response, filterable by status/type/manager.
───────────────────────────────────────────────────────────────── */
exports.getAllTransfers = async (req, res) => {
    const { status, type, manager_id } = req.query;

    try {
        // ── Manager → Admin / Bank (manager_transfers table) ──────
        const mtParams      = [];
        const mtConditions  = [];

        if (status) {
            mtConditions.push(`mt.status = $${mtParams.length + 1}`);
            mtParams.push(status);
        }
        if (type && type !== 'user_to_manager') {
            mtConditions.push(`mt.type = $${mtParams.length + 1}`);
            mtParams.push(type);
        }
        if (manager_id) {
            mtConditions.push(`mt.manager_id = $${mtParams.length + 1}`);
            mtParams.push(parseInt(manager_id));
        }
        const mtWhere = mtConditions.length ? 'WHERE ' + mtConditions.join(' AND ') : '';

        const mtQ = await db.query(
            `SELECT
                mt.id,
                mt.manager_id                   AS manager_id,
                m.name                          AS manager_name,
                m.mobile                        AS manager_mobile,
                mt.amount,
                mt.type,
                mt.status,
                mt.note,
                mt.receipt_url,
                mt.created_at,
                mt.approved_by,
                a.name                          AS approved_by_name,
                NULL::text                      AS from_name,
                NULL::text                      AS from_mobile
             FROM manager_transfers mt
             JOIN  users m ON mt.manager_id  = m.id
             LEFT JOIN users a ON mt.approved_by = a.id
             ${mtWhere}
             ORDER BY mt.created_at DESC`,
            mtParams
        );

        // ── User → Manager (cash_transfers table) ─────────────────
        // Only include when type filter is absent or explicitly 'user_to_manager'
        let ctRows = [];
        if (!type || type === 'user_to_manager') {
            const ctParams     = [];
            const ctConditions = [];

            if (status) {
                // Handle legacy 'accepted' = new 'approved'
                if (status === 'approved') {
                    ctConditions.push(`ct.status IN ('approved', 'accepted')`);
                } else {
                    ctConditions.push(`ct.status = $${ctParams.length + 1}`);
                    ctParams.push(status);
                }
            }
            if (manager_id) {
                ctConditions.push(`ct.to_user_id = $${ctParams.length + 1}`);
                ctParams.push(parseInt(manager_id));
            }
            const ctWhere = ctConditions.length ? 'WHERE ' + ctConditions.join(' AND ') : '';

            const ctQ = await db.query(
                `SELECT
                    ct.id,
                    ct.to_user_id               AS manager_id,
                    tu.name                     AS manager_name,
                    tu.mobile                   AS manager_mobile,
                    ct.amount,
                    'user_to_manager'::text     AS type,
                    ct.status,
                    ct.note,
                    NULL::text                  AS receipt_url,
                    ct.created_at,
                    NULL::integer               AS approved_by,
                    NULL::text                  AS approved_by_name,
                    fu.name                     AS from_name,
                    fu.mobile                   AS from_mobile
                 FROM cash_transfers ct
                 JOIN users tu ON ct.to_user_id   = tu.id
                 JOIN users fu ON ct.from_user_id = fu.id
                 ${ctWhere}
                 ORDER BY ct.created_at DESC`,
                ctParams
            );
            ctRows = ctQ.rows;
        }

        // Merge and sort by created_at DESC
        const allRows = [...mtQ.rows, ...ctRows].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.json(allRows);
    } catch (err) {
        console.error('[ManagerTransfer] getAllTransfers:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/summary/:managerId
   Admin: full cash trail for one manager.
───────────────────────────────────────────────────────────────── */
exports.getManagerSummary = async (req, res) => {
    const { managerId } = req.params;
    try {
        const managerQ = await db.query(
            `SELECT id, name, mobile, wallet_balance
             FROM users WHERE id = $1 AND role = 'manager'`,
            [managerId]
        );
        if (!managerQ.rows.length)
            return res.status(404).json({ error: 'Manager not found.' });

        const manager = managerQ.rows[0];

        const [receivedQ, toAdminQ, toBankQ] = await Promise.all([
            // Handle both legacy 'accepted' and new 'approved'
            db.query(
                `SELECT COALESCE(SUM(amount),0) AS total
                 FROM cash_transfers
                 WHERE to_user_id = $1 AND status IN ('accepted', 'approved')`, [managerId]),
            db.query(
                `SELECT COALESCE(SUM(amount),0) AS total
                 FROM manager_transfers
                 WHERE manager_id = $1 AND type = 'manager_to_admin' AND status = 'approved'`, [managerId]),
            db.query(
                `SELECT COALESCE(SUM(amount),0) AS total
                 FROM manager_transfers
                 WHERE manager_id = $1 AND type = 'manager_to_bank' AND status = 'approved'`, [managerId]),
        ]);

        const receivedFromUsers   = parseFloat(receivedQ.rows[0].total);
        const transferredToAdmin  = parseFloat(toAdminQ.rows[0].total);
        const depositedToBank     = parseFloat(toBankQ.rows[0].total);

        // Derive remaining cash from transaction records — the stored wallet_balance
        // may be stale; this formula is always accurate.
        const remainingCash = receivedFromUsers - transferredToAdmin - depositedToBank;

        // Sync the stored balance in case it drifted (read-only side-effect of summary)
        const storedBalance = parseFloat(manager.wallet_balance);
        if (Math.abs(storedBalance - remainingCash) > 0.01) {
            await db.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [remainingCash, managerId]);
            console.log(`[ManagerSummary] Corrected wallet for manager ${managerId}: stored ₹${storedBalance} → computed ₹${remainingCash}`);
        }

        // Unified history: incoming (user→mgr) + outgoing (mgr→admin/bank)
        const historyQ = await db.query(
            `SELECT
                'user_to_manager'  AS flow_type,
                ct.amount,
                ct.status,
                fu.name            AS from_name,
                $1::text           AS to_name,
                ct.created_at,
                NULL               AS receipt_url,
                ct.note
             FROM cash_transfers ct
             JOIN users fu ON ct.from_user_id = fu.id
             WHERE ct.to_user_id = $2 AND ct.status IN ('accepted', 'approved')

             UNION ALL

             SELECT
                mt.type            AS flow_type,
                mt.amount,
                mt.status,
                $1::text           AS from_name,
                CASE mt.type
                    WHEN 'manager_to_admin' THEN 'Admin'
                    ELSE 'Bank'
                END                AS to_name,
                mt.created_at,
                mt.receipt_url,
                mt.note
             FROM manager_transfers mt
             WHERE mt.manager_id = $2

             ORDER BY created_at DESC`,
            [manager.name, managerId]
        );

        res.json({
            manager: { id: manager.id, name: manager.name, mobile: manager.mobile },
            summary: {
                wallet_balance:        remainingCash,
                received_from_users:   receivedFromUsers,
                transferred_to_admin:  transferredToAdmin,
                deposited_to_bank:     depositedToBank,
                remaining_cash:        remainingCash,
            },
            history: historyQ.rows,
        });
    } catch (err) {
        console.error('[ManagerTransfer] getManagerSummary:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/manager-transfers/:id/approve
   Admin approves:
   - manager_to_admin: debit manager wallet, credit admin wallet
   - manager_to_bank:  debit manager wallet only
───────────────────────────────────────────────────────────────── */
exports.approveTransfer = async (req, res) => {
    const { id }  = req.params;
    const adminId = req.user.id;
    const client  = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the transfer row — prevents duplicate approvals from concurrent requests
        const tQ = await client.query(
            'SELECT * FROM manager_transfers WHERE id = $1 FOR UPDATE', [id]
        );
        if (!tQ.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transfer not found.' });
        }
        const transfer = tQ.rows[0];
        if (transfer.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Transfer is already ${transfer.status}. Each transfer can only be approved once.` });
        }

        const amt = parseFloat(transfer.amount);

        // Lock the manager row to block any concurrent approval of another transfer
        // for the same manager from slipping through before this one commits.
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [transfer.manager_id]);

        // Compute TRUE balance from transaction records — not the stored wallet_balance.
        // This is the only value we trust: (total received) - (total already approved out).
        // We deliberately exclude the current pending transfer being approved so it appears
        // in the "approved" total only after this transaction commits.
        const trueBalQ = await client.query(
            `SELECT
                COALESCE((
                    SELECT SUM(amount) FROM cash_transfers
                    WHERE to_user_id = $1 AND status IN ('accepted', 'approved')
                ), 0)
                -
                COALESCE((
                    SELECT SUM(amount) FROM manager_transfers
                    WHERE manager_id = $1 AND status = 'approved'
                ), 0) AS true_balance`,
            [transfer.manager_id]
        );
        const trueBalance = parseFloat(trueBalQ.rows[0].true_balance);

        if (trueBalance < amt) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Insufficient balance. Manager has ₹${trueBalance.toFixed(2)} available; transfer requests ₹${amt.toFixed(2)}.`,
            });
        }

        // Set manager wallet to exact computed value (self-heals any stored corruption)
        const newManagerBalance = trueBalance - amt;
        await client.query(
            'UPDATE users SET wallet_balance = $1 WHERE id = $2',
            [newManagerBalance, transfer.manager_id]
        );

        // Credit admin wallet for manager_to_admin transfers
        if (transfer.type === 'manager_to_admin') {
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                [amt, adminId]
            );
        }

        const updated = await client.query(
            `UPDATE manager_transfers
             SET status = 'approved', approved_by = $1, approved_at = NOW()
             WHERE id = $2 RETURNING *`,
            [adminId, id]
        );

        await client.query('COMMIT');
        console.log(
            `[ManagerTransfer] Approved ID:${id} | Type:${transfer.type} | ` +
            `Amount:₹${amt} | True balance was:₹${trueBalance} | New balance:₹${newManagerBalance}`
        );
        res.json({ message: 'Transfer approved.', transfer: updated.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[ManagerTransfer] approveTransfer:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/manager-transfers/:id/reject
   Admin rejects — no balance change. rejection_note is required.
───────────────────────────────────────────────────────────────── */
exports.rejectTransfer = async (req, res) => {
    const { id }             = req.params;
    const { rejection_note } = req.body || {};

    if (!rejection_note || !rejection_note.trim())
        return res.status(400).json({ error: 'Rejection note is required.' });

    try {
        const tQ = await db.query('SELECT * FROM manager_transfers WHERE id = $1', [id]);
        if (!tQ.rows.length)
            return res.status(404).json({ error: 'Transfer not found.' });
        if (tQ.rows[0].status !== 'pending')
            return res.status(400).json({ error: `Transfer is already ${tQ.rows[0].status}.` });

        const result = await db.query(
            `UPDATE manager_transfers
             SET status = 'rejected', rejection_note = $1, approved_by = $2, approved_at = NOW()
             WHERE id = $3 RETURNING *`,
            [rejection_note.trim(), req.user.id, id]
        );
        console.log('[ManagerTransfer] Rejected ID:', id);
        res.json({ message: 'Transfer rejected.', transfer: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/store-wallets
   Admin: all shops with their assigned user wallet balance.
───────────────────────────────────────────────────────────────── */
exports.getStoreWallets = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                s.id AS shop_id,
                s.shop_name,
                COALESCE(s.wallet_balance, 0) AS wallet_balance,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', u.id, 'name', u.name, 'mobile', u.mobile
                    ) ORDER BY su.assigned_at)
                    FROM shop_users su
                    JOIN users u ON u.id = su.user_id
                    WHERE su.shop_id = s.id
                ), '[]'::json) AS users
             FROM shops s
             ORDER BY s.shop_name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/manager-transfers/sync-store-wallets
   Admin: recalculate wallet_balance for ALL shop users from the
   actual transaction records (APPROVED entries + accepted transfers).

   Fixes wallets that were never credited because the historical
   migrate_wallet_credited_flag.sql backfill set wallet_credited=true
   on existing APPROVED entries without crediting wallet_balance.

   Formula:
     credits = SUM(cash) from APPROVED entries
     debits  = SUM(amount) from accepted/approved outgoing cash_transfers
     wallet  = credits − debits

   Idempotent — safe to run multiple times.
───────────────────────────────────────────────────────────────── */
exports.syncStoreWallets = async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Snapshot before recalculation
        const beforeQ = await client.query(
            `SELECT id, shop_name, COALESCE(wallet_balance, 0) AS wallet_balance FROM shops ORDER BY id`
        );
        const beforeMap = {};
        for (const row of beforeQ.rows) beforeMap[row.id] = parseFloat(row.wallet_balance);

        // Recalculate: credits from APPROVED entries minus accepted/approved transfers out
        await client.query(
            `UPDATE shops s
             SET wallet_balance = COALESCE((
                 SELECT SUM(de.cash)
                 FROM daily_entries de
                 WHERE de.shop_id = s.id
                   AND de.approval_status = 'APPROVED'
             ), 0)
             - COALESCE((
                 SELECT SUM(ct.amount)
                 FROM cash_transfers ct
                 WHERE ct.shop_id = s.id
                   AND ct.status IN ('accepted', 'approved')
             ), 0)`
        );

        // Snapshot after
        const afterQ = await client.query(
            `SELECT id, shop_name, COALESCE(wallet_balance, 0) AS wallet_balance FROM shops ORDER BY id`
        );

        await client.query('COMMIT');

        const changes = afterQ.rows.map(row => {
            const after  = parseFloat(row.wallet_balance);
            const before = beforeMap[row.id] ?? 0;
            return { shop_id: row.id, name: row.shop_name, before, after, delta: after - before };
        });

        const affected = changes.filter(c => Math.abs(c.delta) > 0.001);
        console.log(
            `[syncStoreWallets] Admin ${req.user.id} recalculated wallets for ` +
            `${changes.length} shops (${affected.length} changed).`
        );

        res.json({
            message:        'Store wallet balances recalculated from transaction records.',
            shops_updated:  changes.length,
            shops_changed:  affected.length,
            changes,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[syncStoreWallets] error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};
