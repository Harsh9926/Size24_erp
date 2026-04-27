import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { TrendingUp, IndianRupee, CreditCard, Clock, Lock, ShieldCheck, ShieldX, AlertCircle, ArrowRightLeft, RefreshCw, Trash2, CheckCircle2, Store, X, Calendar } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
    const [data, setData] = useState({ summary: {}, chartData: [], latestEntries: [], pendingUsersCount: 0, pendingEntriesCount: 0 });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [period, setPeriod] = useState('monthly');
    const [shops, setShops] = useState([]);
    const [cities, setCities] = useState([]);
    const [filters, setFilters] = useState({ city_id: '', shop_id: '', startDate: '', endDate: '' });
    const [transfers,      setTransfers]      = useState([]);
    const [txLoading,      setTxLoading]      = useState(false);
    const [txStatusFilter, setTxStatusFilter] = useState('');

    // Delete state
    const [deleteTarget,  setDeleteTarget]  = useState(null);   // entry to confirm
    const [deleting,      setDeleting]      = useState(false);
    const [toast,         setToast]         = useState(null);   // { msg, ok }

    // Keep a ref to the latest fetchData so the visibility listener always calls
    // the most recent version (with up-to-date period/filters in closure).
    const fetchDataRef = useRef(null);
    useEffect(() => { fetchDataRef.current = fetchData; });

    // Auto-refresh when the tab becomes visible again (e.g. after approving on
    // the approvals page and switching back).
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchDataRef.current?.();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    const setQuickFilter = (type) => {
        const today = new Date();
        const fmt = (d) => d.toISOString().split('T')[0];
        if (type === 'today') {
            setFilters(f => ({ ...f, startDate: fmt(today), endDate: fmt(today) }));
        } else if (type === 'week') {
            const start = new Date(today);
            start.setDate(today.getDate() - today.getDay());
            setFilters(f => ({ ...f, startDate: fmt(start), endDate: fmt(today) }));
        } else if (type === 'month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setFilters(f => ({ ...f, startDate: fmt(start), endDate: fmt(today) }));
        } else {
            setFilters(f => ({ ...f, startDate: '', endDate: '' }));
        }
    };

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
        setFetchError(null);
        try {
            // Only include non-empty params so the backend doesn't receive blank strings
            const raw = { period };
            if (filters.city_id)   raw.city_id   = filters.city_id;
            if (filters.shop_id)   raw.shop_id   = filters.shop_id;
            if (filters.startDate) raw.startDate = filters.startDate;
            if (filters.endDate)   raw.endDate   = filters.endDate;
            const res = await api.get(`/dashboard/admin?${new URLSearchParams(raw).toString()}`);
            setData(res.data);
        } catch (e) {
            console.error(e);
            setFetchError(e.response?.data?.error || 'Failed to load dashboard data. Check backend connection.');
        }
        finally { setLoading(false); }
    };

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const handleUnlock = async (id) => {
        try { await api.post(`/entries/${id}/unlock`); fetchData(); alert('Unlocked for 10 min'); }
        catch (e) { alert(e.response?.data?.error || 'Error'); }
    };

    const handleDeleteClick = (entry) => setDeleteTarget(entry);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/entries/${deleteTarget.id}`);
            showToast('Entry deleted successfully.');
            fetchData(); // full refresh so totals update immediately
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to delete entry.', false);
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    const cards = [
        { label: 'Total Sales (Approved)', value: data.totalSales  ?? 0, icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: true  },
        { label: 'Total Cash',             value: data.totalCash   ?? 0, icon: IndianRupee, color: 'text-blue-600',    bg: 'bg-blue-50',    isCurrency: true  },
        { label: 'Total Online',           value: data.totalOnline ?? 0, icon: CreditCard,  color: 'text-purple-600',  bg: 'bg-purple-50',  isCurrency: true  },
        { label: 'Approved Entries',       value: data.totalEntries ?? 0, icon: ShieldCheck, color: 'text-teal-600',   bg: 'bg-teal-50',    isCurrency: false },
        { label: 'Pending Approvals',      value: data.pendingEntriesCount ?? 0, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', isCurrency: false },
    ];

    return (
        <Layout title="SIZE24 Dashboard">
            {/* API Error Banner */}
            {fetchError && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-3 rounded-xl">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{fetchError}</p>
                </div>
            )}

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
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-5 mb-6">
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

            {/* ── Store Filter Bar ─────────────────────────────────── */}
            <div className="mb-6 flex flex-wrap items-center gap-3 px-5 py-3.5 rounded-xl border shadow-sm"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <Store className="h-4 w-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Select Store:</span>
                <select
                    value={filters.shop_id}
                    onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}
                    className="flex-1 min-w-[180px] max-w-xs px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                    <option value="">All Stores</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                </select>

                {/* Active filter pill */}
                {filters.shop_id && (() => {
                    const sel = shops.find(s => String(s.id) === String(filters.shop_id));
                    return sel ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ background: '#FF6B00' }}>
                            <Store className="h-3 w-3" />
                            {sel.shop_name}
                            <button onClick={() => setFilters(f => ({ ...f, shop_id: '' }))}
                                className="ml-0.5 hover:opacity-70">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ) : null;
                })()}

                {filters.shop_id && (
                    <button onClick={() => setFilters(f => ({ ...f, shop_id: '' }))}
                        className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto">
                        Clear filter
                    </button>
                )}

                {loading && <span className="text-xs text-gray-400 animate-pulse ml-auto">Refreshing…</span>}
            </div>

            {/* ── Date Range Filter Bar ──────────────────────────── */}
            <div className="mb-6 flex flex-wrap items-center gap-3 px-5 py-3.5 rounded-xl border shadow-sm"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <Calendar className="h-4 w-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Date Range:</span>

                {/* Quick filters */}
                {[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }].map(({ key, label }) => (
                    <button key={key} onClick={() => setQuickFilter(key)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border"
                        style={{ background: '#f3f4f6', color: '#374151', borderColor: 'var(--border-color)' }}>
                        {label}
                    </button>
                ))}

                <span className="text-xs text-gray-400">or</span>

                <input
                    type="date"
                    value={filters.startDate}
                    onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <span className="text-sm text-gray-400">to</span>
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />

                {(filters.startDate || filters.endDate) && (
                    <button onClick={() => setQuickFilter('clear')}
                        className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto">
                        Clear dates
                    </button>
                )}
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
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Recent Entries Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Daily Entries <span className="text-xs font-normal text-gray-400">(all statuses)</span></h3>
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
                                        <div className="flex items-center gap-1.5">
                                            {entry.locked && status === 'APPROVED' && (
                                                <button onClick={() => handleUnlock(entry.id)}
                                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                    <Lock className="h-3 w-3" /> Unlock
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteClick(entry)}
                                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors">
                                                <Trash2 className="h-3 w-3" /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                            {(!data.latestEntries || data.latestEntries.length === 0) && (
                                <tr>
                                    <td colSpan="9" className="text-center py-12">
                                        <p className="text-gray-400 text-sm">No entries found.</p>
                                        <p className="text-gray-400 text-xs mt-1">
                                            Summary totals count only <strong>Approved</strong> entries.{' '}
                                            <a href="/admin/approvals" className="text-indigo-500 underline">Go to Approvals →</a>
                                        </p>
                                    </td>
                                </tr>
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
            {/* ── Delete Confirmation Modal ───────────────────── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: 'var(--bg-surface)' }}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-red-100 flex-shrink-0">
                                    <Trash2 className="h-5 w-5 text-red-600" />
                                </div>
                                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                                    Delete Entry?
                                </h3>
                            </div>
                            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                                Are you sure you want to delete this entry? This action cannot be undone.
                            </p>
                            <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 space-y-0.5">
                                <p><span className="font-semibold">Shop:</span> {deleteTarget.shop_name}</p>
                                <p><span className="font-semibold">Date:</span> {new Date(deleteTarget.date).toLocaleDateString('en-IN')}</p>
                                <p><span className="font-semibold">Total Sale:</span> ₹{Number(deleteTarget.total_sale).toLocaleString('en-IN')}</p>
                                {deleteTarget.approval_status === 'APPROVED' && (
                                    <p className="font-semibold text-red-800 mt-1">
                                        ⚠ Wallet will be debited ₹{Number(deleteTarget.cash).toLocaleString('en-IN')} (cash reversal).
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition-all flex items-center justify-center gap-2"
                                style={{ background: deleting ? '#9ca3af' : '#dc2626' }}>
                                {deleting
                                    ? <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                                    : <><Trash2 className="h-4 w-4" /> Confirm Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold text-white transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.ok
                        ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                        : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                    {toast.msg}
                </div>
            )}
        </Layout>
    );
};

export default AdminDashboard;
