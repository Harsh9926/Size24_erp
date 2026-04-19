import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { TrendingUp, IndianRupee, CreditCard, Clock, Lock, ShieldCheck, ShieldX, AlertCircle, ArrowRightLeft, RefreshCw } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
    const [data, setData] = useState({ summary: {}, chartData: [], latestEntries: [], pendingUsersCount: 0, pendingEntriesCount: 0 });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('monthly');
    const [shops, setShops] = useState([]);
    const [cities, setCities] = useState([]);
    const [filters, setFilters] = useState({ city_id: '', shop_id: '' });
    const [transfers,     setTransfers]     = useState([]);
    const [txLoading,     setTxLoading]     = useState(false);
    const [txStatusFilter, setTxStatusFilter] = useState('');

    const fetchTransfers = async (status = '') => {
        setTxLoading(true);
        try {
            const params = status ? `?status=${status}` : '';
            const res = await api.get(`/transfers/admin${params}`);
            setTransfers(res.data);
        } catch (err) { console.error('[AdminDashboard] fetchTransfers error:', err); }
        finally { setTxLoading(false); }
    };

    useEffect(() => {
        api.get('/locations/states').then(() => { }).catch(() => { });
        api.get('/shops').then(r => setShops(r.data)).catch(() => { });
        fetchData();
        fetchTransfers();
    }, []);

    useEffect(() => { fetchData(); }, [period, filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period, ...filters }).toString();
            const res = await api.get(`/dashboard/admin?${params}`);
            setData(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUnlock = async (id) => {
        try { await api.post(`/entries/${id}/unlock`); fetchData(); alert('Unlocked for 10 min'); }
        catch (e) { alert(e.response?.data?.error || 'Error'); }
    };

    const cards = [
        { label: 'Total Sales (Approved)', value: data.summary?.total_sales,  icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: true },
        { label: 'Total Cash',             value: data.summary?.total_cash,   icon: IndianRupee,  color: 'text-blue-600',    bg: 'bg-blue-50',    isCurrency: true },
        { label: 'Total Online',           value: data.summary?.total_online, icon: CreditCard,   color: 'text-purple-600',  bg: 'bg-purple-50',  isCurrency: true },
        { label: 'Pending Approvals',      value: data.pendingEntriesCount,   icon: AlertCircle,  color: 'text-amber-600',   bg: 'bg-amber-50',   isCurrency: false },
    ];

    return (
        <Layout title="SIZE24 Dashboard">
            {/* Pending Banner */}
            {data.pendingUsersCount > 0 && (
                <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        <span className="font-bold">{data.pendingUsersCount}</span> user{data.pendingUsersCount !== 1 ? 's' : ''} pending approval.{' '}
                        <a href="/admin/users" className="underline font-semibold">Review →</a>
                    </p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {cards.map(({ label, value, icon: Icon, color, bg, isCurrency }) => (
                    <div key={label} className="rounded-xl p-5 shadow-sm border transition-shadow hover:shadow-md" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {isCurrency ? `₹${Number(value || 0).toLocaleString('en-IN')}` : Number(value || 0)}
                                </p>
                            </div>
                            <div className={`p-3 rounded-xl ${bg}`}><Icon className={`h-6 w-6 ${color}`} /></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart Filters */}
            <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sales Analytics</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['daily', 'weekly', 'monthly'].map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize`}
                                style={{ backgroundColor: period === p ? '#FF6B00' : '#f3f4f6', color: period === p ? 'white' : '#4b5563' }}>
                                {p}
                            </button>
                        ))}
                        <select className="px-3 py-1.5 text-xs border rounded-lg bg-white text-gray-600 outline-none" value={filters.shop_id} onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}>
                            <option value="">All Shops</option>
                            {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                        </select>
                    </div>
                </div>
                {loading ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">Loading chart...</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="sales" name="Sales" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="cash" name="Cash" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="online" name="Online" fill="#1E1E2F" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Recent Entries Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Daily Entries</h3>
                    <button onClick={fetchData} className="text-xs text-indigo-600 hover:underline font-medium">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--border-color)' }}>
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>{['Date', 'Shop', 'City', 'Total Sale', 'Cash', 'Online', 'Approval', 'Action'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {data.latestEntries?.map(entry => {
                                const status = (entry.approval_status || 'APPROVED').toUpperCase();
                                const statusCfg = {
                                    PENDING:  { cls: 'bg-amber-100 text-amber-700', Icon: AlertCircle,  label: 'Pending'  },
                                    APPROVED: { cls: 'bg-green-100 text-green-700', Icon: ShieldCheck,  label: 'Approved' },
                                    REJECTED: { cls: 'bg-red-100   text-red-700',   Icon: ShieldX,      label: 'Rejected' },
                                }[status] || { cls: 'bg-gray-100 text-gray-600', Icon: AlertCircle, label: status };
                                return (
                                <tr key={entry.id} className="transition-colors hover:opacity-90" style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">{entry.shop_name}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.city_name}</td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{Number(entry.total_sale).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(entry.cash).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number((+entry.online || 0) + (+entry.razorpay || 0)).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${statusCfg.cls}`}>
                                            <statusCfg.Icon className="h-3 w-3" />{statusCfg.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {entry.locked && status === 'APPROVED' && (
                                            <button onClick={() => handleUnlock(entry.id)}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                <Lock className="h-3 w-3" /> Unlock
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                            {(!data.latestEntries || data.latestEntries.length === 0) && (
                                <tr><td colSpan="9" className="text-center py-12 text-gray-400">No entries yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* ── All Cash Transfers ──────────────────────────── */}
            <div className="mt-8 rounded-xl shadow-sm border overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Cash Transfers</h3>
                        <span className="text-xs text-gray-400">({transfers.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={txStatusFilter}
                            onChange={e => { setTxStatusFilter(e.target.value); fetchTransfers(e.target.value); }}
                            className="text-xs border rounded-lg px-2 py-1.5 outline-none"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button onClick={() => fetchTransfers(txStatusFilter)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium">
                            <RefreshCw className={`h-3.5 w-3.5 ${txLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['From (Shop User)', 'To (Manager)', 'Amount', 'Note', 'Status', 'Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map(t => {
                                const statusCfg = {
                                    pending:  { cls: 'bg-amber-100 text-amber-700', label: '⏳ Pending'  },
                                    accepted: { cls: 'bg-green-100 text-green-700', label: '✅ Accepted' },
                                    rejected: { cls: 'bg-red-100   text-red-700',   label: '❌ Rejected' },
                                }[t.status] || { cls: 'bg-gray-100 text-gray-600', label: t.status };
                                return (
                                    <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.from_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{t.from_mobile}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-indigo-600">{t.to_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{t.to_mobile}</p>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">
                                            ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[140px] truncate"
                                            style={{ color: 'var(--text-secondary)' }} title={t.note}>
                                            {t.note || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusCfg.cls}`}>
                                                {statusCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(t.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                    </tr>
                                );
                            })}
                            {transfers.length === 0 && !txLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-400">No transfers found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AdminDashboard;
