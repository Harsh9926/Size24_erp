import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Lock, Unlock, ChevronLeft, ChevronRight,
    Search, Filter, RefreshCw, Calendar, ArrowRightLeft, Pencil, X,
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
    const [showMissing,    setShowMissing]    = useState(false);
    const [todayStatus,    setTodayStatus]    = useState(null);
    const [todayLoading,   setTodayLoading]   = useState(false);

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

    const toggleMissingShops = async () => {
        if (!showMissing) {
            setTodayLoading(true);
            try {
                const res = await api.get('/entries/today-status');
                setTodayStatus(res.data);
            } catch { setTodayStatus(null); }
            finally { setTodayLoading(false); }
        }
        setShowMissing(v => !v);
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

    // ── Edit modal state ─────────────────────────────────────────
    const [editEntry,   setEditEntry]   = useState(null);
    const [editForm,    setEditForm]    = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError,   setEditError]   = useState('');

    const openEdit = (entry) => {
        setEditEntry(entry);
        setEditForm({
            date:             entry.date ? entry.date.split('T')[0] : '',
            total_sale:       entry.excel_total_sale ?? entry.total_sale ?? '',
            cash:             entry.cash     ?? '',
            online:           entry.online   ?? entry.paytm ?? '',
            razorpay:         entry.razorpay ?? '',
        });
        setEditError('');
    };

    const handleEditSave = async () => {
        setEditLoading(true);
        setEditError('');
        try {
            await api.put(`/entries/${editEntry.id}`, {
                date:             editForm.date,
                total_sale:       parseFloat(editForm.total_sale  || 0),
                excel_total_sale: parseFloat(editForm.total_sale  || 0),
                cash:             parseFloat(editForm.cash        || 0),
                online:           parseFloat(editForm.online      || 0),
                razorpay:         parseFloat(editForm.razorpay    || 0),
            });
            setEditEntry(null);
            loadEntries(page);
        } catch (e) {
            setEditError(e.response?.data?.error || 'Update failed.');
        } finally {
            setEditLoading(false);
        }
    };

    const hasFilters = dateFrom || dateTo || shopFilter || statusFilter;

    return (
        <Layout title="Daily Entries">

            {/* ── Filter bar ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 sm:px-5 py-4 mb-5">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">

                    {/* Date row — side by side on mobile */}
                    <div className="grid grid-cols-2 sm:contents gap-3">
                        {/* Date From */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> From
                            </label>
                            <input type="date" className={inputCls + ' w-full'} value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)} />
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> To
                            </label>
                            <input type="date" className={inputCls + ' w-full'} value={dateTo}
                                onChange={e => setDateTo(e.target.value)} />
                        </div>
                    </div>

                    {/* Shop filter */}
                    {shops.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Shop
                            </label>
                            <select className={inputCls + ' w-full sm:w-auto'} value={shopFilter}
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
                        <select className={inputCls + ' w-full sm:w-auto'} value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Status</option>
                            <option value="APPROVED">Approved</option>
                            <option value="PENDING">Pending</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 sm:ml-auto items-center">
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                                Clear
                            </button>
                        )}
                        <button onClick={() => applyFilters()}
                            className="flex-1 sm:flex-none px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                            <Search className="h-3.5 w-3.5" /> Search
                        </button>
                        <button onClick={() => loadEntries(page)} title="Refresh"
                            className="px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Missing Shops Toggle + Panel ─────────────────── */}
            <div className="mb-4 flex items-center gap-3">
                <button
                    onClick={toggleMissingShops}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
                        showMissing
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {todayLoading
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                        : <><Filter className="h-3.5 w-3.5" /> {showMissing ? 'Hide Missing Shops' : 'Show Missing Shops Today'}</>
                    }
                </button>
                {todayStatus && showMissing && (
                    <span className="text-xs text-gray-500">
                        {todayStatus.submittedCount}/{todayStatus.totalShops} submitted
                    </span>
                )}
            </div>

            {showMissing && todayStatus && (
                <div className="mb-4 rounded-xl border overflow-hidden shadow-sm">
                    <div className="px-4 py-3 text-xs font-bold uppercase tracking-wide bg-gray-50 border-b border-gray-100 text-gray-500">
                        Today's Submission Status — {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Shop</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...todayStatus.submittedShops.map(s => ({ ...s, submitted: true })),
                              ...todayStatus.pendingShops.map(s => ({ ...s, submitted: false }))]
                              .sort((a, b) => a.shop_name.localeCompare(b.shop_name))
                              .map(s => (
                                <tr key={s.id} className="border-t border-gray-100">
                                    <td className="px-4 py-2.5 font-medium text-gray-800">{s.shop_name}</td>
                                    <td className="px-4 py-2.5">
                                        {s.submitted
                                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" /> Submitted
                                              </span>
                                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" /> Pending
                                              </span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Header row */}
                <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
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
                                        <div className="flex items-center gap-1.5">
                                            {e.locked && !isEditable(e) && (
                                                <button onClick={() => handleUnlock(e.id)}
                                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                    <Unlock className="h-3 w-3" /> Unlock
                                                </button>
                                            )}
                                            <button onClick={() => openEdit(e)}
                                                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium border border-amber-200 px-2 py-1 rounded-md hover:bg-amber-50 transition-colors">
                                                <Pencil className="h-3 w-3" /> Edit
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination bar ───────────────────────────── */}
                {pages > 1 && (
                    <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
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
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
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
                                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] break-words whitespace-normal">
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

            {/* ── Edit Entry Modal ─────────────────────────────── */}
            {editEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Edit Entry</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{editEntry.shop_name}</p>
                            </div>
                            <button onClick={() => setEditEntry(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Fields */}
                        <div className="space-y-3">
                            {[
                                { label: 'Date',            key: 'date',       type: 'date'   },
                                { label: 'Total Sale (₹)',  key: 'total_sale', type: 'number' },
                                { label: 'Cash (₹)',        key: 'cash',       type: 'number' },
                                { label: 'QR/Card/Bank (₹)',key: 'online',     type: 'number' },
                                { label: 'RazorPay (₹)',    key: 'razorpay',   type: 'number' },
                            ].map(({ label, key, type }) => (
                                <div key={key}>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                                    <input
                                        type={type}
                                        value={editForm[key]}
                                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                    />
                                </div>
                            ))}
                        </div>

                        {editError && (
                            <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                {editError}
                            </p>
                        )}

                        {/* Footer */}
                        <div className="flex gap-2 mt-5">
                            <button onClick={() => setEditEntry(null)}
                                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleEditSave} disabled={editLoading}
                                className="flex-1 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                                {editLoading ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default EntriesPage;
