import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import {
    LayoutDashboard, Store, Users, ClipboardList,
    Banknote, LogOut, ChevronRight,
    BarChart3, Sun, Moon, FileUp, ShieldCheck, PlusCircle,
    KeyRound, Eye, EyeOff, X, CheckCircle2, AlertCircle,
    Wallet, Receipt, TriangleAlert, Lock,
} from 'lucide-react';
import api from '../services/api';

// module field maps each link to its RBAC module for permission filtering
const adminLinks = [
    { to: '/admin',                label: 'Dashboard',     icon: LayoutDashboard, module: 'dashboard'     },
    { to: '/admin/approvals',      label: 'Approvals',     icon: ShieldCheck,     module: 'approvals'     },
    { to: '/admin/shops',          label: 'Shops',         icon: Store,           module: 'shops'         },
    { to: '/admin/users',          label: 'Users',         icon: Users,           module: 'users'         },
    { to: '/admin/entries',        label: 'Entries',       icon: ClipboardList,   module: 'entries'       },
    { to: '/admin/expenses',       label: 'Expenses',      icon: Receipt,         module: 'expenses'      },
    { to: '/admin/manager-funds',  label: 'Manager Funds', icon: Wallet,          module: 'manager_funds' },
    { to: '/admin/anomalies',      label: 'Anomalies',     icon: TriangleAlert,   module: 'anomalies'     },
    { to: '/admin/reports',        label: 'Reports',       icon: BarChart3,       module: 'reports'       },
    { to: '/admin/new-entry',      label: 'New Entry',     icon: PlusCircle,      module: 'new_entry'     },
];

const managerLinks = [
    { to: '/manager',               label: 'Dashboard',     icon: LayoutDashboard, module: 'dashboard'  },
    { to: '/admin/approvals',       label: 'Approvals',     icon: ShieldCheck,     module: 'approvals'  },
    { to: '/admin/entries',         label: 'Entries',       icon: ClipboardList,   module: 'entries'    },
    { to: '/admin/expenses',        label: 'Expenses',      icon: Receipt,         module: 'expenses'   },
    { to: '/manager/cash-transfer', label: 'Cash Transfer', icon: Banknote,        module: 'manager_funds' },
];

const shopLinks = [
    { to: '/admin/excel', label: 'Excel Upload', icon: FileUp },
];

