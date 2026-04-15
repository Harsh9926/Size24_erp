import React, { useState, useContext, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    motion, useMotionValue, useTransform, useSpring,
    AnimatePresence, useAnimation
} from 'framer-motion';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import ParticleCanvas from '../components/ParticleCanvas';

/* ─── CSS keyframes injected once ───────────────────────────────── */
const injectStyles = () => {
    if (document.getElementById('s24-styles')) return;
    const s = document.createElement('style');
    s.id = 's24-styles';
    s.textContent = `
    @keyframes orbit { from{transform:rotate(0deg) translateX(70px) rotate(0deg)} to{transform:rotate(360deg) translateX(70px) rotate(-360deg)} }
  `;
    document.head.appendChild(s);
};
injectStyles();

/* ─── SVG school uniform illustrations ─────────────────────────── */
const ShirtSVG = () => (
    <svg width="70" height="70" viewBox="0 0 80 80" fill="none">
        <path d="M15 20L5 30L15 35V70H65V35L75 30L65 20L55 28C52 32 48 34 40 34C32 34 28 32 25 28L15 20Z" fill="#1E3A5F" />
        <path d="M25 28C28 32 32 34 40 34C48 34 52 32 55 28" stroke="#93c5fd" strokeWidth="2" fill="none" />
        <rect x="34" y="36" width="12" height="18" rx="2" fill="white" opacity="0.12" />
    </svg>
);
const BlazerSVG = () => (
    <svg width="80" height="80" viewBox="0 0 90 90" fill="none">
        <path d="M10 15L25 10L35 30L45 20L55 30L65 10L80 15V80H10V15Z" fill="#1a2a4a" />
        <path d="M45 20L35 30L30 80H45V20Z" fill="#0f1e36" />
        <path d="M45 20L55 30L60 80H45V20Z" fill="#0f1e36" />
        <path d="M25 10L35 30" stroke="#FF6B00" strokeWidth="2" />
        <path d="M65 10L55 30" stroke="#FF6B00" strokeWidth="2" />
        <circle cx="32" cy="44" r="2.5" fill="#FF6B00" opacity="0.9" />
        <circle cx="32" cy="54" r="2.5" fill="#FF6B00" opacity="0.9" />
        <circle cx="32" cy="64" r="2.5" fill="#FF6B00" opacity="0.9" />
    </svg>
);
const TrouserSVG = () => (
    <svg width="60" height="70" viewBox="0 0 70 80" fill="none">
        <path d="M5 10H65L58 80H40L35 50L30 80H12L5 10Z" fill="#1a3050" />
        <rect x="5" y="10" width="60" height="7" rx="3" fill="#243d66" />
        <line x1="35" y1="17" x2="35" y2="50" stroke="white" strokeWidth="1.5" opacity="0.35" />
    </svg>
);
const BagSVG = () => (
    <svg width="58" height="65" viewBox="0 0 65 75" fill="none">
        <rect x="5" y="20" width="55" height="50" rx="8" fill="#2563eb" />
        <rect x="5" y="20" width="55" height="11" rx="4" fill="#1d4ed8" />
        <path d="M22 20V14C22 9 28 5 32 5C36 5 43 9 43 14V20" stroke="#93c5fd" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="26" y="42" width="13" height="9" rx="3" fill="#93c5fd" opacity="0.5" />
    </svg>
);
const ShoesSVG = () => (
    <svg width="55" height="28" viewBox="0 0 60 36" fill="none">
        <path d="M5 20C5 20 12 10 25 12L48 14C55 15 56 20 55 24L5 26L5 20Z" fill="#111" />
        <path d="M5 24L55 24L55 28C55 30 53 32 51 32L7 32C5.3 32 4 30.7 4 29L5 24Z" fill="#222" />
        <path d="M5 20L14 10L20 12" stroke="#444" strokeWidth="1.5" />
    </svg>
);
const RackSVG = () => (
    <svg width="130" height="100" viewBox="0 0 140 110" fill="none">
        <line x1="8" y1="28" x2="132" y2="28" stroke="#FF6B00" strokeWidth="4" strokeLinecap="round" />
        <line x1="70" y1="28" x2="70" y2="8" stroke="#FF6B00" strokeWidth="4" />
        <line x1="70" y1="8" x2="80" y2="2" stroke="#FF6B00" strokeWidth="3" />
        <line x1="8" y1="28" x2="8" y2="105" stroke="#6b7280" strokeWidth="3" />
        <line x1="132" y1="28" x2="132" y2="105" stroke="#6b7280" strokeWidth="3" />
        <line x1="3" y1="105" x2="137" y2="105" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
        {[22, 44, 66, 88, 110].map((x, i) => (
            <g key={i}>
                <path d={`M${x} 28 Q${x + 1} 35 ${x} 37`} stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                <rect x={x - 7} y="37" width="14" height="20" rx="2" fill={['#1a3050', '#1E3A5F', '#132038', '#1a2a4a', '#243d66'][i]} />
            </g>
        ))}
    </svg>
);

