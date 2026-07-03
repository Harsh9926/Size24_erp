import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Package, Users, RefreshCw, Zap, BarChart2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

function StatCard({ icon: Icon, label, value, sub, color = ORANGE }) {
    return (
        <div className="rounded-2xl border p-4" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-2">
                <div className="rounded-xl p-2" style={{ background:`${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{label}</p>
            </div>
            <p className="text-2xl font-extrabold" style={{ color:'var(--text-primary)' }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color:'var(--text-secondary)' }}>{sub}</p>}
        </div>
    );
}

export default function AIDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/sys/ai-insights');
            setInsights(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                    <Brain className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>AI Insights Dashboard</h1>
                    <button onClick={load} className="p-2 rounded-lg" style={{ background:'var(--bg-primary)' }}>
                        <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} style={{ color:'var(--text-secondary)' }} />
                    </button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background:'var(--bg-surface)' }} />)}
                        </div>
                    ) : insights ? (
                        <>
                            {/* Revenue Forecast */}
                            {insights.revenue_forecast && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <StatCard icon={TrendingUp} label="Daily Avg Revenue" value={fmt(insights.revenue_forecast.daily_avg)} color="#10b981" />
                                    <StatCard icon={BarChart2} label="Forecast This Month" value={fmt(insights.revenue_forecast.monthly_forecast)} sub="Based on last 30 days avg" color="#6366f1" />
                                    <StatCard icon={Package} label="Avg Order Value" value={fmt(insights.revenue_forecast.avg_order_value)} color="#3b82f6" />
                                    <StatCard icon={Users} label="Orders (30 Days)" value={insights.revenue_forecast.order_count_30d} color={ORANGE} />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Top Sellers */}
                                {insights.top_sellers?.length > 0 && (
                                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Top Sellers (30 days)</p>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {insights.top_sellers.map((p, i) => (
                                                <div key={p.id} className="flex items-center gap-3">
                                                    <span className="w-5 text-center text-xs font-bold" style={{ color:ORANGE }}>#{i+1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color:'var(--text-primary)' }}>{p.name}</p>
                                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{p.sku}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold" style={{ color:'#10b981' }}>{p.total_qty_sold} units</p>
                                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{fmt(p.total_revenue)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dead Stock */}
                                {insights.dead_stock?.length > 0 && (
                                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                            <Package className="h-4 w-4 text-gray-400" />
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Dead Stock Alert</p>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {insights.dead_stock.map(p => (
                                                <div key={p.id} className="flex items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color:'var(--text-primary)' }}>{p.name}</p>
                                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{p.sku} · {p.category||'—'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-gray-500">{p.stock_qty} units</p>
                                                        <p className="text-[10px] text-red-400">No sales in 90d</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Low Stock */}
                                {insights.low_stock?.length > 0 && (
                                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                            <Zap className="h-4 w-4 text-amber-500" />
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Low Stock Alert</p>
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {insights.low_stock.map(p => (
                                                <div key={p.id} className="flex items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color:'var(--text-primary)' }}>{p.name}</p>
                                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{p.sku}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-amber-500">{p.stock_qty} / {p.reorder_point}</p>
                                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>stock / reorder pt</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Customer Patterns */}
                                {insights.customer_patterns && (
                                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                            <Users className="h-4 w-4" style={{ color:'#8b5cf6' }} />
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Customer Patterns</p>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {[
                                                ['Total Customers', insights.customer_patterns.total_customers, '#6366f1'],
                                                ['Active (30d)', insights.customer_patterns.active_30d, '#10b981'],
                                                ['Repeat Customers', insights.customer_patterns.repeat_customers, '#3b82f6'],
                                                ['Avg Purchases/Customer', parseFloat(insights.customer_patterns.avg_orders_per_customer||0).toFixed(1), ORANGE],
                                            ].map(([l, v, c]) => (
                                                <div key={l} className="flex justify-between">
                                                    <span className="text-xs" style={{ color:'var(--text-secondary)' }}>{l}</span>
                                                    <span className="text-sm font-bold" style={{ color: c }}>{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-center py-12 text-sm" style={{ color:'var(--text-secondary)' }}>Failed to load AI insights</p>
                    )}
                </main>
            </div>
        </div>
    );
}