/* ══════════════════════════════════════════════════════════════
   CHANGE PASSWORD MODAL
══════════════════════════════════════════════════════════════ */
const ChangePasswordModal = ({ onClose }) => {
    const [form, setForm]         = useState({ current: '', next: '', confirm: '' });
    const [show, setShow]         = useState({ current: false, next: false, confirm: false });
    const [submitting, setSub]    = useState(false);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState(false);

    const toggle = (field) => setShow(s => ({ ...s, [field]: !s[field] }));
    const set    = (field) => (e) => { setForm(f => ({ ...f, [field]: e.target.value })); setError(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.current || !form.next || !form.confirm)
            return setError('All fields are required.');
        if (form.next.length < 6)
            return setError('New password must be at least 6 characters.');
        if (form.next !== form.confirm)
            return setError('New password and confirmation do not match.');

        setSub(true);
        try {
            await api.post('/auth/change-password', {
                current_password: form.current,
                new_password:     form.next,
            });
            setSuccess(true);
            setTimeout(onClose, 1800);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setSub(false);
        }
    };

    const iCls = "w-full px-3 py-2.5 pr-10 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
    const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide" ;

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>

            <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'var(--bg-surface)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            Change Password
                        </h3>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                {success ? (
                    <div className="px-6 py-10 flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                        <p className="text-base font-semibold text-emerald-700">Password updated successfully!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

                        {/* Current password */}
                        {[
                            { field: 'current', label: 'Current Password' },
                            { field: 'next',    label: 'New Password' },
                            { field: 'confirm', label: 'Confirm New Password' },
                        ].map(({ field, label }) => (
                            <div key={field}>
                                <label className={lCls} style={{ color: 'var(--text-secondary)' }}>{label}</label>
                                <div className="relative">
                                    <input
                                        type={show[field] ? 'text' : 'password'}
                                        value={form[field]}
                                        onChange={set(field)}
                                        placeholder="••••••••"
                                        className={iCls}
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                        required
                                    />
                                    <button type="button" tabIndex={-1}
                                        onClick={() => toggle(field)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {show[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting}
                                className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition-all"
                                style={{ background: submitting ? '#9ca3af' : '#FF6B00' }}>
                                {submitting ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════════ */
const Sidebar = ({ isOpen, onClose }) => {
    const { logout, user }      = useContext(AuthContext);
    const { hasAccess }         = usePermissions();
    const navigate              = useNavigate();
    const [dark, setDark]               = useState(() => localStorage.getItem('erp_theme') === 'dark');
    const [pendingCount, setPendingCount] = useState(0);
    const [showChangePw, setShowChangePw] = useState(false);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('erp_theme', dark ? 'dark' : 'light');
    }, [dark]);

    /* Poll pending count every 60 s — only when user has approvals access */
    useEffect(() => {
        const canSeeApprovals =
            user?.role === 'admin' ||
            (user?.role === 'manager' && hasAccess('approvals'));
        if (!canSeeApprovals) { setPendingCount(0); return; }

        const fetchPending = async () => {
            try {
                const res = await api.get('/entries/pending');
                setPendingCount(res.data.length);
            } catch { /* silently ignore */ }
        };

        fetchPending();
        const iv = setInterval(fetchPending, 60_000);
        return () => clearInterval(iv);
    }, [user?.role, hasAccess]);

    const handleLogout = () => { logout(); navigate('/login'); };

    // Build visible link list based on role + RBAC permissions
    let baseLinks;
    if (user?.role === 'shop_user') {
        baseLinks = shopLinks;
    } else if (user?.role === 'manager') {
        baseLinks = managerLinks.filter(l => !l.module || hasAccess(l.module));
    } else {
        // Admin: also filtered by RBAC permissions (Harsh controls what each admin sees)
        baseLinks = adminLinks.filter(l => !l.module || hasAccess(l.module));
    }

    // Access Control link — visible for admin role + has access_control permission
    const showAccessControl = user?.role === 'admin' && hasAccess('access_control');
    const links = baseLinks;

    return (
        <>
            <div
                className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                style={{ background: 'var(--bg-sidebar)' }}
            >
                {/* Brand Header */}
                <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
                    <img src="/logo.avif" alt="SIZE24 Logo" className="h-9 w-auto object-contain flex-shrink-0" />
                    <div className="flex-1">
                        <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#FF6B00' }}>SIZE24</h1>
                        <p className="text-xs text-gray-300 leading-none">Smart Retail ERP</p>
                    </div>
                    {/* Close button — mobile only */}
                    <button
                        className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 flex-shrink-0"
                        onClick={onClose}
                        aria-label="Close navigation"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    {links.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end={to === '/admin' || to === '/manager'}
                            onClick={() => { if (onClose) onClose(); }}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${isActive
                                    ? 'text-white shadow-lg'
                                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                }`
                            }
                            style={({ isActive }) => isActive ? { backgroundColor: '#c2410c' } : {}}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="flex-1">{label}</span>

                            {/* Pending badge on Approvals link */}
                            {label === 'Approvals' && pendingCount > 0 && (
                                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold">
                                    {pendingCount > 99 ? '99+' : pendingCount}
                                </span>
                            )}

                            <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </NavLink>
                    ))}

                    {/* Access Control — admin only, separated by a subtle divider */}
                    {showAccessControl && (
                        <>
                            <div className="my-2 border-t border-white/10" />
                            <NavLink
                                to="/admin/access-control"
                                onClick={() => { if (onClose) onClose(); }}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${isActive
                                        ? 'text-white shadow-lg'
                                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                                    }`
                                }
                                style={({ isActive }) => isActive ? { backgroundColor: '#c2410c' } : {}}
                            >
                                <Lock className="h-5 w-5 flex-shrink-0" />
                                <span className="flex-1">Access Control</span>
                                <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* Dark mode + Change Password + Logout */}
                <div className="px-3 py-4 border-t border-white/10 space-y-1">
                    <button onClick={() => setDark(d => !d)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        {dark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button onClick={() => setShowChangePw(true)}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                        <KeyRound className="h-5 w-5" />
                        Change Password
                    </button>
                    <button onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-all">
                        <LogOut className="h-5 w-5" /> Logout
                    </button>
                </div>

                {/* Credit */}
                <div className="px-4 py-3 border-t border-white/5 text-center">
                    <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        Designed &amp; Developed by
                    </p>
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#FF6B00' }}>
                        Harsh Chandel
                    </p>
                </div>
            </div>

            {/* Change Password Modal — rendered outside sidebar div so it overlays full screen */}
            {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        </>
    );
};

export default Sidebar;
