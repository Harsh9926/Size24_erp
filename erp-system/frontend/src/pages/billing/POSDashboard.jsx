import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    TrendingUp, ShoppingBag, CreditCard, Users,
    RefreshCw, Package, BarChart3, Clock, Zap,
    ArrowUpRight, LayoutDashboard,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const fmt  = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const ORANGE = '#FF6B00';
const STATUS_COLORS = {
    paid: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-gray-100 text-gray-400',
};
const PAY_COLORS = {
    cash: '#10b981', upi: '#8b5cf6', card: '#3b82f6',
    bank: '#6366f1', wallet: '#f59e0b', split: '#FF6B00',
};

function StatCard({ icon: Icon, label, value, sub, color = ORANGE }) {
    return (
        <div className="rounded-2xl border p-4 flex items-start gap-3"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: `${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <p className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
            </div>
        </div>
    );
}

export default function POSDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [data, setData]               = useState(null);
    const [loading, setLoading]         = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/pos/dashboard');
            setData(r.data);
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const stats = data?.stats || {};
    const hourly = (data?.hourly_sales || []).map(h => ({
        hour: `${h.hour}:00`,
        sales: parseFloat(h.sales || 0),
        orders: parseInt(h.orders || 0),
    }));

    const payBreakdown = data?.payment_breakdown || [];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Header */}
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1">
                        <LayoutDashboard className="h-5 w-5" style={{ color: ORANGE }} />
                        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sales Dashboard</h1>
                    </div>
                    <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <Link to="/billing/pos"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                        style={{ background: ORANGE }}>
                        <Zap className="h-4 w-4" /> Open POS
                    </Link>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                    {/* Today's Stats */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard icon={TrendingUp} label="Today's Sales"
                                value={loading ? '…' : fmt(stats.today_sales)}
                                sub={`${stats.today_orders || 0} orders`}
                                color={ORANGE} />
                            <StatCard icon={CreditCard} label="Collected"
                                value={loading ? '…' : fmt(stats.today_collected)}
                                sub="Payments received"
                                color="#10b981" />
                            <StatCard icon={ShoppingBag} label="Outstanding"
                                value={loading ? '…' : fmt(stats.today_outstanding)}
                                sub="Credit balance"
                                color="#ef4444" />
                            <StatCard icon={BarChart3} label="This Month"
                                value={loading ? '…' : fmt(stats.month_sales)}
                                sub={`${stats.month_orders || 0} orders`}
                                color="#8b5cf6" />
                        </div>
                    </div>

                    {/* Hourly Sales + Payment Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Hourly chart */}
                        <div className="lg:col-span-2 rounded-2xl border p-5"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Clock className="h-4 w-4" style={{ color: ORANGE }} /> Hourly Sales
                                </p>
                            </div>
                            {loading ? (
                                <div className="h-48 flex items-center justify-center">
                                    <RefreshCw className="h-8 w-8 animate-spin" style={{ color: 'var(--text-secondary)' }} />
                                </div>
                            ) : hourly.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    No sales today yet
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={hourly} barSize={18}>
                                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                                        <Tooltip
                                            formatter={(v) => [fmt(v), 'Sales']}
                                            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Bar dataKey="sales" radius={[4,4,0,0]}>
                                            {hourly.map((_, i) => (
                                                <Cell key={i} fill={ORANGE} fillOpacity={0.75 + 0.25 * (i / (hourly.length || 1))} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Payment breakdown */}
                        <div className="rounded-2xl border p-5"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <p className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <CreditCard className="h-4 w-4" style={{ color: ORANGE }} /> Payment Modes
                            </p>
                            {loading ? (
                                <div className="space-y-3">
                                    {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--bg-primary)' }} />)}
                                </div>
                            ) : payBreakdown.length === 0 ? (
                                <p className="text-sm text-center mt-8" style={{ color: 'var(--text-secondary)' }}>No payments today</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {payBreakdown.map(pm => {
                                        const color = PAY_COLORS[pm.payment_mode] || ORANGE;
                                        const total = payBreakdown.reduce((s, p) => s + parseFloat(p.total), 0);
                                        const pct = total > 0 ? (parseFloat(pm.total) / total * 100).toFixed(0) : 0;
                                        return (
                                            <div key={pm.payment_mode}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                                                        {pm.payment_mode}
                                                    </span>
                                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                                        {fmt(pm.total)} <span className="font-normal text-xs" style={{ color: 'var(--text-secondary)' }}>({pct}%)</span>
                                                    </span>
                                                </div>
                                                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--bg-primary)' }}>
                                                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Products + Top Customers + Recent Invoices */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Top Products */}
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <p className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Package className="h-4 w-4" style={{ color: ORANGE }} /> Top Products
                            </p>
                            {loading ? (
                                <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--bg-primary)' }} />)}</div>
                            ) : !data?.top_products?.length ? (
                                <p className="text-sm text-center mt-4" style={{ color: 'var(--text-secondary)' }}>No data</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.top_products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-xs font-bold w-5 text-center rounded-full h-5 flex items-center justify-center flex-shrink-0"
                                                style={{ background: i === 0 ? ORANGE : 'var(--bg-primary)', color: i === 0 ? '#fff' : 'var(--text-secondary)' }}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.product_name}</p>
                                                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Qty: {parseFloat(p.total_qty).toFixed(0)}</p>
                                            </div>
                                            <p className="text-xs font-bold flex-shrink-0" style={{ color: ORANGE }}>{fmt(p.total_amount)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Top Customers */}
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <p className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Users className="h-4 w-4" style={{ color: ORANGE }} /> Top Customers
                            </p>
                            {loading ? (
                                <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--bg-primary)' }} />)}</div>
                            ) : !data?.top_customers?.length ? (
                                <p className="text-sm text-center mt-4" style={{ color: 'var(--text-secondary)' }}>No data</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.top_customers.map((c, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                                                style={{ background: ORANGE }}>
                                                {c.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{c.mobile} · {c.orders} orders</p>
                                            </div>
                                            <p className="text-xs font-bold flex-shrink-0" style={{ color: ORANGE }}>{fmt(c.total_spent)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Invoices */}
                        <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <TrendingUp className="h-4 w-4" style={{ color: ORANGE }} /> Recent Bills
                                </p>
                                <Link to="/inventory/sales" className="text-xs font-semibold flex items-center gap-1" style={{ color: ORANGE }}>
                                    All <ArrowUpRight className="h-3 w-3" />
                                </Link>
                            </div>
                            {loading ? (
                                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-primary)' }} />)}</div>
                            ) : !data?.recent_invoices?.length ? (
                                <p className="text-sm text-center mt-4" style={{ color: 'var(--text-secondary)' }}>No invoices today</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.recent_invoices.map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                                            style={{ background: 'var(--bg-primary)' }}>
                                            <div>
                                                <p className="text-xs font-mono font-bold" style={{ color: ORANGE }}>{inv.invoice_number}</p>
                                                <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                                                    {inv.customer_name || 'Walk-in'}
                                                    {inv.payment_mode && ` · ${inv.payment_mode.toUpperCase()}`}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(inv.total_amount)}</p>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || ''}`}>
                                                    {inv.status?.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
