const db = require('../config/db');

/* ─────────────────────────────────────────────────────────────────
   POST /api/transfers
   Shop user initiates a transfer to a manager.
   Balance is NOT deducted yet — just a pending record.
───────────────────────────────────────────────────────────────── */
exports.createTransfer = async (req, res) => {
    const { to_user_id, amount, note } = req.body;
    const fromUserId = req.user.id;

    const amt = parseFloat(amount);
    if (!to_user_id || !amount || isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: 'to_user_id and a positive amount are required.' });
    }

    try {
        // Verify recipient exists and is a manager
        const recipientQ = await db.query(
            'SELECT id, name, role FROM users WHERE id = $1 AND is_approved = true',
            [to_user_id]
        );
        if (recipientQ.rows.length === 0)
            return res.status(404).json({ error: 'Recipient not found.' });
        if (recipientQ.rows[0].role !== 'manager')
            return res.status(400).json({ error: 'Cash can only be transferred to a manager.' });

        // Check sender balance
        const senderQ = await db.query(
            'SELECT wallet_balance FROM users WHERE id = $1',
            [fromUserId]
        );
        const balance = parseFloat(senderQ.rows[0]?.wallet_balance || 0);
        if (balance < amt) {
            return res.status(400).json({
                error: `Insufficient balance. Available: ₹${balance.toFixed(2)}`,
            });
        }

        // Create transfer (no balance change yet)
        const result = await db.query(
            `INSERT INTO cash_transfers (from_user_id, to_user_id, amount, note, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING *`,
            [fromUserId, to_user_id, amt, note || null]
        );

        console.log('[Transfer] Created:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[Transfer] createTransfer error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/transfers/:id/accept
   Manager accepts — atomically moves money in a DB transaction.
   Uses SELECT ... FOR UPDATE to prevent double-processing.
───────────────────────────────────────────────────────────────── */
exports.acceptTransfer = async (req, res) => {
    const { id } = req.params;
    const managerId = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Lock this transfer row — prevents concurrent accept on same record
        const tQ = await client.query(
            'SELECT * FROM cash_transfers WHERE id = $1 FOR UPDATE',
            [id]
        );
        if (tQ.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transfer not found.' });
        }

        const transfer = tQ.rows[0];

        if (transfer.to_user_id !== managerId)
            throw { status: 403, message: 'This transfer is not assigned to you.' };
        if (transfer.status !== 'pending')
            throw { status: 400, message: `Transfer is already ${transfer.status}.` };

        const amt = parseFloat(transfer.amount);

        // Lock sender row and re-verify balance (may have changed since creation)
        const senderQ = await client.query(
            'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
            [transfer.from_user_id]
        );
        const senderBalance = parseFloat(senderQ.rows[0]?.wallet_balance || 0);
        if (senderBalance < amt) {
            throw {
                status: 400,
                message: `Sender's balance (₹${senderBalance.toFixed(2)}) is less than transfer amount (₹${amt.toFixed(2)}).`,
            };
        }

        // Deduct from sender
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [amt, transfer.from_user_id]
        );

        // Credit to manager
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
            [amt, managerId]
        );

        // Mark accepted
        const updated = await client.query(
            `UPDATE cash_transfers
             SET status = 'accepted', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await client.query('COMMIT');
        console.log('[Transfer] Accepted ID:', id, '| Amount: ₹', amt);
        res.json({ message: 'Transfer accepted.', transfer: updated.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Transfer] acceptTransfer error:', err.message);
        res.status(err.status || 500).json({ error: err.message });
    } finally {
        client.release();
    }
};

/* ─────────────────────────────────────────────────────────────────
   PUT /api/transfers/:id/reject
   Manager rejects — no balance change needed.
───────────────────────────────────────────────────────────────── */
exports.rejectTransfer = async (req, res) => {
    const { id } = req.params;
    const managerId = req.user.id;

    try {
        const tQ = await db.query(
            'SELECT * FROM cash_transfers WHERE id = $1',
            [id]
        );
        if (tQ.rows.length === 0)
            return res.status(404).json({ error: 'Transfer not found.' });

        const transfer = tQ.rows[0];
        if (transfer.to_user_id !== managerId)
            return res.status(403).json({ error: 'This transfer is not assigned to you.' });
        if (transfer.status !== 'pending')
            return res.status(400).json({ error: `Transfer is already ${transfer.status}.` });

        const result = await db.query(
            `UPDATE cash_transfers
             SET status = 'rejected', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        console.log('[Transfer] Rejected ID:', id);
        res.json({ message: 'Transfer rejected.', transfer: result.rows[0] });
    } catch (err) {
        console.error('[Transfer] rejectTransfer error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/transfers/admin  — admin sees every transfer
───────────────────────────────────────────────────────────────── */
exports.getAdminTransfers = async (req, res) => {
    const { status } = req.query;
    const params = [];
    const conditions = [];

    if (status) {
        conditions.push(`ct.status = $${params.length + 1}`);
        params.push(status.toLowerCase());
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const result = await db.query(
            `SELECT ct.*,
                    fu.name   AS from_name,   fu.mobile AS from_mobile,
                    tu.name   AS to_name,     tu.mobile AS to_mobile
             FROM cash_transfers ct
             JOIN users fu ON ct.from_user_id = fu.id
             JOIN users tu ON ct.to_user_id   = tu.id
             ${where}
             ORDER BY ct.created_at DESC`,
            params
        );
        console.log('[Transfer] Admin fetched:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/transfers/manager  — manager sees transfers to them
───────────────────────────────────────────────────────────────── */
exports.getManagerTransfers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ct.*,
                    fu.name AS from_name, fu.mobile AS from_mobile
             FROM cash_transfers ct
             JOIN users fu ON ct.from_user_id = fu.id
             WHERE ct.to_user_id = $1
             ORDER BY ct.created_at DESC`,
            [req.user.id]
        );
        console.log('[Transfer] Manager fetched:', result.rows.length);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/transfers/mine  — shop_user sees their own transfers
───────────────────────────────────────────────────────────────── */
exports.getMyTransfers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ct.*,
                    tu.name AS to_name, tu.mobile AS to_mobile
             FROM cash_transfers ct
             JOIN users tu ON ct.to_user_id = tu.id
             WHERE ct.from_user_id = $1
             ORDER BY ct.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/transfers/balance  — own wallet balance
───────────────────────────────────────────────────────────────── */
exports.getBalance = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT wallet_balance FROM users WHERE id = $1',
            [req.user.id]
        );
        res.json({ balance: parseFloat(result.rows[0]?.wallet_balance || 0) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/transfers/managers  — list of approved managers
   Used by shop_user to populate the transfer recipient dropdown.
───────────────────────────────────────────────────────────────── */
exports.getManagers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile
             FROM users
             WHERE role = 'manager' AND is_approved = true
             ORDER BY name`,
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
