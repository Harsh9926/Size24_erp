const { buildContext } = require('../services/erpContext');

exports.getContext = async (req, res) => {
    const secret = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (!process.env.MCP_SECRET || secret !== process.env.MCP_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const text = await buildContext();
        res.type('text/plain').send(text);
    } catch (err) {
        console.error('[MCP] context error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
