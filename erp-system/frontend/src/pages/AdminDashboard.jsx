import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    TrendingUp, IndianRupee, CreditCard, Clock, Lock, ShieldCheck, ShieldX,
    AlertCircle, ArrowRightLeft, RefreshCw, Trash2, CheckCircle2, Store, X,
    Calendar, Pencil, Save, Wallet, Calculator,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

/* ─── tiny helpers ─────────────────────────────────────────────── */
const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-IN'); } catch { return '—'; } };

/* ─── EDIT MODAL ───────────────────────────────────────────────── */
const EditModal = ({ entry, onClose, onSaved }) => {
    const [form, setForm] = useState({
        total_sale:      String(entry.total_sale      ?? 0),
        excel_total_sale:String(entry.excel_total_sale ?? entry.total_sale ?? 0),
        cash:            String(entry.cash             ?? 0),
        razorpay:        String(entry.razorpay         ?? 0),
        online:          String(entry.online            ?? 0),
        date:            entry.date ? String(entry.date).split('T')[0] : '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const total       = parseFloat(form.total_sale       || 0);
    const breakdown   = parseFloat(form.cash || 0) + parseFloat(form.online || 0) + parseFloat(form.razorpay || 0);
    const diff        = breakdown - total;
    const mismatch    = Math.abs(diff) > 0.01;
    const oldCash     = parseFloat(entry.cash || 0);
    const newCash     = parseFloat(form.cash || 0);
    const cashDelta   = newCash - oldCash;
    const wasApproved = (entry.approval_status || '').toUpperCase() === 'APPROVED';

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await api.put(`/entries/${entry.id}`, {
                total_sale:       parseFloat(form.total_sale),
                excel_total_sale: parseFloat(form.excel_total_sale),
                cash:             parseFloat(form.cash),
                online:           parseFloat(form.online),
                razorpay:         parseFloat(form.razorpay),
                date:             form.date || undefined,
            });
            onSaved();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save entry.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: 'var(--bg-surface)' }}>

                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            Edit Entry — {entry.shop_name}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            #{entry.id} · {fmtDate(entry.date)}
                            {wasApproved && <span className="ml-2 text-teal-600 font-semibold">APPROVED</span>}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                        <input type="date" value={form.date} onChange={set('date')}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>

                    {/* Total Sale */}
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Total Sale (Excel)</label>
                        <input type="number" min="0" step="0.01" value={form.total_sale} onChange={set('total_sale')}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { key: 'cash',     label: 'Cash' },
                            { key: 'razorpay', label: 'Razorpay' },
                            { key: 'online',   label: 'QR/Card/Bank' },
                        ].map(({ key, label }) => (
                            <div key={key}>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                                <input type="number" min="0" step="0.01" value={form[key]} onChange={set(key)}
                                    className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-orange-400"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </div>
                        ))}
                    </div>

                    {/* Live Difference Calculator */}
                    <div className={`rounded-xl border overflow-hidden ${mismatch ? 'border-red-200' : 'border-green-200'}`}>
                        <div className={`px-4 pt-3 pb-2.5 space-y-1.5 ${mismatch ? 'bg-red-50' : 'bg-green-50'}`}>
                            <div className="flex justify-between items-center text-xs">
                                <span style={{ color: 'var(--text-secondary)' }}>Breakdown (Cash + Razorpay + QR)</span>
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(breakdown)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span style={{ color: 'var(--text-secondary)' }}>Total Sale</span>
                                <span className="font-bold text-teal-600">{fmt(total)}</span>
                            </div>
                        </div>
                        <div className={`px-4 py-2.5 border-t flex items-center justify-between ${
                            mismatch ? 'border-red-200 bg-red-100' : 'border-green-200 bg-green-100'
                        }`}>
                            <div className="flex items-center gap-1.5">
                                <Calculator className="h-3.5 w-3.5 text-gray-500" title="Auto-calculated difference" />
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Difference</span>
                            </div>
                            {!mismatch ? (
                                <span className="text-xs font-bold text-green-700">✔ Perfect Match</span>
                            ) : diff > 0 ? (
                                <span className="text-xs font-bold text-red-600">+{fmt(diff)} Extra (Over Amount) ❌</span>
                            ) : (
                                <span className="text-xs font-bold text-red-600">-{fmt(Math.abs(diff))} Short (Less Amount) ❌</span>
                            )}
                        </div>
                    </div>

                    {/* Wallet delta warning */}
                    {wasApproved && Math.abs(cashDelta) > 0.001 && (
                        <div className={`rounded-lg px-4 py-2.5 text-xs border ${
                            cashDelta > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            <strong>Wallet impact:</strong>{' '}
                            {cashDelta > 0
                                ? `Shop wallet will be credited ₹${cashDelta.toLocaleString('en-IN')}`
                                : `Shop wallet will be debited ₹${Math.abs(cashDelta).toLocaleString('en-IN')}`}
                            {' '}(old cash: {fmt(oldCash)} → new: {fmt(newCash)})
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-xs font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose} disabled={saving}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all"
                        style={{ background: saving ? '#9ca3af' : '#059669' }}>
                        {saving
                            ? <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                            : <><Save className="h-4 w-4" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── CARD FILTER CONFIG ───────────────────────────────────────── */
const CARD_FILTERS = {
    all:      { label: 'All Entries',             pred: () => true },
    cash:     { label: 'Cash Entries',            pred: (e) => parseFloat(e.cash || 0) > 0 },
    online:   { label: 'Online Entries',          pred: (e) => parseFloat(e.online || 0) + parseFloat(e.razorpay || 0) > 0 },
    approved: { label: 'Approved Entries',        pred: (e) => (e.approval_status || '').toUpperCase() === 'APPROVED' },
    pending:  { label: 'Pending Entries',         pred: (e) => (e.approval_status || '').toUpperCase() === 'PENDING' },
};

/* ─── MAIN COMPONENT ───────────────────────────────────────────── */
const AdminDashboard = () => {
    const [data, setData]       = useState({ summary: {}, chartData: [], latestEntries: [], pendingUsersCount: 0, pendingEntriesCount: 0 });
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [period, setPeriod]   = useState('monthly');
    const [shops, setShops]     = useState([]);
    const [filters, setFilters] = useState({ city_id: '', shop_id: '', startDate: '', endDate: '' });
    const [transfers,      setTransfers]      = useState([]);
    const [txLoading,      setTxLoading]      = useState(false);
    const [txStatusFilter, setTxStatusFilter] = useState('');

    // Card drill-down filter
    const [cardFilter, setCardFilter] = useState(null); // null | keyof CARD_FILTERS

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting,     setDeleting]     = useState(false);

    // Edit state
    const [editTarget, setEditTarget] = useState(null);

    const [toast, setToast] = useState(null); // { msg, ok }

    // Keep ref to latest fetchData for the visibility listener
    const fetchDataRef = useRef(null);
    useEffect(() => { fetchDataRef.current = fetchData; });

    // Auto-refresh when tab regains focus (after approving on the Approvals page)
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === 'visible') fetchDataRef.current?.(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    const setQuickFilter = (type) => {
        const today = new Date();
        const iso = (d) => d.toISOString().split('T')[0];
        if (type === 'today') {
            setFilters(f => ({ ...f, startDate: iso(today), endDate: iso(today) }));
        } else if (type === 'week') {
            const start = new Date(today); start.setDate(today.getDate() - today.getDay());
            setFilters(f => ({ ...f, startDate: iso(start), endDate: iso(today) }));
        } else if (type === 'month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setFilters(f => ({ ...f, startDate: iso(start), endDate: iso(today) }));
        } else {
            setFilters(f => ({ ...f, startDate: '', endDate: '' }));
        }
    };

    const fetchTransfers = async (status = '') => {
        setTxLoading(true);
        try {
            const qs = status ? `?status=${status}` : '';
            const res = await api.get(`/transfers/admin${qs}`);
            setTransfers(res.data);
        } catch (err) { console.error('[AdminDashboard] fetchTransfers error:', err); }
        finally { setTxLoading(false); }
    };

    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
        fetchData();
        fetchTransfers();
    }, []);

    useEffect(() => { fetchData(); }, [period, filters]);

    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
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
        } finally { setLoading(false); }
    };

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const handleUnlock = async (id) => {
        try { await api.post(`/entries/${id}/unlock`); fetchData(); alert('Unlocked for 10 min'); }
        catch (e) { alert(e.response?.data?.error || 'Error'); }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/entries/${deleteTarget.id}`);
            showToast('Entry deleted successfully.');
            fetchData();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to delete entry.', false);
        } finally { setDeleting(false); setDeleteTarget(null); }
    };

    // Compute filtered entries based on active card filter
    const displayedEntries = useMemo(() => {
        const entries = data.latestEntries || [];
        if (!cardFilter) return entries;
        const cfg = CARD_FILTERS[cardFilter];
        return cfg ? entries.filter(cfg.pred) : entries;
    }, [data.latestEntries, cardFilter]);

    // ── KPI Cards ────────────────────────────────────────────────
    const cards = [
        { label: 'Total Sales',      value: data.totalSales       ?? 0, icon: TrendingUp,  color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: true,  filterKey: 'all'      },
        { label: 'Total Cash',        value: data.totalCash        ?? 0, icon: IndianRupee, color: 'text-blue-600',    bg: 'bg-blue-50',    isCurrency: true,  filterKey: 'cash'     },
        { label: 'Total Online',      value: data.totalOnline      ?? 0, icon: CreditCard,  color: 'text-purple-600',  bg: 'bg-purple-50',  isCurrency: true,  filterKey: 'online'   },
        { label: 'Approved Entries',  value: data.totalEntries     ?? 0, icon: ShieldCheck, color: 'text-teal-600',    bg: 'bg-teal-50',    isCurrency: false, filterKey: 'approved' },
        { label: 'Pending Approvals', value: data.pendingEntriesCount ?? 0, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', isCurrency: false, filterKey: 'pending'  },
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

            {/* Pending Users Banner */}
            {data.pendingUsersCount > 0 && (
                <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        <span className="font-bold">{data.pendingUsersCount}</span> user{data.pendingUsersCount !== 1 ? 's' : ''} pending approval.{' '}
                        <a href="/admin/users" className="underline font-semibold">Review →</a>
                    </p>
                </div>
            )}

            {/* ── KPI Cards (clickable) ──────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-5 mb-6">
                {cards.map(({ label, value, icon: Icon, color, bg, isCurrency, filterKey }) => {
                    const isActive = cardFilter === filterKey;
                    return (
                        <div key={label}
                            onClick={() => setCardFilter(prev => prev === filterKey ? null : filterKey)}
                            className="rounded-xl p-5 shadow-sm border transition-all cursor-pointer hover:shadow-md select-none"
                            style={{
                                background: 'var(--bg-surface)',
                                borderColor: isActive ? '#FF6B00' : 'var(--border-color)',
                                boxShadow: isActive ? '0 0 0 2px #FF6B00' : undefined,
                                transform: isActive ? 'translateY(-1px)' : undefined,
                            }}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>
                                        {label}
                                    </p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {isCurrency ? fmt(value) : Number(value || 0)}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-xl ${bg} ${isActive ? 'ring-2 ring-orange-400' : ''}`}>
                                    <Icon className={`h-6 w-6 ${color}`} />
                                </div>
                            </div>
                            {isActive && (
                                <p className="mt-2 text-[10px] font-bold text-orange-500 uppercase tracking-wide">
                                    Filtering below ↓
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Shop Wallet Card (visible when a shop is selected) ── */}
            {filters.shop_id && data.shopWallet && (
                <div className="mb-6 rounded-xl border shadow-sm p-5 flex items-center gap-5"
                    style={{ background: 'var(--bg-surface)', borderColor: '#a78bfa' }}>
                    <div className="p-3 rounded-xl bg-violet-50 flex-shrink-0">
                        <Wallet className="h-7 w-7 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Shop Wallet — {data.shopWallet.shopName}
                        </p>
                        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {fmt(data.shopWallet.balance)}
                        </p>
                        {data.shopWallet.userName && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Owner: {data.shopWallet.userName}
                            </p>
                        )}
                    </div>
                    <div className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{
                            background: data.shopWallet.balance > 0 ? '#f0fdf4' : '#fef9c3',
                            color: data.shopWallet.balance > 0 ? '#15803d' : '#854d0e',
                            border: `1px solid ${data.shopWallet.balance > 0 ? '#bbf7d0' : '#fef08a'}`,
                        }}>
                        {data.shopWallet.balance > 0 ? 'Active Balance' : 'No Balance'}
                    </div>
                </div>
            )}

            {/* ── Store Filter Bar ───────────────────────────────── */}
            <div className="mb-4 flex flex-wrap items-center gap-3 px-5 py-3.5 rounded-xl border shadow-sm"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <Store className="h-4 w-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Select Store:</span>
                <select
                    value={filters.shop_id}
                    onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}
                    className="flex-1 min-w-[180px] max-w-xs px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    <option value="">All Stores</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                </select>

                {filters.shop_id && (() => {
                    const sel = shops.find(s => String(s.id) === String(filters.shop_id));
                    return sel ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ background: '#FF6B00' }}>
                            <Store className="h-3 w-3" />
                            {sel.shop_name}
                            <button onClick={() => setFilters(f => ({ ...f, shop_id: '' }))} className="ml-0.5 hover:opacity-70">
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
                {[{ key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' }].map(({ key, label }) => (
                    <button key={key} onClick={() => setQuickFilter(key)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors"
                        style={{ background: '#f3f4f6', color: '#374151', borderColor: 'var(--border-color)' }}>
                        {label}
                    </button>
                ))}
                <span className="text-xs text-gray-400">or</span>
                <input type="date" value={filters.startDate}
                    onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                <span className="text-sm text-gray-400">to</span>
                <input type="date" value={filters.endDate}
                    onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="px-3 py-1.5 text-sm border rounded-lg outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                {(filters.startDate || filters.endDate) && (
                    <button onClick={() => setQuickFilter('clear')}
                        className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto">
                        Clear dates
                    </button>
                )}
            </div>

            {/* ── Chart ──────────────────────────────────────────── */}
            <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sales Analytics</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['daily', 'weekly', 'monthly'].map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors"
                                style={{ backgroundColor: period === p ? '#FF6B00' : '#f3f4f6', color: period === p ? 'white' : '#4b5563' }}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                {loading
                    ? <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">Loading chart…</div>
                    : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                                <Legend />
                                <Bar dataKey="sales"  name="Sales"  fill="#FF6B00" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="cash"   name="Cash"   fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="online" name="Online" fill="#1E1E2F" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
            </div>

            {/* ── Entries Table ──────────────────────────────────── */}
            <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {cardFilter ? CARD_FILTERS[cardFilter]?.label : 'Recent Daily Entries'}
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                                ({displayedEntries.length} shown)
                            </span>
                        </h3>
                        {cardFilter && (
                            <button onClick={() => setCardFilter(null)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                style={{ background: '#FF6B00' }}>
                                {CARD_FILTERS[cardFilter]?.label} <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <button onClick={fetchData} className="text-xs text-indigo-600 hover:underline font-medium">Refresh</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Date', 'Shop', 'City', 'Total Sale', 'Cash', 'Online', 'Approval', 'Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayedEntries.map(entry => {
                                const status = (entry.approval_status || 'PENDING').toUpperCase();
                                const statusCfg = {
                                    PENDING:  { cls: 'bg-amber-100 text-amber-700', Icon: AlertCircle,  label: 'Pending'  },
                                    APPROVED: { cls: 'bg-green-100 text-green-700', Icon: ShieldCheck,  label: 'Approved' },
                                    REJECTED: { cls: 'bg-red-100   text-red-700',   Icon: ShieldX,      label: 'Rejected' },
                                }[status] || { cls: 'bg-gray-100 text-gray-600', Icon: AlertCircle, label: status };

                                return (
                                    <tr key={entry.id} className="transition-colors hover:opacity-90"
                                        style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                                            {fmtDate(entry.date)}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-indigo-600">{entry.shop_name}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.city_name}</td>
                                        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {fmt(entry.total_sale)}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmt(entry.cash)}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {fmt((+entry.online || 0) + (+entry.razorpay || 0))}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${statusCfg.cls}`}>
                                                <statusCfg.Icon className="h-3 w-3" />{statusCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {/* Edit button — admin only, always available */}
                                                <button onClick={() => setEditTarget(entry)}
                                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors">
                                                    <Pencil className="h-3 w-3" /> Edit
                                                </button>
                                                {entry.locked && status === 'APPROVED' && (
                                                    <button onClick={() => handleUnlock(entry.id)}
                                                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                        <Lock className="h-3 w-3" /> Unlock
                                                    </button>
                                                )}
                                                <button onClick={() => setDeleteTarget(entry)}
                                                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors">
                                                    <Trash2 className="h-3 w-3" /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {displayedEntries.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="text-center py-12">
                                        <p className="text-gray-400 text-sm">
                                            {cardFilter
                                                ? `No entries match "${CARD_FILTERS[cardFilter]?.label}".`
                                                : 'No entries found.'}
                                        </p>
                                        {!cardFilter && (
                                            <p className="text-gray-400 text-xs mt-1">
                                                Summary totals count only <strong>Approved</strong> entries.{' '}
                                                <a href="/admin/approvals" className="text-indigo-500 underline">Go to Approvals →</a>
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Cash Transfers ─────────────────────────────────── */}
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
                        <select value={txStatusFilter}
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
                                const sCfg = {
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
                                            {fmt(t.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[140px] truncate"
                                            style={{ color: 'var(--text-secondary)' }} title={t.note}>
                                            {t.note || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sCfg.cls}`}>
                                                {sCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {fmtDate(t.created_at)}
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

            {/* ── Edit Modal ─────────────────────────────────────── */}
            {editTarget && (
                <EditModal
                    entry={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSaved={() => { setEditTarget(null); showToast('Entry updated successfully.'); fetchData(); }}
                />
            )}

            {/* ── Delete Confirmation Modal ───────────────────────── */}
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
                                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Delete Entry?</h3>
                            </div>
                            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                                This action cannot be undone.
                            </p>
                            <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 space-y-0.5">
                                <p><span className="font-semibold">Shop:</span> {deleteTarget.shop_name}</p>
                                <p><span className="font-semibold">Date:</span> {fmtDate(deleteTarget.date)}</p>
                                <p><span className="font-semibold">Total Sale:</span> {fmt(deleteTarget.total_sale)}</p>
                                {deleteTarget.approval_status === 'APPROVED' && (
                                    <p className="font-semibold text-red-800 mt-1">
                                        ⚠ Wallet will be debited {fmt(deleteTarget.cash)} (cash reversal).
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                                className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                                Cancel
                            </button>
                            <button onClick={confirmDelete} disabled={deleting}
                                className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2"
                                style={{ background: deleting ? '#9ca3af' : '#dc2626' }}>
                                {deleting
                                    ? <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting…</>
                                    : <><Trash2 className="h-4 w-4" /> Confirm Delete</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ──────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.ok
                        ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                        : <AlertCircle  className="h-5 w-5 flex-shrink-0" />}
                    {toast.msg}
                </div>
            )}
        </Layout>
    );
};

export default AdminDashboard;