/* ─── Depth-layered floating element ────────────────────────────── */
const FloatEl = ({ children, depth = 1, floatY = 16, delay = 0, className = '', style = {} }) => {
    const y = useMotionValue(0);
    return (
        <motion.div
            className={className}
            style={{ ...style }}
            animate={{ y: [-floatY / 2, floatY / 2, -floatY / 2] }}
            transition={{ duration: 3 + depth, repeat: Infinity, ease: 'easeInOut', delay }}
        >
            {children}
        </motion.div>
    );
};

/* ─── Glass stat card with hover glow ──────────────────────────── */
const StatCard = ({ emoji, label, value, floatDelay, floatY = 14 }) => (
    <FloatEl floatY={floatY} delay={floatDelay}>
        <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-default select-none"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}
            whileHover={{ scale: 1.08, boxShadow: '0 0 28px rgba(255,107,0,0.5)', borderColor: 'rgba(255,107,0,0.5)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            <span className="text-2xl">{emoji}</span>
            <div>
                <p className="text-white font-bold text-sm leading-tight">{value}</p>
                <p style={{ color: '#9ca3af' }} className="text-xs">{label}</p>
            </div>
        </motion.div>
    </FloatEl>
);

/* ─── Particle rain ─────────────────────────────────────────────── */
const Particles = () => (
    <>
        {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="particle" style={{
                width: 3, height: 3,
                left: `${(i * 5.2) % 100}%`,
                bottom: 0,
                animationDuration: `${6 + (i * 0.7) % 8}s`,
                animationDelay: `${(i * 0.4) % 6}s`,
            }} />
        ))}
    </>
);

