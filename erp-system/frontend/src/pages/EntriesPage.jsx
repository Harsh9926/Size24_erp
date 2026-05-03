import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Lock, Unlock, ChevronLeft, ChevronRight,
    Search, Filter, RefreshCw, Calendar, ArrowRightLeft,
} from 'lucide-react';

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PAGE_SIZE = 20;

const statusBadge = {
    APPROVED: 'bg-green-100 text-green-700 border-green-200',
    PENDING:  'bg-amber-100 text-amber-700 border-amber-200',
    REJECTED: 'bg-red-100  text-red-700  border-red-200',
};

const inputCls =
    'px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none ' +
    'focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white text-gray-700';

const EntriesPage = () => {
    const [entries,       setEntries]       = useState([]);
    const [shops,         setShops]         = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [total,         setTotal]         = useState(0);
    const [pages,         setPages]         = useState(1);

    // Cash transfers
    const [transfers,     setTransfers]     = useState([]);
    const [txLoading,     setTxLoading]     = useState(true);
    const [txStatusFilter,setTxStatusFilter]= useState('');

    // Filters
    const [dateFrom,    setDateFrom]    = useState('');
    const [dateTo,      setDateTo]      = useState('');
    const [shopFilter,  setShopFilter]  = useState('');
    const [statusFilter,setStatusFilter]= useState('');
    const [page,        setPage]        = useState(1);

    const loadEntries = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
            if (dateFrom)     params.set('date_from',  dateFrom);
            if (dateTo)       params.set('date_to',    dateTo);
            if (shopFilter)   params.set('shop_id',    shopFilter);
            if (statusFilter) params.set('status',     statusFilter);

            const res = await api.get(`/entries?${params}`);
            setEntries(res.data.entries);
            setTotal(res.data.total);
            setPages(res.data.pages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, dateFrom, dateTo, shopFilter, statusFilter]);

    const fetchTransfers = useCallback(async (status = txStatusFilter) => {
        setTxLoading(true);
        try {
            const qs = status ? `?status=${status}` : '';
            const res = await api.get(`/transfers/admin${qs}`);
            setTransfers(res.data);
        } catch { setTransfers([]); }
        finally { setTxLoading(false); }
    }, [txStatusFilter]);

    // Load shops for filter dropdown (admin/manager)
    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
        fetchTransfers('');
    }, []);

    useEffect(() => { loadEntries(page); }, [page, dateFrom, dateTo, shopFilter, statusFilter]);

    const applyFilters = () => { setPage(1); loadEntries(1); };
    const clearFilters = () => {
        setDateFrom(''); setDateTo(''); setShopFilter(''); setStatusFilter('');
        setPage(1);
    };

    const handleUnlock = async (id) => {
        try {
            await api.post(`/entries/${id}/unlock`);
            loadEntries(page);
            alert('Entry unlocked for 10 minutes!');
        } catch (e) {
            alert(e.response?.data?.error || 'Error');
        }
    };

    const isEditable = (entry) =>
        entry.locked && entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);

    const hasFilters = dateFrom || dateTo || shopFilter || statusFilter;

    return (
        <Layout title="Daily Entries">

            {/* ── Filter bar ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
                <div className="flex flex-wrap items-end gap-3">

                    {/* Date From */}
                    <div className="flex flex-col gap-1 min-w-0">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> From
                        </label>
                        <input type="date" className={inputCls} value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)} />
                    </div>

                    {/* Date To */}
                    <div className="flex flex-col gap-1 min-w-0">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> To
                        </label>
                        <input type="date" className={inputCls} value={dateTo}
                            onChange={e => setDateTo(e.target.value)} />
                    </div>

                    {/* Shop filter */}
                    {shops.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Shop
                            </label>
                            <select className={inputCls} value={shopFilter}
                                onChange={e => setShopFilter(e.target.value)}>
                                <option value="">All Shops</option>
                                {shops.map(s => (
                                    <option key={s.id} value={s.id}>{s.shop_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status filter */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <Filter className="h-3 w-3" /> Status
                        </label>
                        <select className={inputCls} value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="APPROVED">Approved</option>
                            <option value="PENDING">Pending</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 ml-auto items-end pb-0.5">
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                                Clear
                            </button>
                        )}
                        <button onClick={() => applyFilters()}
                            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors">
                            <Search className="h-3.5 w-3.5" /> Search
                        </button>
                        <button onClick={() => loadEntries(page)} title="Refresh"
                            className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Table ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Header row */}
                <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                        {loading ? 'Loading…' : (
                            <>
                                {total.toLocaleString('en-IN')} entr{total === 1 ? 'y' : 'ies'}
                                {hasFilters && <span className="ml-1.5 text-xs text-indigo-500 font-medium">(filtered)</span>}
                            </>
                        )}
                    </p>
                    <p className="text-xs text-gray-400">
                        Page {page} of {pages}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Date', 'Shop', 'Total Sale', 'Cash', 'QR/Card/Bank', 'RazorPay', 'Approval', 'Lock', 'Action'].map(h => (
                                    <th key={h}
                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr>
                                    <td colSpan="9" className="text-center py-14 text-gray-400 text-sm animate-pulse">
                                        Loading entries…
                                    </td>
                                </tr>
                            )}
                            {!loading && entries.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="text-center py-14 text-gray-400 text-sm">
                                        No entries found{hasFilters ? ' for the selected filters' : ''}
                                    </td>
                                </tr>
                            )}
                            {!loading && entries.map(e => (
                                <tr key={e.id} className="hover:bg-gray-50 transition-colors">

                                    {/* Date */}
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                        {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>

                                    {/* Shop */}
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600 whitespace-nowrap">
                                        {e.shop_name}
                                    </td>

                                    {/* Total Sale */}
                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                                        ₹{Number(e.total_sale || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Cash */}
                                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                        ₹{Number(e.cash || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Online */}
                                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                        ₹{Number(e.online ?? e.paytm ?? 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* RazorPay */}
                                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                        ₹{Number(e.razorpay || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Approval status */}
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${statusBadge[e.approval_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                            {(e.approval_status || 'PENDING').charAt(0) + (e.approval_status || 'PENDING').slice(1).toLowerCase()}
                                        </span>
                                    </td>

                                    {/* Lock status */}
                                    <td className="px-4 py-3">
                                        {isEditable(e) ? (
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                Unlocked
                                            </span>
                                        ) : (
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${e.locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {e.locked ? 'Locked' : 'Open'}
                                            </span>
                                        )}
                                    </td>

                                    {/* Action */}
                                    <td className="px-4 py-3">
                                        {e.locked && !isEditable(e) && (
                                            <button onClick={() => handleUnlock(e.id)}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                <Unlock className="h-3 w-3" /> Unlock
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination bar ───────────────────────────── */}
                {pages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString('en-IN')}
                        </p>

                        <div className="flex items-center gap-1">
                            {/* Prev */}
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft className="h-4 w-4" />
                            </button>

                            {/* Page numbers */}
                            {Array.from({ length: pages }, (_, i) => i + 1)
                                .filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2)
                                .reduce((acc, n, idx, arr) => {
                                    if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                                    acc.push(n);
                                    return acc;
                                }, [])
                                .map((n, i) =>
                                    n === '…' ? (
                                        <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
                                    ) : (
                                        <button key={n} onClick={() => setPage(n)}
                                            className={`min-w-[32px] h-8 text-xs font-semibold rounded-lg border transition-colors ${
                                                n === page
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}>
                                            {n}
                                        </button>
                                    )
                                )
                            }

                            {/* Next */}
                            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* ── Cash Transfers ───────────────────────────────── */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-base font-semibold text-gray-800">Cash Transfers</h3>
                        <span className="text-xs text-gray-400">({transfers.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={txStatusFilter}
                            onChange={e => { setTxStatusFilter(e.target.value); fetchTransfers(e.target.value); }}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-gray-700">
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

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['From (Shop User)', 'To (Manager)', 'Amount', 'Note', 'Status', 'Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {txLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-400 text-sm animate-pulse">
                                        Loading transfers…
                                    </td>
                                </tr>
                            )}
                            {!txLoading && transfers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-400 text-sm">
                                        No transfers found.
                                    </td>
                                </tr>
                            )}
                            {!txLoading && transfers.map(t => {
                                const sCfg = {
                                    pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending'  },
                                    accepted: { cls: 'bg-green-100 text-green-700 border-green-200', label: 'Accepted' },
                                    rejected: { cls: 'bg-red-100   text-red-700   border-red-200',   label: 'Rejected' },
                                }[t.status] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: t.status };
                                return (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-800">{t.from_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{t.from_mobile}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-indigo-600">{t.to_name || '—'}</p>
                                            <p className="text-xs text-gray-400">{t.to_mobile}</p>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">
                                            {fmt(t.amount)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate" title={t.note}>
                                            {t.note || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${sCfg.cls}`}>
                                                {sCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                            {fmtDate(t.created_at)}
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

export default EntriesPage;
