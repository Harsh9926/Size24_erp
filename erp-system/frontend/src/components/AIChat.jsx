import React, { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const BOT_AVATAR = '🤖';
const WELCOME = 'Hello! I am SIZE24 ERP\'s AI assistant. Ask me anything — shops, users, sales, entries, wallets, managers, features, or anything about this portal.';

export default function AIChat() {
    const { user } = useContext(AuthContext);
    const [open, setOpen]       = useState(false);
    const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
    const [input, setInput]     = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef             = useRef(null);
    const inputRef              = useRef(null);

    // ── Draggable floating bubble ──────────────────────────────────
    const BUBBLE = 52;
    const [pos, setPos] = useState(null);           // {left, top}; null → default bottom-right
    const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, offX: 0, offY: 0 });

    useEffect(() => {
        const saved = localStorage.getItem('aichat_pos');
        if (saved) { try { setPos(JSON.parse(saved)); return; } catch { /* ignore */ } }
        setPos({ left: window.innerWidth - BUBBLE - 24, top: window.innerHeight - BUBBLE - 24 });
    }, []);

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const onPointerDown = (e) => {
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
        const p = pos || { left: window.innerWidth - BUBBLE - 24, top: window.innerHeight - BUBBLE - 24 };
        dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY,
                            offX: e.clientX - p.left, offY: e.clientY - p.top };
    };
    const onPointerMove = (e) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5) d.moved = true;
        setPos({
            left: clamp(e.clientX - d.offX, 8, window.innerWidth  - BUBBLE - 8),
            top:  clamp(e.clientY - d.offY, 8, window.innerHeight - BUBBLE - 8),
        });
    };
    const onPointerUp = (e) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        d.dragging = false;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (!d.moved) setOpen(o => !o);                                   // treat as click
        else if (pos) localStorage.setItem('aichat_pos', JSON.stringify(pos)); // remember new spot
    };

    // Only show when logged in
    if (!user) return null;

    // Bubble anchored to dragged position (falls back to bottom-right until measured)
    const bubbleStyle = pos ? { left: pos.left, top: pos.top } : { right: 24, bottom: 24 };
    // Panel anchored near the bubble; flips below if there's no room above
    let panelStyle = { right: 24, bottom: 86 };
    if (pos) {
        const pw = 340, ph = 480;
        const left = clamp(pos.left + BUBBLE - pw, 8, Math.max(8, window.innerWidth - pw - 8));
        let top = pos.top - ph - 10;
        if (top < 8) top = clamp(pos.top + BUBBLE + 10, 8, Math.max(8, window.innerHeight - 120));
        panelStyle = { left, top };
    }

    const scrollBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    useEffect(() => { if (open) { scrollBottom(); inputRef.current?.focus(); } }, [open, messages]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg = { role: 'user', content: text };
        const next = [...messages, userMsg];
        setMessages(next);
        setInput('');
        setLoading(true);

        try {
            // Pass conversation history (skip the welcome message)
            const history = next.slice(1, -1); // all except welcome + latest user msg
            const { data } = await api.post('/ai/chat', { message: text, history });
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Something went wrong. Please try again.';
            setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <>
            {/* Floating bubble — draggable */}
            <button
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                title="AI Assistant (drag to move)"
                style={{
                    position: 'fixed', ...bubbleStyle, zIndex: 9999,
                    width: BUBBLE, height: BUBBLE, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B00, #ff9a00)',
                    border: 'none', cursor: 'grab', boxShadow: '0 4px 20px rgba(255,107,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, touchAction: 'none', userSelect: 'none',
                }}
            >
                {open ? '✕' : '🤖'}
            </button>

            {/* Chat panel */}
            {open && (
                <div
                    style={{
                        position: 'fixed', ...panelStyle, zIndex: 9998,
                        width: 340, maxWidth: 'calc(100vw - 48px)',
                        height: 480, maxHeight: 'calc(100vh - 120px)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 16,
                        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(135deg, #FF6B00, #ff9a00)',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <span style={{ fontSize: 20 }}>🤖</span>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>SIZE24 AI</div>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Business assistant</div>
                        </div>
                        <button
                            onClick={() => setMessages([{ role: 'assistant', content: WELCOME }])}
                            title="Clear chat"
                            style={{
                                marginLeft: 'auto', background: 'rgba(255,255,255,0.2)',
                                border: 'none', borderRadius: 6, color: '#fff',
                                padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end', gap: 6,
                            }}>
                                {m.role === 'assistant' && (
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{BOT_AVATAR}</span>
                                )}
                                <div style={{
                                    maxWidth: '82%',
                                    background: m.role === 'user'
                                        ? 'linear-gradient(135deg, #FF6B00, #ff9a00)'
                                        : 'var(--bg-primary)',
                                    color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    padding: '9px 13px',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    border: m.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                                }}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 16 }}>{BOT_AVATAR}</span>
                                <div style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px 16px 16px 4px',
                                    padding: '9px 14px',
                                    fontSize: 13,
                                    color: 'var(--text-secondary)',
                                }}>
                                    <span style={{ animation: 'pulse 1s infinite' }}>Soch raha hoon…</span>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex', gap: 8, alignItems: 'flex-end',
                        background: 'var(--bg-surface)',
                    }}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder="Kuch bhi poochho…"
                            rows={1}
                            disabled={loading}
                            style={{
                                flex: 1, resize: 'none', border: '1px solid var(--border-color)',
                                borderRadius: 10, padding: '8px 12px',
                                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                fontSize: 13, lineHeight: 1.5,
                                outline: 'none', fontFamily: 'inherit',
                                maxHeight: 80, overflowY: 'auto',
                            }}
                        />
                        <button
                            onClick={send}
                            disabled={loading || !input.trim()}
                            style={{
                                background: loading || !input.trim() ? 'var(--bg-primary)' : 'linear-gradient(135deg, #FF6B00, #ff9a00)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 10,
                                color: loading || !input.trim() ? 'var(--text-secondary)' : '#fff',
                                padding: '8px 14px',
                                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                fontSize: 15, fontWeight: 700,
                                transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >
                            ↑
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
