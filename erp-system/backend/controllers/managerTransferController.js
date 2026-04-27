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
   type: 'manager_to_admin' | 'manager_to_bank'
   Bank deposits MUST include a receipt file.
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
        const balQ   = await db.query('SELECT wallet_balance FROM users WHERE id = $1', [managerId]);
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
   Manager sees all their own transfer requests.
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
   Admin gets list of all managers with wallet balances.
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
   Admin sees all manager transfer requests (filterable).
───────────────────────────────────────────────────────────────── */
exports.getAllTransfers = async (req, res) => {
    const { status, type, manager_id } = req.query;
    const params = [], conditions = [];

    if (status)     { conditions.push(`mt.status = $${params.length + 1}`);     params.push(status); }
    if (type)       { conditions.push(`mt.type = $${params.length + 1}`);        params.push(type); }
    if (manager_id) { conditions.push(`mt.manager_id = $${params.length + 1}`); params.push(parseInt(manager_id)); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const result = await db.query(
            `SELECT mt.*,
                    m.name   AS manager_name,    m.mobile AS manager_mobile,
                    a.name   AS approved_by_name
             FROM manager_transfers mt
             JOIN  users m ON mt.manager_id  = m.id
             LEFT JOIN users a ON mt.approved_by = a.id
             ${where}
             ORDER BY mt.created_at DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/manager-transfers/summary/:managerId
   Admin gets the full cash trail for one manager:
     - wallet balance, received from users, sent to admin, to bank
     - unified transaction history (user→mgr + mgr→admin/bank)
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
            db.query(
                `SELECT COALESCE(SUM(amount),0) AS total
                 FROM cash_transfers
                 WHERE to_user_id = $1 AND status = 'accepted'`, [managerId]),
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
                'accepted'         AS status,
                fu.name            AS from_name,
                $1::text           AS to_name,
                ct.created_at,
                NULL               AS receipt_url,
                ct.note
             FROM cash_transfers ct
             JOIN users fu ON ct.from_user_id = fu.id
             WHERE ct.to_user_id = $2 AND ct.status = 'accepted'

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
   Admin approves → atomically deducts from manager wallet.
───────────────────────────────────────────────────────────────── */
exports.approveTransfer = async (req, res) => {
    const { id }    = req.params;
    const adminId   = req.user.id;
    const client    = await db.pool.connect();
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

        const amt     = parseFloat(transfer.amount);
        const mgrQ    = await client.query(
            'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [transfer.manager_id]
        );
        const balance = parseFloat(mgrQ.rows[0]?.wallet_balance || 0);
        if (balance < amt) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Manager balance (₹${balance.toFixed(2)}) is insufficient.` });
        }

        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [amt, transfer.manager_id]
        );
        const updated = await client.query(
            `UPDATE manager_transfers
             SET status = 'approved', approved_by = $1, approved_at = NOW()
             WHERE id = $2 RETURNING *`,
            [adminId, id]
        );

        await client.query('COMMIT');
        console.log('[ManagerTransfer] Approved ID:', id, '| Amount: ₹', amt);
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
    const { id }           = req.params;
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
