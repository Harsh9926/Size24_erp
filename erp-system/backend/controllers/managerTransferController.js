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
exports.createTransfer = async (req, res) => {
    const { amount, type, note } = req.body;
    const managerId  = req.user.id;
    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const amt = parseFloat(amount);
    if (!type || !['manager_to_admin', 'manager_to_bank'].includes(type))
        return res.status(400).json({ error: 'type must be manager_to_admin or manager_to_bank.' });
    if (isNaN(amt) || amt <= 0)
        return res.status(400).json({ error: 'A positive amount is required.' });
    if (type === 'manager_to_bank' && !receiptUrl)
        return res.status(400).json({ error: 'Receipt upload is mandatory for bank deposits.' });

    try {
        const balQ    = await db.query('SELECT wallet_balance FROM users WHERE id = $1', [managerId]);
        const balance = parseFloat(balQ.rows[0]?.wallet_balance || 0);
        if (balance < amt)
            return res.status(400).json({ error: `Insufficient wallet balance. Available: ₹${balance.toFixed(2)}` });

        const result = await db.query(
            `INSERT INTO manager_transfers (manager_id, amount, type, note, receipt_url, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
            [managerId, amt, type, note || null, receiptUrl]
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
        const walletBalance       = parseFloat(manager.wallet_balance);

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
                wallet_balance:        walletBalance,
                received_from_users:   receivedFromUsers,
                transferred_to_admin:  transferredToAdmin,
                deposited_to_bank:     depositedToBank,
                remaining_cash:        walletBalance,
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
            return res.status(400).json({ error: `Transfer is already ${transfer.status}.` });
        }

        const amt  = parseFloat(transfer.amount);
        const mgrQ = await client.query(
            'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [transfer.manager_id]
        );
        const balance = parseFloat(mgrQ.rows[0]?.wallet_balance || 0);
        if (balance < amt) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Manager balance (₹${balance.toFixed(2)}) is insufficient.` });
        }

        // Debit manager wallet
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [amt, transfer.manager_id]
        );

        // Credit admin wallet only for manager→admin transfers
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
        console.log('[ManagerTransfer] Approved ID:', id, '| Type:', transfer.type, '| Amount: ₹', amt);
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
   Admin rejects — no balance change.
───────────────────────────────────────────────────────────────── */
exports.rejectTransfer = async (req, res) => {
    const { id }            = req.params;
    const { rejection_note } = req.body;
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
            [rejection_note || null, req.user.id, id]
        );
        console.log('[ManagerTransfer] Rejected ID:', id);
        res.json({ message: 'Transfer rejected.', transfer: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