/* ══════════════════════════════════════════════════════════════════
   LOGIN FORM
══════════════════════════════════════════════════════════════════ */
const LoginForm = ({ onSwitch }) => {
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const res = await api.post('/auth/login', { mobile, password });
            login(res.data.user, res.data.token);
            const role = res.data.user.role;
            navigate(role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/shop');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed.');
        } finally { setLoading(false); }
    };

    const inputBase = {
        paddingLeft: 44, paddingRight: 16, paddingTop: 14, paddingBottom: 14,
        borderRadius: 12, border: '2px solid #f3f4f6', outline: 'none',
        fontSize: 14, width: '100%', background: '#f9fafb', transition: 'all 0.2s',
        fontFamily: 'inherit',
    };

    const stagger = { animate: { transition: { staggerChildren: 0.1 } } };
    const item = {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { type: 'spring', stiffness: 260, damping: 22 },
    };

    return (
        <motion.div
            key="login"
            initial={{ opacity: 0, x: 60, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm"
        >
            <motion.div variants={stagger} initial="initial" animate="animate">
                <motion.div variants={item} className="mb-8">
                    <h2 className="text-3xl font-extrabold" style={{ color: '#1E1E2F' }}>Welcome back 👋</h2>
                    <p className="text-gray-500 text-sm mt-1.5">Sign in to manage your stores</p>
                </motion.div>

                <AnimatePresence>
                    {error && (
                        <motion.div key="err" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-5 text-sm">
                            ⚠ {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleLogin}>
                    <motion.div variants={item} className="mb-4">
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Mobile Number</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </span>
                            <input type="text" value={mobile} onChange={e => setMobile(e.target.value)}
                                style={inputBase} placeholder="Mobile number"
                                onFocus={e => { e.target.style.borderColor = '#FF6B00'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,0,0.12)'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#f3f4f6'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f9fafb'; }}
                                required />
                        </div>
                    </motion.div>

                    <motion.div variants={item} className="mb-6">
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Password</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </span>
                            <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                style={{ ...inputBase, paddingRight: 44 }} placeholder="Password"
                                onFocus={e => { e.target.style.borderColor = '#FF6B00'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,0,0.12)'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#f3f4f6'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f9fafb'; }}
                                required />
                            <button type="button" onClick={() => setShowPass(v => !v)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    {showPass
                                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                                    }
                                </svg>
                            </button>
                        </div>
                    </motion.div>

                    <motion.div variants={item}>
                        <motion.button type="submit" disabled={loading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(90deg, #FF6B00, #ff9040)', boxShadow: '0 4px 18px rgba(255,107,0,0.38)' }}
                            whileHover={{ scale: 1.025, boxShadow: '0 6px 28px rgba(255,107,0,0.55)' }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 20 }}>
                            {loading
                                ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z" /></svg>Signing in...</>
                                : 'Sign In to SIZE24 →'}
                        </motion.button>
                    </motion.div>
                </form>

                <motion.div variants={item} className="flex items-center my-5">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="mx-3 text-xs text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-100" />
                </motion.div>

                <motion.p variants={item} className="text-center text-sm text-gray-500">
                    Don't have an account?{' '}
                    <motion.button onClick={onSwitch} className="font-bold hover:underline" style={{ color: '#FF6B00', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        Create Account
                    </motion.button>
                </motion.p>

                <motion.p variants={item} className="text-center text-xs text-gray-300 mt-6">
                    © 2025 SIZE24 · ERP v2.0
                </motion.p>
            </motion.div>
        </motion.div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   SIGNUP FORM
══════════════════════════════════════════════════════════════════ */
const SignupForm = ({ onSwitch }) => {
    const [form, setForm] = useState({ name: '', mobile: '', password: '', role: 'shop_user' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await api.post('/auth/register', form);
            setSuccess('Account created! Awaiting admin approval.');
            setTimeout(() => onSwitch(), 2800);
        } catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
        finally { setLoading(false); }
    };

    const stagger = { animate: { transition: { staggerChildren: 0.09 } } };
    const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring', stiffness: 240, damping: 22 } };
    const inputBase = { padding: '13px 14px', borderRadius: 12, border: '2px solid #f3f4f6', outline: 'none', fontSize: 14, width: '100%', background: '#f9fafb', fontFamily: 'inherit', transition: 'all 0.2s' };

    return (
        <motion.div key="signup" initial={{ opacity: 0, x: 80, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -80, scale: 0.96 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-sm">
            <motion.div variants={stagger} initial="initial" animate="animate">
                <motion.div variants={item} className="mb-7">
                    <h2 className="text-3xl font-extrabold" style={{ color: '#1E1E2F' }}>Create Account 🎓</h2>
                    <p className="text-gray-500 text-sm mt-1">Join SIZE24 ERP — School Uniform Retail</p>
                </motion.div>

                <AnimatePresence>
                    {error && <motion.div key="err" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl mb-4 text-sm">⚠ {error}</motion.div>}
                    {success && <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-xl mb-4 text-sm font-medium">✅ {success}</motion.div>}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {[
                        { label: 'Full Name', field: 'name', type: 'text', ph: 'Your full name' },
                        { label: 'Mobile', field: 'mobile', type: 'text', ph: 'Mobile number', req: true },
                        { label: 'Password', field: 'password', type: 'password', ph: 'Choose a password', req: true },
                    ].map(({ label, field, type, ph, req }) => (
                        <motion.div key={field} variants={item}>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
                            <input type={type} style={inputBase} placeholder={ph} required={req}
                                value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                                onFocus={e => { e.target.style.borderColor = '#FF6B00'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,0,0.12)'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#f3f4f6'; e.target.style.boxShadow = 'none'; e.target.style.background = '#f9fafb'; }} />
                        </motion.div>
                    ))}
                    <motion.div variants={item}>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">Role</label>
                        <select style={{ ...inputBase, background: '#f9fafb' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="shop_user">Shop User</option>
                        </select>
                    </motion.div>
                    <motion.div variants={item}>
                        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg">⚠ Non-admin accounts need Admin approval before login.</p>
                    </motion.div>
                    <motion.div variants={item}>
                        <motion.button type="submit" disabled={loading}
                            className="w-full py-3.5 rounded-xl text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(90deg, #FF6B00, #ff9040)', boxShadow: '0 4px 18px rgba(255,107,0,0.38)' }}
                            whileHover={{ scale: 1.025, boxShadow: '0 6px 26px rgba(255,107,0,0.5)' }}
                            whileTap={{ scale: 0.97 }}>
                            {loading ? 'Creating...' : 'Create Account'}
                        </motion.button>
                    </motion.div>
                </form>

                <p className="text-center text-sm text-gray-500 mt-5">
                    Already have an account?{' '}
                    <motion.button onClick={onSwitch} className="font-bold hover:underline" style={{ color: '#FF6B00', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        Sign In
                    </motion.button>
                </p>
            </motion.div>
        </motion.div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN AUTH PAGE
══════════════════════════════════════════════════════════════════ */
const LoginPage = () => {
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const containerRef = useRef(null);

    // Mouse parallax spring values
    const rawX = useMotionValue(0);
    const rawY = useMotionValue(0);
    const springX = useSpring(rawX, { stiffness: 60, damping: 18 });
    const springY = useSpring(rawY, { stiffness: 60, damping: 18 });

    // Different elements at different depths
    const closeFg = { x: useTransform(springX, v => v * 22), y: useTransform(springY, v => v * 22) };
    const closeMid = { x: useTransform(springX, v => v * 13), y: useTransform(springY, v => v * 13) };
    const closeBg = { x: useTransform(springX, v => v * 6), y: useTransform(springY, v => v * 6) };

    const handleMouseMove = useCallback((e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        rawX.set((e.clientX - rect.left - rect.width / 2) / rect.width);
        rawY.set((e.clientY - rect.top - rect.height / 2) / rect.height);
    }, [rawX, rawY]);

    const handleMouseLeave = useCallback(() => {
        rawX.set(0); rawY.set(0);
    }, [rawX, rawY]);

    return (
        <motion.div className="min-h-screen flex overflow-hidden" style={{ background: '#0d0d1a' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>

            {/* ──── LEFT: ANIMATED SCENE ──────────────────────────────── */}
            <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
                className="hidden lg:flex flex-col relative flex-1 overflow-hidden select-none"
                style={{ background: 'linear-gradient(135deg,#1E1E2F 0%,#0d1a2e 60%,#1a0d00 100%)' }}>

                {/* Canvas Particle System — multi-layer glowing particles with mouse repulsion */}
                <ParticleCanvas />

                {/* Background glows — slowest depth */}
                <motion.div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
                    style={{ background: '#FF6B00', x: closeBg.x, y: closeBg.y }} />
                <motion.div className="absolute bottom-[-70px] right-[-70px] w-72 h-72 rounded-full opacity-15 blur-3xl pointer-events-none"
                    style={{ background: '#FF6B00', x: useTransform(springX, v => v * -6), y: useTransform(springY, v => v * -6) }} />

                {/* Logo header */}
                <motion.div className="relative z-10 px-8 pt-8 flex items-center gap-3"
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <img src="/logo.png" alt="SIZE24" className="h-10 w-auto object-contain" />
                    <div>
                        <h1 className="text-xl font-black tracking-widest" style={{ color: '#FF6B00' }}>SIZE24</h1>
                        <p className="text-xs font-medium" style={{ color: '#6b7280' }}>Smart Retail ERP</p>
                    </div>
                </motion.div>

                {/* SCENE — mid-depth */}
                <div className="flex-1 flex items-center justify-center relative">
                    <motion.div className="relative w-[420px] h-[380px]" style={closeMid}>

                        {/* Rack — bg depth */}
                        <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                            animate={{ y: [0, -10, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ x: closeBg.x, y: closeBg.y }}>
                            <RackSVG />
                        </motion.div>

                        {/* Shirt — foreground left */}
                        <motion.div className="absolute left-[24px] top-[55px]"
                            animate={{ y: [0, -18, 0], rotate: [-3, 3, -3] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                            style={{ x: closeFg.x, y: closeFg.y }}
                            whileHover={{ scale: 1.15, filter: 'drop-shadow(0 0 16px rgba(255,107,0,0.7))' }}>
                            <ShirtSVG />
                            <p className="text-center text-xs font-bold mt-1" style={{ color: '#FF6B00' }}>Shirt</p>
                        </motion.div>

                        {/* Blazer — fg right top */}
                        <motion.div className="absolute right-[16px] top-[25px]"
                            animate={{ y: [0, -22, 0], rotate: [4, -4, 4] }}
                            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                            style={{ x: closeFg.x, y: closeFg.y }}
                            whileHover={{ scale: 1.15, filter: 'drop-shadow(0 0 16px rgba(255,107,0,0.7))' }}>
                            <BlazerSVG />
                            <p className="text-center text-xs font-bold mt-1" style={{ color: '#FF6B00' }}>Blazer</p>
                        </motion.div>

                        {/* Trousers — mid left bottom */}
                        <motion.div className="absolute left-[18px] bottom-[38px]"
                            animate={{ y: [0, -14, 0] }}
                            transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                            style={{ x: closeMid.x, y: closeMid.y }}
                            whileHover={{ scale: 1.12, filter: 'drop-shadow(0 0 12px rgba(100,149,237,0.7))' }}>
                            <TrouserSVG />
                            <p className="text-center text-xs font-bold mt-1" style={{ color: '#93c5fd' }}>Trousers</p>
                        </motion.div>

                        {/* Bag — mid right bottom */}
                        <motion.div className="absolute right-[24px] bottom-[48px]"
                            animate={{ y: [0, -20, 0] }}
                            transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                            style={{ x: closeMid.x, y: closeMid.y }}
                            whileHover={{ scale: 1.12, filter: 'drop-shadow(0 0 12px rgba(37,99,235,0.7))' }}>
                            <BagSVG />
                            <p className="text-center text-xs font-bold mt-1" style={{ color: '#93c5fd' }}>School Bag</p>
                        </motion.div>

                        {/* Shoes — bottom center */}
                        <motion.div className="absolute left-1/2 -translate-x-1/2 bottom-[8px]"
                            animate={{ y: [0, -10, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1.7 }}
                            style={{ x: closeBg.x, y: closeBg.y }}>
                            <ShoesSVG />
                        </motion.div>

                        {/* Orbiting dot */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF6B00', boxShadow: '0 0 14px #FF6B00', animation: 'orbit 7s linear infinite' }} />
                        </div>
                    </motion.div>

                    {/* STAT CARDS — fg depth, different positions */}
                    <motion.div className="absolute top-[8%] left-[4%]" style={{ x: closeFg.x, y: closeFg.y }}>
                        <StatCard emoji="📊" label="Today's Sales" value="₹1,24,800" floatDelay={0} />
                    </motion.div>
                    <motion.div className="absolute top-[10%] right-[4%]" style={{ x: useTransform(springX, v => v * -16), y: closeFg.y }}>
                        <StatCard emoji="🏪" label="Active Stores" value="24 Shops" floatDelay={1.4} floatY={18} />
                    </motion.div>
                    <motion.div className="absolute bottom-[10%] left-[4%]" style={{ x: closeFg.x, y: useTransform(springY, v => v * -16) }}>
                        <StatCard emoji="📦" label="Inventory" value="3,840 Units" floatDelay={0.7} />
                    </motion.div>
                    <motion.div className="absolute bottom-[10%] right-[4%]" style={{ x: useTransform(springX, v => v * -14), y: useTransform(springY, v => v * -14) }}>
                        <StatCard emoji="🎓" label="Partner Schools" value="120 Schools" floatDelay={2} floatY={12} />
                    </motion.div>
                </div>

                {/* Bottom CTA */}
                <motion.div className="relative z-10 pb-10 px-8 text-center"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <h2 className="text-2xl font-extrabold text-white mb-2">
                        School Uniform <span style={{ color: '#FF6B00' }}>Retail ERP</span>
                    </h2>
                    <p className="text-gray-400 text-sm mb-5 max-w-xs mx-auto">Manage uniforms, track inventory, and grow your school uniform business.</p>
                    <motion.a href="https://www.size24.in/" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(90deg,#FF6B00,#ff8c42)', boxShadow: '0 4px 20px rgba(255,107,0,0.45)' }}
                        whileHover={{ scale: 1.06, boxShadow: '0 6px 28px rgba(255,107,0,0.65)' }}
                        whileTap={{ scale: 0.97 }}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Visit Official Website
                    </motion.a>
                </motion.div>
            </div>

            {/* ──── RIGHT: AUTH FORM (Login ↔ Signup with slide) ─────── */}
            <div className="flex items-center justify-center w-full lg:w-[460px] flex-shrink-0 px-8 py-12 relative overflow-hidden"
                style={{ background: '#ffffff' }}>
                {/* Glow top-right */}
                <div className="absolute top-0 right-0 w-44 h-44 rounded-full opacity-10 blur-2xl pointer-events-none" style={{ background: '#FF6B00' }} />

                {/* Mobile logo */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
                    <img src="/logo.png" alt="SIZE24" className="h-12 w-auto object-contain" />
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'login'
                        ? <LoginForm key="login" onSwitch={() => setMode('signup')} />
                        : <SignupForm key="signup" onSwitch={() => setMode('login')} />
                    }
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default LoginPage;
