const Anthropic          = require('@anthropic-ai/sdk');
const { buildContext }   = require('../services/erpContext');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

        const systemPrompt = `You are SIZE24 ERP's AI business assistant. You have access to live data from the ERP system.

LIVE ERP DATA:
---
${context}
---

Rules:
- Always respond in English only, regardless of what language the user writes in.
- Answer any question about the portal: shops, users, entries, sales, wallets, managers, transfers, pending approvals, features — everything.
- Base answers strictly on the data above. If something is not in the data, say "This data is not available right now."
- Show amounts in Indian format with ₹ symbol (e.g. ₹1,23,456).
- Keep answers short and clear — the business owner's time is valuable.
- If asked about features or how something works, explain it clearly and helpfully.`;

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
