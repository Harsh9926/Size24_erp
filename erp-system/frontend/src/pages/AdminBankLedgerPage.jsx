import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Building2, IndianRupee, RefreshCw, Download, Filter,
    ArrowDownLeft, Loader2, AlertCircle, X, Calendar,
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmt     = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    })
    : '—';

const TYPE_CONFIG = {
    PAYMENT_IN:           { label: 'Payment In',         cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', Icon: IndianRupee },
    MANAGER_BANK_DEPOSIT: { label: 'Manager Bank Deposit', cls: 'bg-purple-100 text-purple-700 border-purple-200', Icon: Building2  },
};

const TypeBadge = ({ type }) => {
    const { label, cls, Icon } = TYPE_CONFIG[type] || {
        label: type, cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: ArrowDownLeft,
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cls}`}>
            <Icon className="h-3 w-3" />{label}
        </span>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   ADMIN BANK LEDGER PAGE
═══════════════════════════════════════════════════════════════════ */
const AdminBankLedgerPage = () => {
    const [entries,      setEntries]      = useState([]);
    const [summary,      setSummary]      = useState({ totalPaymentIn: 0, totalBankDeposit: 0, grandTotal: 0 });
    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState('');
    const [shops,        setShops]        = useState([]);

    const [filters, setFilters] = useState({
        type:      '',
        shop_id:   '',
        from_date: '',
        to_date:   '',
    });

    const setFilter = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = Object.fromEntries(
                Object.entries(filters).filter(([, v]) => v)
            );
            const res = await api.get('/payment-in', { params });
            setEntries(res.data.entries || []);
            setSummary({
                totalPaymentIn:    res.data.totalPaymentIn    || 0,
                totalBankDeposit:  res.data.totalBankDeposit  || 0,
                grandTotal:        res.data.grandTotal        || 0,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load ledger.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchEntries();
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
    }, []);

    const clearFilters = () => setFilters({ type: '', shop_id: '', from_date: '', to_date: '' });

    /* ── CSV export ──────────────────────────────────────────────── */
    const downloadCSV = () => {
        const header = ['Date & Time', 'Type', 'Shop', 'Manager', 'Amount', 'Remarks', 'Created By', 'Admin'];
        const rows   = entries.map(e => [
            fmtDate(e.created_at),
            TYPE_CONFIG[e.transaction_type]?.label || e.transaction_type,
            e.shop_name || '—',
            e.manager_name || '—',
            parseFloat(e.amount).toFixed(2),
            e.remarks || '—',
            e.created_by_name || '—',
            e.admin_name || '—',
        ]);
        const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `admin_bank_ledger_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputCls   = 'px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400';
    const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <Layout title="Admin Bank Ledger">

            {/* ── Summary KPI cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    {
                        label: 'Total Payment In',
                        value: summary.totalPaymentIn,
                        color: 'text-indigo-600',
                        bg:    'bg-indigo-50',
                        border:'border-indigo-100',
                        Icon:  IndianRupee,
                    },
                    {
                        label: 'Total Bank Deposits',
                        value: summary.totalBankDeposit,
                        color: 'text-purple-600',
                        bg:    'bg-purple-50',
                        border:'border-purple-100',
                        Icon:  Building2,
                    },
                    {
                        label: 'Grand Total',
                        value: summary.grandTotal,
                        color: 'text-emerald-600',
                        bg:    'bg-emerald-50',
                        border:'border-emerald-100',
                        Icon:  ArrowDownLeft,
                    },
                ].map(({ label, value, color, bg, border, Icon }) => (
                    <div key={label} className={`rounded-xl p-4 border flex items-center gap-4 ${bg} ${border}`}
                        style={{ borderColor: undefined }}>
                        <div className="p-2.5 rounded-xl bg-white/60 flex-shrink-0">
                            <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                            <p className={`text-xl font-extrabold mt-0.5 ${color}`}>{fmt(value)}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filters ───────────────────────────────────────────── */}
            <div className="rounded-xl shadow-sm border p-4 mb-6"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h3>
                    {hasFilters && (
                        <button onClick={clearFilters}
                            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
                            <X className="h-3 w-3" />Clear
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs font-semibold block mb-1 text-gray-500">Type</label>
                        <select value={filters.type} onChange={setFilter('type')} className={inputCls + ' w-full'} style={inputStyle}>
                            <option value="">All Types</option>
                            <option value="PAYMENT_IN">Payment In</option>
                            <option value="MANAGER_BANK_DEPOSIT">Manager Bank Deposit</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold block mb-1 text-gray-500">Shop</label>
                        <select value={filters.shop_id} onChange={setFilter('shop_id')} className={inputCls + ' w-full'} style={inputStyle}>
                            <option value="">All Shops</option>
                            {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold block mb-1 text-gray-500">From Date</label>
                        <input type="date" value={filters.from_date} onChange={setFilter('from_date')}
                            className={inputCls + ' w-full'} style={inputStyle} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold block mb-1 text-gray-500">To Date</label>
                        <input type="date" value={filters.to_date} onChange={setFilter('to_date')}
                            className={inputCls + ' w-full'} style={inputStyle} />
                    </div>
                </div>
                <div className="mt-3 flex gap-2">
                    <button onClick={fetchEntries} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all"
                        style={{ background: loading ? '#9ca3af' : '#6366f1' }}>
                        {loading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        {loading ? 'Loading…' : 'Apply'}
                    </button>
                    {entries.length > 0 && (
                        <button onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                            <Download className="h-4 w-4" />Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* ── Error ─────────────────────────────────────────────── */}
            {error && (
                <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Ledger Table ──────────────────────────────────────── */}
            <div className="rounded-xl shadow-sm border overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-5 py-4 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Bank Ledger
                        <span className="ml-2 text-xs font-normal text-gray-400">
                            {entries.length} record{entries.length !== 1 ? 's' : ''}
                        </span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400">Newest first</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Date & Time', 'Type', 'Shop', 'Manager', 'Amount', 'Remarks', 'Created By', 'Admin'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400 mx-auto" />
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                                        No ledger entries found. {hasFilters && 'Try clearing the filters.'}
                                    </td>
                                </tr>
                            ) : (
                                entries.map((e) => (
                                    <tr key={e.id} style={{ borderTop: '1px solid var(--border-color)' }}
                                        className="hover:opacity-90 transition-opacity">
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {fmtDate(e.created_at)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <TypeBadge type={e.transaction_type} />
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                                            {e.shop_name || <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {e.manager_name || <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-emerald-600 whitespace-nowrap">
                                            {fmt(e.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                                            <span className="break-words whitespace-normal">{e.remarks || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {e.created_by_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {e.admin_name || '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {entries.length > 0 && (
                            <tfoot>
                                <tr style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                    <td colSpan={4} className="px-4 py-3 text-xs font-bold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>Totals ({entries.length} entries)</td>
                                    <td className="px-4 py-3 text-sm font-extrabold text-emerald-600">
                                        {fmt(summary.grandTotal)}
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AdminBankLedgerPage;
