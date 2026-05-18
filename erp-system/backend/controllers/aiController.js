const db        = require('../config/db');
const Anthropic  = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fetch a rich snapshot of today's business data to give Claude context
async function buildContext() {
    const today = new Date().toISOString().split('T')[0];

    const [entries, shops, wallets, managerFunds, transfers] = await Promise.all([
        // Today's entries with shop names and submitter names
        db.query(
            `SELECT de.date, s.shop_name, u.name AS submitted_by,
                    de.entry_type, de.total_sale, de.excel_total_sale,
                    de.cash, de.online, de.razorpay, de.approval_status
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN users u ON de.submitted_by = u.id
             WHERE de.date = $1
             ORDER BY s.shop_name`,
            [today]
        ),
        // All active shops
        db.query(
            `SELECT s.shop_name, c.name AS city, s.wallet_balance
             FROM shops s
             LEFT JOIN cities c ON s.city_id = c.id
             ORDER BY s.shop_name`
        ),
        // Shop wallet balances > 0
        db.query(
            `SELECT s.shop_name, s.wallet_balance
             FROM shops s
             WHERE s.wallet_balance > 0
             ORDER BY s.wallet_balance DESC`
        ),
        // Manager fund balances
        db.query(
            `SELECT u.name, mf.balance, mf.updated_at
             FROM manager_funds mf
             JOIN users u ON mf.manager_id = u.id
             ORDER BY mf.balance DESC`
        ).catch(() => ({ rows: [] })),
        // Recent transfers (last 7 days)
        db.query(
            `SELECT t.amount, t.note, t.created_at,
                    s.shop_name AS from_shop,
                    u.name AS transferred_by
             FROM wallet_transfers t
             JOIN shops s ON t.from_shop_id = s.id
             JOIN users u ON t.transferred_by = u.id
             WHERE t.created_at >= NOW() - INTERVAL '7 days'
             ORDER BY t.created_at DESC
             LIMIT 20`
        ).catch(() => ({ rows: [] })),
    ]);

    const lines = [];

    lines.push(`Aaj ki date: ${today}`);
    lines.push('');

    // Today's entries
    if (entries.rows.length === 0) {
        lines.push('Aaj kisi bhi shop ne entry submit nahin ki.');
    } else {
        lines.push(`Aaj ki entries (${entries.rows.length} shops):`);
        for (const e of entries.rows) {
            const type = e.entry_type === 'no_sale' ? 'No Sale' : 'Normal';
            const sale = e.total_sale != null ? `₹${Number(e.total_sale).toLocaleString('en-IN')}` : '—';
            const cash = e.cash != null ? `₹${Number(e.cash).toLocaleString('en-IN')}` : '—';
            const online = (Number(e.online || 0) + Number(e.razorpay || 0));
            lines.push(
                `  • ${e.shop_name}: ${type}, Sale ${sale}, Cash ${cash}, Online ₹${online.toLocaleString('en-IN')}, Status: ${e.approval_status}, By: ${e.submitted_by || 'N/A'}`
            );
        }
    }
    lines.push('');

    // Totals for today (approved only)
    const approved = entries.rows.filter(r => r.approval_status === 'APPROVED');
    if (approved.length > 0) {
        const totalSale  = approved.reduce((s, r) => s + Number(r.total_sale || 0), 0);
        const totalCash  = approved.reduce((s, r) => s + Number(r.cash || 0), 0);
        const totalOnline = approved.reduce((s, r) => s + Number(r.online || 0) + Number(r.razorpay || 0), 0);
        lines.push(`Aaj approved entries ka total:`);
        lines.push(`  Total Sale: ₹${totalSale.toLocaleString('en-IN')}`);
        lines.push(`  Cash: ₹${totalCash.toLocaleString('en-IN')}`);
        lines.push(`  Online/Razorpay: ₹${totalOnline.toLocaleString('en-IN')}`);
        lines.push('');
    }

    // Shop wallet balances
    if (wallets.rows.length > 0) {
        lines.push('Shop wallet balances (jo shops me cash hai):');
        for (const w of wallets.rows) {
            lines.push(`  • ${w.shop_name}: ₹${Number(w.wallet_balance).toLocaleString('en-IN')}`);
        }
        lines.push('');
    }

    // Manager funds
    if (managerFunds.rows.length > 0) {
        lines.push('Manager fund balances:');
        for (const m of managerFunds.rows) {
            lines.push(`  • ${m.name}: ₹${Number(m.balance).toLocaleString('en-IN')}`);
        }
        lines.push('');
    }

    // Recent transfers
    if (transfers.rows.length > 0) {
        lines.push('Pichle 7 din ke transfers:');
        for (const t of transfers.rows) {
            const date = new Date(t.created_at).toLocaleDateString('en-IN');
            lines.push(`  • ${date}: ${t.from_shop} se ₹${Number(t.amount).toLocaleString('en-IN')} transfer (by ${t.transferred_by})${t.note ? ' — ' + t.note : ''}`);
        }
        lines.push('');
    }

    // All shops list
    lines.push(`Total shops: ${shops.rows.length}`);
    for (const s of shops.rows) {
        lines.push(`  • ${s.shop_name} (${s.city || '?'}), Wallet: ₹${Number(s.wallet_balance || 0).toLocaleString('en-IN')}`);
    }

    return lines.join('\n');
}

exports.chat = async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
    }

    try {
        const context = await buildContext();

        const systemPrompt = `Tu SIZE24 ERP ka AI assistant hai. Tu ek helpful retail business assistant hai jo Hindi aur English dono mein baat kar sakta hai — jaise bhi user bole.

Tujhe real database se ye data milta hai:
---
${context}
---

Rules:
- Sirf is data ke basis par jawab de. Jo data nahi hai uske baare mein clearly bol ki "yeh data available nahi hai".
- Amounts Indian format mein batao (₹ sign ke saath, commas ke saath).
- Short aur clear jawab do — business owner ka time quimti hai.
- Agar kuch confusing ho toh seedha pooch.`;

        const messages = [
            ...history.map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message },
        ];

        const response = await client.messages.create({
            model:      'claude-haiku-4-5',
            max_tokens: 1024,
            system:     systemPrompt,
            messages,
        });

        const reply = response.content[0]?.text || 'Koi response nahi mila.';
        res.json({ reply });
    } catch (err) {
        console.error('[AI] Chat error:', err.message);
        res.status(500).json({ error: 'AI response failed: ' + err.message });
    }
};
