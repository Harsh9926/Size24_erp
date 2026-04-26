import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    LayoutDashboard, Store, Users, ClipboardList,
    Banknote, LogOut, ChevronRight,
    BarChart3, Sun, Moon, FileUp, ShieldCheck, PlusCircle,
} from 'lucide-react';
import api from '../services/api';

const adminLinks = [
    { to: '/admin',           label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/admin/approvals', label: 'Approvals',   icon: ShieldCheck },
    { to: '/admin/shops',     label: 'Shops',       icon: Store },
    { to: '/admin/users',     label: 'Users',       icon: Users },
    { to: '/admin/entries',   label: 'Entries',     icon: ClipboardList },
    { to: '/admin/cashflow',  label: 'Cash Flow',   icon: Banknote },
    { to: '/admin/reports',   label: 'Reports',     icon: BarChart3 },
    { to: '/admin/new-entry', label: 'New Entry',    icon: PlusCircle },
];

const managerLinks = [
    { to: '/manager',         label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/admin/approvals', label: 'Approvals',   icon: ShieldCheck },
    { to: '/admin/entries',   label: 'Entries',     icon: ClipboardList },
    { to: '/admin/cashflow',  label: 'Cash Flow',   icon: Banknote },
    { to: '/admin/reports',   label: 'Reports',     icon: BarChart3 },
];

const shopLinks = [
    { to: '/admin/excel', label: 'Excel Upload', icon: FileUp },
];

const Sidebar = () => {
    const { logout, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [dark, setDark] = useState(() => localStorage.getItem('erp_theme') === 'dark');
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('erp_theme', dark ? 'dark' : 'light');
    }, [dark]);

    /* Poll pending count every 60 s for admin / manager */
    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'manager') return;

        const fetchPending = async () => {
            try {
                const res = await api.get('/entries/pending');
                setPendingCount(res.data.length);
            } catch { /* silently ignore */ }
        };

        fetchPending();
        const iv = setInterval(fetchPending, 60_000);
        return () => clearInterval(iv);
    }, [user?.role]);

    const handleLogout = () => { logout(); navigate('/login'); };
    const links = user?.role === 'manager' ? managerLinks
        : user?.role === 'shop_user' ? shopLinks
        : adminLinks;

    return (
        <div className="w-64 min-h-screen flex flex-col shadow-2xl flex-shrink-0" style={{ background: 'var(--bg-sidebar)' }}>
            {/* Brand Header */}
            <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
                <img src="/logo.avif" alt="SIZE24 Logo" className="h-9 w-auto object-contain flex-shrink-0" />
                <div>
                    <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#FF6B00' }}>SIZE24</h1>
                    <p className="text-xs text-gray-500 leading-none">Smart Retail ERP</p>
                </div>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {links.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end={to === '/admin' || to === '/manager'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${isActive
                                ? 'text-white shadow-lg'
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }`
                        }
                        style={({ isActive }) => isActive ? { backgroundColor: '#FF6B00' } : {}}
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
            </nav>

            {/* Dark mode + Logout */}
            <div className="px-3 py-4 border-t border-white/10 space-y-1">
                <button onClick={() => setDark(d => !d)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all">
                    {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    {dark ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-all">
                    <LogOut className="h-5 w-5" /> Logout
                </button>
            </div>

            {/* Credit */}
            <div className="px-4 py-3 border-t border-white/5 text-center">
                <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Designed &amp; Developed by
                </p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'rgba(255,107,0,0.6)' }}>
                    Harsh Chandel
                </p>
            </div>
        </div>
    );
};

export default Sidebar;
