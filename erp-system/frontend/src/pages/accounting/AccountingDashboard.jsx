import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, TrendingDown, DollarSign, Scale, FileText, BarChart3, CreditCard, Landmark, RefreshCw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0,7) + '-01';

function QuickCard({ to, icon: Icon, label, value, color = ORANGE, loading }) {
    return (
        <Link to={to} className="rounded-2xl border p-4 flex items-start gap-3 hover:border-orange-300 transition-colors"
            style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
            <div className="rounded-xl p-2.5" style={{ background:`${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{label}</p>
                <p className="text-xl font-extrabold mt-0.5 truncate" style={{ color:'var(--text-primary)' }}>
                    {loading ? '…' : value}
                </p>
            </div>
        </Link>
    );
}

export default function AccountingDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pl, setPL]   = useState(null);
    const [bs, setBS]   = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [plR, bsR] = await Promise.all([
                api.get('/accounting/profit-loss', { params:{ from: firstOfMonth, to: today } }),
                api.get('/accounting/balance-sheet', { params:{ as_of: today } }),
            ]);
            setPL(plR.data); setBS(bsR.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const modules = [
        { to:'/accounting/chart',       icon: BookOpen,    label:'Chart of Accounts',  color:'#8b5cf6' },
        { to:'/accounting/journal',     icon: FileText,    label:'Journal Entries',     color:'#6366f1' },
        { to:'/accounting/vouchers',    icon: CreditCard,  label:'Vouchers',            color:'#3b82f6' },
        { to:'/accounting/ledger',      icon: Landmark,    label:'Ledger',              color:'#0ea5e9' },
        { to:'/accounting/daybook',     icon: BookOpen,    label:'Day Book',            color:'#10b981' },
        { to:'/accounting/cashbook',    icon: DollarSign,  label:'Cash Book',           color:'#10b981' },
        { to:'/accounting/bankbook',    icon: Landmark,    label:'Bank Book',           color:'#6366f1' },
        { to:'/accounting/trial-balance',icon: Scale,      label:'Trial Balance',       color:'#f59e0b' },
        { to:'/accounting/profit-loss', icon: TrendingUp,  label:'Profit & Loss',       color:ORANGE    },
        { to:'/accounting/balance-sheet',icon: BarChart3,  label:'Balance Sheet',       color:'#8b5cf6' },
        { to:'/accounting/gst-ledger',  icon: FileText,    label:'GST Ledger',          color:'#ef4444' },
    ];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <BookOpen className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Accounting</h1>
                    <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} style={{ color:'var(--text-secondary)' }} />
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <QuickCard to="/accounting/profit-loss" icon={TrendingUp} label="Revenue (MTD)" color="#10b981"
                            value={fmt(pl?.total_revenue)} loading={loading} />
                        <QuickCard to="/accounting/profit-loss" icon={TrendingDown} label="Expenses (MTD)" color="#ef4444"
                            value={fmt(pl?.total_expenses)} loading={loading} />
                        <QuickCard to="/accounting/profit-loss" icon={DollarSign} label="Net Profit (MTD)"
                            color={parseFloat(pl?.net_profit||0)>=0?'#10b981':'#ef4444'}
                            value={fmt(pl?.net_profit)} loading={loading} />
                        <QuickCard to="/accounting/balance-sheet" icon={Scale} label="Total Assets"
                            value={fmt(bs?.total_assets)} loading={loading} />
                    </div>

                    {/* P&L quick summary */}
                    {pl && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Revenue (This Month)</p>
                                </div>
                                <div className="p-4 space-y-2">
                                    {pl.revenue.slice(0,6).map(r => (
                                        <div key={r.code} className="flex justify-between text-sm">
                                            <span style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                            <span className="font-semibold text-emerald-600">{fmt(r.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-sm font-bold pt-2 border-t" style={{ borderColor:'var(--border-color)' }}>
                                        <span style={{ color:'var(--text-primary)' }}>Total Revenue</span>
                                        <span className="text-emerald-600">{fmt(pl.total_revenue)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Expenses (This Month)</p>
                                </div>
                                <div className="p-4 space-y-2">
                                    {pl.expenses.slice(0,6).map(r => (
                                        <div key={r.code} className="flex justify-between text-sm">
                                            <span style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                            <span className="font-semibold text-red-500">{fmt(r.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between text-sm font-bold pt-2 border-t" style={{ borderColor:'var(--border-color)' }}>
                                        <span style={{ color:'var(--text-primary)' }}>Total Expenses</span>
                                        <span className="text-red-500">{fmt(pl.total_expenses)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Module Links */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {modules.map(m => (
                            <Link key={m.to} to={m.to}
                                className="rounded-2xl border p-4 flex flex-col items-start gap-2 hover:border-orange-300 transition-colors"
                                style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <div className="rounded-xl p-2.5" style={{ background:`${m.color}15` }}>
                                    <m.icon className="h-5 w-5" style={{ color: m.color }} />
                                </div>
                                <p className="text-xs font-bold" style={{ color:'var(--text-primary)' }}>{m.label}</p>
                            </Link>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}
