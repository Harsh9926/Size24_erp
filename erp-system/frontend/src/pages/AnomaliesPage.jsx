import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { TriangleAlert, RefreshCw, ShieldCheck, ShieldX, Clock, TrendingDown, TrendingUp, Repeat2, Banknote } from 'lucide-react';

const SEVERITY_COLORS = {
    high:   'bg-red-100 text-red-700 border border-red-200',
    medium: 'bg-amber-100 text-amber-700 border border-amber-200',
};

const CODE_ICONS = {
    ZERO_SALE:       <Banknote    className="h-3.5 w-3.5" />,
    ODD_HOURS:       <Clock       className="h-3.5 w-3.5" />,
    SUDDEN_DROP:     <TrendingDown className="h-3.5 w-3.5" />,
    SUDDEN_SPIKE:    <TrendingUp  className="h-3.5 w-3.5" />,
    ALL_CASH:        <Banknote    className="h-3.5 w-3.5" />,
    REPEATED_AMOUNT: <Repeat2     className="h-3.5 w-3.5" />,
};

const FlagChip = ({ flag }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.medium}`}
        title={flag.detail}>
        {CODE_ICONS[flag.code]}
        {flag.label}
    </span>
);

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const AnomaliesPage = () => {
    const today   = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const [rows,    setRows]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [shops,   setShops]   = useState([]);
    const [filters, setFilters] = useState({ from: weekAgo, to: today, shop_id: '', status: '' });

    const fetchShops = useCallback(async () => {
        try { const r = await api.get('/shops'); setShops(r.data); } catch {}
    }, []);

    const fetchAnomalies = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.from)    params.set('from',    filters.from);
            if (filters.to)      params.set('to',      filters.to);
            if (filters.shop_id) params.set('shop_id', filters.shop_id);
            if (filters.status)  params.set('status',  filters.status);
            const r = await api.get(`/anomalies?${params}`);
            setRows(r.data);
        } catch { setRows([]); }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { fetchShops(); }, [fetchShops]);
    useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);

    const highCount   = rows.filter(r => r.anomaly_flags.some(f => f.severity === 'high')).length;
    const mediumCount = rows.length - highCount;

    return (
        <Layout title="Anomaly Radar">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <TriangleAlert className="h-5 w-5 text-amber-500" />
                        Anomaly Radar
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Entries flagged by pattern rules — review and investigate
                    </p>
                </div>
                <button onClick={fetchAnomalies} disabled={loading}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-orange-50"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Summary chips */}
            <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-xl font-extrabold text-red-600">{highCount}</span>
                    <span className="text-xs font-semibold text-red-600">High Severity</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-xl font-extrabold text-amber-600">{mediumCount}</span>
                    <span className="text-xs font-semibold text-amber-600">Medium Severity</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <span className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{rows.length}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Flagged</span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5 p-4 rounded-xl border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                {[
                    { key: 'from',    type: 'date', label: 'From' },
                    { key: 'to',      type: 'date', label: 'To'   },
                ].map(({ key, type, label }) => (
                    <div key={key}>
                        <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                        <input type={type} value={filters[key]}
                            onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
                            className="text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>
                ))}
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Shop</label>
                    <select value={filters.shop_id} onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}
                        className="text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Shops</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
                    <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="text-sm px-3 py-1.5 rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Shop', 'Date', 'Total Sale', 'Cash', 'Online', 'Status', 'Anomaly Flags'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-gray-400 animate-pulse">Loading anomalies…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16">
                                        <div className="flex flex-col items-center gap-2">
                                            <ShieldCheck className="h-10 w-10 text-emerald-400" />
                                            <p className="font-semibold text-emerald-600">All clear! No anomalies found.</p>
                                            <p className="text-xs text-gray-400">For the selected date range and filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.map((row, i) => {
                                const hasHigh = row.anomaly_flags.some(f => f.severity === 'high');
                                return (
                                    <tr key={row.id}
                                        style={{
                                            borderTop: '1px solid var(--border-color)',
                                            background: hasHigh
                                                ? 'rgba(239,68,68,0.04)'
                                                : i % 2 === 0 ? 'transparent' : 'var(--bg-primary)',
                                        }}>
                                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {row.shop_name}
                                        </td>
                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {fmt(row.total_sale)}
                                        </td>
                                        <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(row.cash)}</td>
                                        <td className="px-4 py-3 text-blue-600 font-medium">{fmt(row.online)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                row.approval_status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                row.approval_status === 'PENDING'  ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {row.approval_status === 'APPROVED' ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                                                {row.approval_status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {row.anomaly_flags.map((f, fi) => <FlagChip key={fi} flag={f} />)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AnomaliesPage;
