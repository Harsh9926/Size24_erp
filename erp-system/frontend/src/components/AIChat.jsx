import React, { useContext, useState, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const BOT_AVATAR = '🤖';
const WELCOME = 'Namaste! Main SIZE24 ERP ka AI assistant hoon. Aaj ki sales, cash, shop wallets ya kuch bhi poochho — Hindi ya English mein.';

export default function AIChat() {
    const { user } = useContext(AuthContext);
    const [open, setOpen]       = useState(false);
    const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
    const [input, setInput]     = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef             = useRef(null);
    const inputRef              = useRef(null);

    // Only show for admin / manager
    if (!user || !['admin', 'manager'].includes(user.role)) return null;

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
            const errMsg = err.response?.data?.error || 'Kuch error aa gayi. Dobara try karo.';
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
            {/* Floating bubble */}
            <button
                onClick={() => setOpen(o => !o)}
                title="AI Assistant"
                style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B00, #ff9a00)',
                    border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,107,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                {open ? '✕' : '🤖'}
            </button>

            {/* Chat panel */}
            {open && (
                <div
                    style={{
                        position: 'fixed', bottom: 86, right: 24, zIndex: 999,
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
