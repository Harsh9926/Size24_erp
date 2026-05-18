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
