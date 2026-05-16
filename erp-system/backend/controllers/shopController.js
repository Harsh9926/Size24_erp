const db = require('../config/db');

exports.createShop = async (req, res) => {
    try {
        const {
            state_id, city_id, shop_name, gst_number, shop_address,
            manager_name, mobile_number, document_type, document_number, user_id
        } = req.body;

        const result = await db.query(
            `INSERT INTO shops (
                state_id, city_id, shop_name, gst_number, shop_address,
                manager_name, mobile_number, document_type, document_number,
                user_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [state_id, city_id, shop_name, gst_number, shop_address,
             manager_name, mobile_number, document_type, document_number,
             user_id || null, req.user.id]
        );

        const shop = result.rows[0];

        // Seed junction table if a primary user was provided
        if (user_id) {
            await db.query(
                'INSERT INTO shop_users (shop_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [shop.id, user_id, req.user.id]
            );
        }

        res.status(201).json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getShops = async (req, res) => {
    try {
        let query = `
            SELECT s.*, c.name as city_name, st.name as state_name,
                (SELECT COUNT(*) FROM shop_users su WHERE su.shop_id = s.id) AS user_count
            FROM shops s
            LEFT JOIN cities c  ON s.city_id  = c.id
            LEFT JOIN states st ON s.state_id = st.id`;
        let params = [];

        if (req.user.role === 'shop_user') {
            query += `
            JOIN shop_users su ON su.shop_id = s.id
            WHERE su.user_id = $1`;
            params.push(req.user.id);
        }

        query += ' ORDER BY s.shop_name ASC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getShopById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM shops WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const shop = result.rows[0];

        if (req.user.role === 'shop_user') {
            // Check junction table — any assigned user can access, not just the primary one
            const access = await db.query(
                'SELECT 1 FROM shop_users WHERE shop_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            if (access.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/shops/:shopId/users — list all users assigned to a shop
exports.getShopUsers = async (req, res) => {
    try {
        const { shopId } = req.params;
        const result = await db.query(
            `SELECT u.id, u.name, u.mobile, u.role, u.status,
                    su.assigned_at,
                    ab.name as assigned_by_name
             FROM shop_users su
             JOIN users u  ON u.id  = su.user_id
             LEFT JOIN users ab ON ab.id = su.assigned_by
             WHERE su.shop_id = $1
             ORDER BY su.assigned_at ASC`,
            [shopId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/shops/:shopId/users — assign a user to a shop
exports.addUserToShop = async (req, res) => {
    try {
        const { shopId } = req.params;
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });

        const shop = await db.query('SELECT id FROM shops WHERE id = $1', [shopId]);
        if (shop.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const user = await db.query('SELECT id, status FROM users WHERE id = $1', [user_id]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        if (user.rows[0].status !== 'active') return res.status(400).json({ error: 'Cannot assign an inactive user' });

        await db.query(
            'INSERT INTO shop_users (shop_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [shopId, user_id, req.user.id]
        );

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shop_users', $1, NULL, $2, $3)`,
            [shopId, JSON.stringify({ shop_id: shopId, user_id }), req.user.id]
        );

        res.json({ message: 'User assigned to shop' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/shops/:shopId/data — full shop reset (admin only)
// Deletes all entries, transfers, cash flows, excel uploads for the shop
// and recalculates wallet balances for all affected users from remaining data.
exports.deleteShopData = async (req, res) => {
    const { shopId } = req.params;
    const client = await db.pool.connect();
    try {
        // 1. Verify shop exists
        const shopResult = await db.query(
            'SELECT id, shop_name, user_id FROM shops WHERE id = $1',
            [shopId]
        );
        if (shopResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shop not found' });
        }
        const shop = shopResult.rows[0];

        // 2. Collect ALL user IDs linked to this shop:
        //    - primary user (shops.user_id) — receives wallet credits from approved entries
        //    - all users in shop_users junction table — may have sent transfers
        const shopUsersResult = await db.query(
            'SELECT user_id FROM shop_users WHERE shop_id = $1',
            [shopId]
        );
        const shopUserIds = [...new Set([
            ...(shop.user_id ? [shop.user_id] : []),
            ...shopUsersResult.rows.map(r => r.user_id),
        ])];

        // 3. Find managers who received accepted transfers from this shop's users
        //    (their wallets need recalculation after we delete those transfers)
        let affectedManagerIds = [];
        if (shopUserIds.length > 0) {
            const mgrsResult = await db.query(
                `SELECT DISTINCT to_user_id
                 FROM cash_transfers
                 WHERE from_user_id = ANY($1::int[]) AND status = 'accepted'`,
                [shopUserIds]
            );
            affectedManagerIds = mgrsResult.rows.map(r => r.to_user_id);
        }

        // 4. Snapshot counts before deletion (for the response + audit log)
        const [entriesRes, flowsRes, uploadsRes, transfersRes] = await Promise.all([
            db.query('SELECT COUNT(*) FROM daily_entries  WHERE shop_id = $1', [shopId]),
            db.query('SELECT COUNT(*) FROM cash_flows     WHERE shop_id = $1', [shopId]),
            db.query('SELECT COUNT(*) FROM excel_uploads  WHERE shop_id = $1', [shopId]),
            shopUserIds.length > 0
                ? db.query(
                    'SELECT COUNT(*) FROM cash_transfers WHERE from_user_id = ANY($1::int[])',
                    [shopUserIds]
                  )
                : Promise.resolve({ rows: [{ count: '0' }] }),
        ]);
        const deletedCounts = {
            daily_entries:  parseInt(entriesRes.rows[0].count),
            cash_flows:     parseInt(flowsRes.rows[0].count),
            excel_uploads:  parseInt(uploadsRes.rows[0].count),
            cash_transfers: parseInt(transfersRes.rows[0].count),
        };

        // ── BEGIN ATOMIC TRANSACTION ──────────────────────────────────
        await client.query('BEGIN');

        // 5a. Delete all shop-scoped records
        await client.query('DELETE FROM daily_entries WHERE shop_id = $1', [shopId]);
        await client.query('DELETE FROM cash_flows    WHERE shop_id = $1', [shopId]);
        await client.query('DELETE FROM excel_uploads WHERE shop_id = $1', [shopId]);

        // 5b. Delete ALL transfers initiated by this shop's users
        //     (covers pending, accepted, and rejected statuses)
        if (shopUserIds.length > 0) {
            await client.query(
                'DELETE FROM cash_transfers WHERE from_user_id = ANY($1::int[])',
                [shopUserIds]
            );
        }

        // 5c. Recalculate shop users' wallet balances from remaining DB data.
        //     Formula (derived, not stored):
        //       credits = SUM(approved entry.cash) for all shops where user is primary user
        //       debits  = SUM(accepted outgoing transfers from this user)
        //     After deletion: credits = entries from other shops only; debits = 0
        if (shopUserIds.length > 0) {
            await client.query(
                `UPDATE users u
                 SET wallet_balance = (
                     SELECT COALESCE(SUM(de.cash), 0)
                     FROM daily_entries de
                     JOIN shops s ON s.id = de.shop_id
                     WHERE s.user_id = u.id
                       AND de.approval_status = 'APPROVED'
                 ) - (
                     SELECT COALESCE(SUM(ct.amount), 0)
                     FROM cash_transfers ct
                     WHERE ct.from_user_id = u.id
                       AND ct.status = 'accepted'
                 )
                 WHERE u.id = ANY($1::int[])`,
                [shopUserIds]
            );
        }

        // 5d. Recalculate affected managers' wallet balances from remaining accepted transfers.
        //     After deletion: only transfers from OTHER shops' users remain.
        if (affectedManagerIds.length > 0) {
            await client.query(
                `UPDATE users u
                 SET wallet_balance = (
                     SELECT COALESCE(SUM(ct.amount), 0)
                     FROM cash_transfers ct
                     WHERE ct.to_user_id = u.id
                       AND ct.status = 'accepted'
                 )
                 WHERE u.id = ANY($1::int[])`,
                [affectedManagerIds]
            );
        }

        // 5e. Audit log
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shops', $1, $2, NULL, $3)`,
            [
                shopId,
                JSON.stringify({
                    action:                  'full_shop_reset',
                    shop_name:               shop.shop_name,
                    records_deleted:         deletedCounts,
                    shop_user_ids_reset:     shopUserIds,
                    manager_ids_recalculated: affectedManagerIds,
                    deleted_at:              new Date().toISOString(),
                }),
                req.user.id,
            ]
        );

        await client.query('COMMIT');
        // ── END TRANSACTION ──────────────────────────────────────────

        console.log(
            `[SHOP RESET] User ${req.user.id} fully reset shop "${shop.shop_name}" (id=${shopId}) ` +
            `at ${new Date().toISOString()}. Deleted: ${JSON.stringify(deletedCounts)}. ` +
            `Users reset: [${shopUserIds}]. Managers recalculated: [${affectedManagerIds}].`
        );

        res.json({
            message:                `Full reset complete for "${shop.shop_name}". All financial data cleared and wallets recalculated.`,
            shop_name:              shop.shop_name,
            deleted:                deletedCounts,
            wallets_reset:          shopUserIds.length,
            managers_recalculated:  affectedManagerIds.length,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[deleteShopData] Transaction rolled back:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// DELETE /api/shops/:shopId/users/:userId — remove a user from a shop
exports.removeUserFromShop = async (req, res) => {
    try {
        const { shopId, userId } = req.params;

        const result = await db.query(
            'DELETE FROM shop_users WHERE shop_id = $1 AND user_id = $2 RETURNING id',
            [shopId, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        // If this user was also the primary user on the shop, clear that too
        await db.query(
            'UPDATE shops SET user_id = NULL WHERE id = $1 AND user_id = $2',
            [shopId, userId]
        );

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shop_users', $1, $2, NULL, $3)`,
            [shopId, JSON.stringify({ shop_id: shopId, user_id: userId }), req.user.id]
        );

        res.json({ message: 'User removed from shop' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/shops/:shopId/wallet-history
   Returns the complete wallet ledger for a shop, reconstructed
   from daily_entries (credits) and cash_transfers (debits).
   Running balance is computed chronologically from all records.
───────────────────────────────────────────────────────────────── */
exports.getWalletHistory = async (req, res) => {
    try {
        const { shopId } = req.params;
        const { period, from_date, to_date } = req.query;

        // Auth: shop_user can only see their own shop
        if (req.user.role === 'shop_user' && req.user.shopId !== parseInt(shopId)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Fetch ALL transactions (unfiltered) to compute correct running balance
        const allQ = await db.query(
            `SELECT
                de.created_at,
                de.date::text            AS entry_date,
                de.cash::decimal         AS amount,
                'entry_credit'           AS txn_type,
                'Daily Entry — Cash'     AS description,
                de.id::text              AS ref_id,
                de.approval_status       AS status,
                de.entry_type,
                COALESCE(su.name, su.mobile, 'Shop User') AS done_by
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN users su ON s.user_id = su.id
             WHERE de.shop_id = $1
               AND de.cash > 0
               AND de.approval_status != 'REJECTED'

             UNION ALL

             SELECT
                ct.updated_at            AS created_at,
                ct.updated_at::date::text AS entry_date,
                (ct.amount * -1)::decimal AS amount,
                'cash_transfer'          AS txn_type,
                CONCAT('Transfer to Manager',
                    CASE WHEN ct.note IS NOT NULL THEN ' — ' || ct.note ELSE '' END)
                                         AS description,
                ct.id::text              AS ref_id,
                ct.status,
                NULL                     AS entry_type,
                mu.name                  AS done_by
             FROM cash_transfers ct
             LEFT JOIN users mu ON ct.to_user_id = mu.id
             WHERE ct.shop_id = $1
               AND ct.status IN ('accepted', 'approved')

             ORDER BY created_at ASC`,
            [shopId]
        );

        // Compute running balance for every row
        let balance = 0;
        const withBalance = allQ.rows.map(row => {
            const amt = parseFloat(row.amount);
            const prev = balance;
            balance += amt;
            return { ...row, amount: amt, balance_before: prev, balance_after: balance };
        });

        // Apply date filter AFTER computing balances
        let filtered = withBalance;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (period === 'today') {
            filtered = withBalance.filter(r => r.created_at.toISOString().split('T')[0] === today);
        } else if (period === 'yesterday') {
            filtered = withBalance.filter(r => r.created_at.toISOString().split('T')[0] === yesterday);
        } else if (period === 'last7') {
            const cutoff = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
            filtered = withBalance.filter(r => r.created_at.toISOString().split('T')[0] >= cutoff);
        } else if (from_date || to_date) {
            filtered = withBalance.filter(r => {
                const d = r.created_at.toISOString().split('T')[0];
                if (from_date && d < from_date) return false;
                if (to_date   && d > to_date)   return false;
                return true;
            });
        }

        // Return descending (most recent first), opening balance = balance at start of filtered window
        const openingBalance = filtered.length > 0 ? filtered[0].balance_before : balance;
        const latestTxn = withBalance.length > 0 ? withBalance[withBalance.length - 1] : null;

        res.json({
            currentBalance: balance,
            openingBalance,
            transactions: filtered.reverse(),
            latestTransaction: latestTxn,
            totalCount: withBalance.length,
        });
    } catch (err) {
        console.error('[ShopWalletHistory]', err.message);
        res.status(500).json({ error: err.message });
    }
};
