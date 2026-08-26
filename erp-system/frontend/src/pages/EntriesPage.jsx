import React, { useEffect, useState, useCallback, useContext } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import {
    Lock, Unlock, ChevronLeft, ChevronRight,
    Search, Filter, RefreshCw, Calendar, ArrowRightLeft, Pencil, X,
    FileSpreadsheet, ChevronDown, ChevronUp, Loader2, TriangleAlert, Trash2,
    Image as ImageIcon, AlertCircle, ListChecks, Eye,
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
    'h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none ' +
    'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-700 transition-shadow';

const EntriesPage = () => {
    const { user } = useContext(AuthContext);
    const { can } = usePermissions();
    // Existing hardcoded gate preserved as-is, AND-ed with the new
    // action-level permission (defense in depth, not a replacement).
    const canDelete = user?.mobile === '8817654579' && can('entries.delete');
    const canEdit   = can('entries.edit');
    const canUnlock = can('entries.unlock');

    const [entries,       setEntries]       = useState([]);
    const [shops,         setShops]         = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [total,         setTotal]         = useState(0);
    const [pages,         setPages]         = useState(1);
    const [anomalyMap,    setAnomalyMap]    = useState({}); // entry_id → flags[]

    // Delete modal state
    const [deleteModalEntry, setDeleteModalEntry] = useState(null);
    const [deleteLoading,    setDeleteLoading]    = useState(false);
    const [deleteError,      setDeleteError]      = useState('');

    // Delete Cash Transfer modal state
    const [deleteTxModal,   setDeleteTxModal]   = useState(null);
    const [deleteTxLoading, setDeleteTxLoading] = useState(false);
    const [deleteTxError,   setDeleteTxError]   = useState('');

    // Cash transfers
    const [transfers,     setTransfers]     = useState([]);
    const [txLoading,     setTxLoading]     = useState(true);
    const [txStatusFilter,setTxStatusFilter]= useState('');

    // Filters
    const [dateFrom,       setDateFrom]       = useState('');
    const [dateTo,         setDateTo]         = useState('');
    const [shopFilter,     setShopFilter]     = useState('');
    const [statusFilter,   setStatusFilter]   = useState('');
    const [entryTypeFilter,setEntryTypeFilter]= useState('');
    const [page,        setPage]        = useState(1);
    const [showMissing,    setShowMissing]    = useState(false);
    const [todayStatus,    setTodayStatus]    = useState(null);
    const [todayLoading,   setTodayLoading]   = useState(false);

    const loadEntries = useCallback(async (p = page) => {  // eslint-disable-line react-hooks/exhaustive-deps
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
            if (dateFrom)        params.set('date_from',   dateFrom);
            if (dateTo)          params.set('date_to',     dateTo);
            if (shopFilter)      params.set('shop_id',     shopFilter);
            if (statusFilter)    params.set('status',      statusFilter);
            if (entryTypeFilter) params.set('entry_type',  entryTypeFilter);

            const res = await api.get(`/entries?${params}`);
            setEntries(res.data.entries);
            setTotal(res.data.total);
            setPages(res.data.pages);

            /* fetch anomalies for the visible date range */
            const anomalyParams = new URLSearchParams();
            if (dateFrom) anomalyParams.set('from', dateFrom);
            if (dateTo)   anomalyParams.set('to', dateTo);
            if (shopFilter) anomalyParams.set('shop_id', shopFilter);
            api.get(`/anomalies?${anomalyParams}`).then(ar => {
                const map = {};
                ar.data.forEach(r => { map[r.id] = r.anomaly_flags; });
                setAnomalyMap(map);
            }).catch(() => {});
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, dateFrom, dateTo, shopFilter, statusFilter, entryTypeFilter]);

    const fetchTransfers = useCallback(async (status = txStatusFilter) => {
        setTxLoading(true);
        try {
            const qs = status ? `?status=${status}` : '';
            const endpoint = user?.role === 'admin' ? '/transfers/admin' : '/transfers/manager';
            const res = await api.get(`${endpoint}${qs}`);
            setTransfers(res.data);
        } catch { setTransfers([]); }
        finally { setTxLoading(false); }
    }, [txStatusFilter, user?.role]);

    // Load shops for filter dropdown (admin/manager)
    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
        fetchTransfers('');
    }, []);

    useEffect(() => { loadEntries(page); }, [page, dateFrom, dateTo, shopFilter, statusFilter]);

    const applyFilters = () => { setPage(1); loadEntries(1); };
    const clearFilters = () => {
        setDateFrom(''); setDateTo(''); setShopFilter(''); setStatusFilter(''); setEntryTypeFilter('');
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
    const [piAdmins,    setPiAdmins]    = useState([]);

    // ── Cash Transfers collapse ───────────────────────────────────
    const [txOpen, setTxOpen] = useState(true);

    // ── Photo Proof lightbox state ────────────────────────────────
    const [photoModal,   setPhotoModal]   = useState(null); // entry being viewed
    const [photoUrl,     setPhotoUrl]     = useState('');
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoError,   setPhotoError]   = useState('');

    const openPhoto = async (entry) => {
        setPhotoModal(entry);
        setPhotoUrl(''); setPhotoError(''); setPhotoLoading(true);
        try {
            // Backend generates a fresh presigned S3 GET URL on demand
            const res = await api.get(`/entries/${entry.id}/photo-proof`);
            if (!res.data?.url) throw new Error('No Photo Proof');
            setPhotoUrl(res.data.url);
        } catch (err) {
            setPhotoError(err.response?.status === 404
                ? 'No Photo Proof'
                : (err.response?.data?.error || 'Could not load photo. Please retry.'));
        } finally {
            setPhotoLoading(false);
        }
    };

    // ── Excel sheet modal state ───────────────────────────────────
    const [excelModal,   setExcelModal]   = useState(null);
    const [excelData,    setExcelData]    = useState(null);
    const [excelLoading, setExcelLoading] = useState(false);
    const [excelTab,     setExcelTab]     = useState(1);

    const openExcel = async (entry) => {
        setExcelModal(entry);
        setExcelData(null);
        setExcelLoading(true);
        try {
            const dateStr = entry.date ? entry.date.split('T')[0] : '';
            const res = await api.get(`/excel/by-entry?shop_id=${entry.shop_id}&date=${dateStr}`);
            setExcelData(res.data);
        } catch {
            setExcelData(null);
        } finally {
            setExcelLoading(false);
        }
    };

    const openEdit = async (entry) => {
        setEditEntry(entry);
        setEditForm({
            date:                entry.date ? entry.date.split('T')[0] : '',
            total_sale:          entry.excel_total_sale ?? entry.total_sale ?? '',
            cash:                entry.cash      ?? '',
            online:              entry.online    ?? entry.paytm ?? '',
            razorpay:            entry.razorpay  ?? '',
            payment_in:          entry.payment_in          ?? '',
            payment_in_admin_id: entry.payment_in_admin_id ?? '',
        });
        setEditError('');
        if (piAdmins.length === 0) {
            try {
                const res = await api.get('/payment-in/admins');
                setPiAdmins(res.data || []);
            } catch (err) {
                console.error('Failed to fetch payment-in admins:', err);
            }
        }
    };

    const handleEditSave = async () => {
        const piAmt = parseFloat(editForm.payment_in || 0);
        if (piAmt > 0 && !editForm.payment_in_admin_id) {
            setEditError('Select an Admin Bank Account for Payment In.');
            return;
        }

        // Breakdown must match total sale
        const breakdown = parseFloat(editForm.cash || 0)
            + parseFloat(editForm.online || 0)
            + parseFloat(editForm.razorpay || 0)
            + piAmt;
        const total = parseFloat(editForm.total_sale || 0);
        if (Math.abs(breakdown - total) > 0.01) {
            setEditError(`Breakdown ₹${breakdown.toFixed(2)} must match Total Sale ₹${total.toFixed(2)}.`);
            return;
        }

        setEditLoading(true);
        setEditError('');
        try {
            await api.put(`/entries/${editEntry.id}`, {
                date:                editForm.date,
                total_sale:          total,
                excel_total_sale:    total,
                cash:                parseFloat(editForm.cash     || 0),
                online:              parseFloat(editForm.online   || 0),
                razorpay:            parseFloat(editForm.razorpay || 0),
                payment_in:          piAmt,
                payment_in_admin_id: editForm.payment_in_admin_id || null,
            });
            setEditEntry(null);
            loadEntries(page);
        } catch (e) {
            setEditError(e.response?.data?.error || 'Update failed.');
        } finally {
            setEditLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModalEntry) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await api.delete(`/entries/${deleteModalEntry.id}`);
            setDeleteModalEntry(null);
            loadEntries(page);
        } catch (e) {
            if (e.response?.status === 404) {
                setDeleteModalEntry(null);
                loadEntries(page);
            } else {
                setDeleteError(e.response?.data?.error || 'Failed to delete entry.');
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDeleteTxConfirm = async () => {
        if (!deleteTxModal) return;
        setDeleteTxLoading(true);
        setDeleteTxError('');
        try {
            await api.delete(`/transfers/${deleteTxModal.id}`);
            setDeleteTxModal(null);
            fetchTransfers(txStatusFilter);
        } catch (e) {
            if (e.response?.status === 404) {
                setDeleteTxModal(null);
                fetchTransfers(txStatusFilter);
            } else {
                setDeleteTxError(e.response?.data?.error || 'Failed to delete transfer.');
            }
        } finally {
            setDeleteTxLoading(false);
        }
    };

    const hasFilters = dateFrom || dateTo || shopFilter || statusFilter;

    return (
        <Layout title="Daily Entries" subtitle="Manage, review and monitor daily shop entries.">

          <div className="max-w-[1600px] mx-auto space-y-4">

            {/* ── Filter toolbar ───────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 sm:px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-700">Filters</h2>
                </div>
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

                    {/* Entry Type filter */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                            <Filter className="h-3 w-3" /> Type
                        </label>
                        <select className={inputCls + ' w-full sm:w-auto'} value={entryTypeFilter}
                            onChange={e => setEntryTypeFilter(e.target.value)}>
                            <option value="">All Types</option>
                            <option value="normal">Normal</option>
                            <option value="no_sale">No Sale</option>
                        </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 sm:ml-auto items-center">
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex-1 sm:flex-none h-10 px-3.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Clear
                            </button>
                        )}
                        <button onClick={() => applyFilters()}
                            className="flex-1 sm:flex-none h-10 px-5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors">
                            <Search className="h-4 w-4" /> Search
                        </button>
                        <button onClick={() => loadEntries(page)} title="Refresh entries" aria-label="Refresh entries"
                            className="h-10 w-10 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Missing shops — secondary outlined action within the toolbar */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <button
                        onClick={toggleMissingShops}
                        className={`inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium rounded-lg border transition-all ${
                            showMissing
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {todayLoading
                            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                            : <><ListChecks className="h-3.5 w-3.5" /> {showMissing ? 'Hide Missing Shops' : 'Show Missing Shops Today'}</>
                        }
                    </button>
                    {todayStatus && showMissing && (
                        <span className="text-xs text-gray-500 font-medium">
                            {todayStatus.submittedCount}/{todayStatus.totalShops} submitted
                        </span>
                    )}
                </div>
            </div>

            {showMissing && todayStatus && (
                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
                            {(todayStatus.allShops || [])
                              .slice().sort((a, b) => a.shop_name.localeCompare(b.shop_name))
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                {/* Header row */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                        Daily Entries
                        <span className="text-xs font-medium text-gray-400">
                            {loading ? '· loading…' : `· ${total.toLocaleString('en-IN')} total`}
                            {hasFilters && <span className="ml-1 text-indigo-500">(filtered)</span>}
                        </span>
                    </h3>
                    <p className="text-xs text-gray-400 font-medium">
                        Page {page} of {pages}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/80">
                            <tr>
                                {['Date', 'Shop', 'Total Sale', 'Cash', 'QR/Card/Bank', 'RazorPay', 'Payment In', 'Approval', 'Lock', 'Actions'].map(h => (
                                    <th key={h}
                                        className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr>
                                    <td colSpan="10" className="text-center py-12 text-gray-400 text-sm">
                                        <Loader2 className="h-5 w-5 animate-spin inline mr-2 align-[-3px]" /> Loading entries…
                                    </td>
                                </tr>
                            )}
                            {!loading && entries.length === 0 && (
                                <tr>
                                    <td colSpan="10" className="text-center py-12 text-gray-400 text-sm">
                                        No entries found{hasFilters ? ' for the selected filters' : ''}
                                    </td>
                                </tr>
                            )}
                            {!loading && entries.map(e => {
                                const eFlags = anomalyMap[e.id] || [];
                                const hasHigh = eFlags.some(f => f.severity === 'high');
                                return (
                                <tr key={e.id} className="hover:bg-indigo-50/40 transition-colors"
                                    style={eFlags.length > 0 ? { background: hasHigh ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)' } : {}}>

                                    {/* Date — readable but secondary */}
                                    <td className="px-4 py-4 text-[13px] text-gray-500 whitespace-nowrap">
                                        {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>

                                    {/* Shop — visually prominent */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold text-gray-900">{e.shop_name}</span>
                                            {eFlags.length > 0 && (
                                                <span title={eFlags.map(f => f.label + ': ' + f.detail).join('\n')}
                                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${hasHigh ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    <TriangleAlert className="h-3 w-3" />
                                                    {eFlags.length}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Total Sale — strongest monetary value */}
                                    <td className="px-4 py-4 text-[15px] font-bold text-gray-900 tabular-nums whitespace-nowrap">
                                        ₹{Number(e.total_sale || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Cash */}
                                    <td className="px-4 py-4 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                                        ₹{Number(e.cash || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Online */}
                                    <td className="px-4 py-4 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                                        ₹{Number(e.online ?? e.paytm ?? 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* RazorPay */}
                                    <td className="px-4 py-4 text-sm text-gray-600 tabular-nums whitespace-nowrap">
                                        ₹{Number(e.razorpay || 0).toLocaleString('en-IN')}
                                    </td>

                                    {/* Payment In */}
                                    <td className="px-4 py-4 text-sm tabular-nums whitespace-nowrap">
                                        {Number(e.payment_in || 0) > 0 ? (
                                            <span className="font-semibold text-emerald-600">
                                                ₹{Number(e.payment_in).toLocaleString('en-IN')}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">—</span>
                                        )}
                                    </td>

                                    {/* Approval status + entry type */}
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border w-fit ${statusBadge[e.approval_status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${e.approval_status === 'APPROVED' ? 'bg-green-500' : e.approval_status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                {(e.approval_status || 'PENDING').charAt(0) + (e.approval_status || 'PENDING').slice(1).toLowerCase()}
                                            </span>
                                            {e.entry_type === 'no_sale' && (
                                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border w-fit bg-orange-100 text-orange-700 border-orange-200">
                                                    No Sale
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Lock status */}
                                    <td className="px-4 py-4">
                                        {isEditable(e) ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                <Unlock className="h-3 w-3" /> Unlocked
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${e.locked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                {e.locked ? <Lock className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                                                {e.locked ? 'Locked' : 'Open'}
                                            </span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5">
                                            {/* Unlock — compact, only when locked */}
                                            {e.locked && !isEditable(e) && canUnlock && (
                                                <button onClick={() => handleUnlock(e.id)} title="Unlock for editing"
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
                                                    <Unlock className="h-4 w-4" />
                                                </button>
                                            )}

                                            {/* Edit — secondary icon */}
                                            {canEdit && (
                                                <button onClick={() => openEdit(e)} title="Edit entry"
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-colors">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            )}

                                            {/* View Photo — primary/important, distinct */}
                                            <button onClick={() => openPhoto(e)}
                                                title={e.photo_proof_key || e.photo_proof_url ? 'View Photo Proof' : 'No Photo Proof'}
                                                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-colors">
                                                <Eye className="h-3.5 w-3.5" /> View Photo
                                            </button>

                                            {/* Sheet — secondary icon */}
                                            <button onClick={() => openExcel(e)} title="View Excel sheet"
                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors">
                                                <FileSpreadsheet className="h-4 w-4" />
                                            </button>

                                            {/* Delete — subtle danger icon */}
                                            {canDelete && (
                                                <button onClick={() => { setDeleteModalEntry(e); setDeleteError(''); }}
                                                    title="Permanently delete entry"
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-transparent text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
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
            {/* ── Cash Transfers (secondary, collapsible) ──────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                {/* Header — click to collapse */}
                <div className="px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                    <button onClick={() => setTxOpen(o => !o)} className="flex items-center gap-2 group">
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${txOpen ? '' : '-rotate-90'}`} />
                        <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-base font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">Cash Transfers</h3>
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                            {transfers.length}
                        </span>
                    </button>
                    {txOpen && (
                        <div className="flex items-center gap-2">
                            <select value={txStatusFilter}
                                onChange={e => { setTxStatusFilter(e.target.value); fetchTransfers(e.target.value); }}
                                className="h-9 text-xs border border-gray-200 rounded-lg px-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700">
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <button onClick={() => fetchTransfers(txStatusFilter)} title="Refresh transfers"
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 transition-colors">
                                <RefreshCw className={`h-3.5 w-3.5 ${txLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Table */}
                {txOpen && (
                <div className="overflow-x-auto border-t border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['From (Shop User)', 'To (Manager)', 'Amount', 'Note', 'Status', 'Date', ...(canDelete ? ['Action'] : [])].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {txLoading && (
                                <tr>
                                    <td colSpan={canDelete ? 7 : 6} className="text-center py-10 text-gray-400 text-sm animate-pulse">
                                        Loading transfers…
                                    </td>
                                </tr>
                            )}
                            {!txLoading && transfers.length === 0 && (
                                <tr>
                                    <td colSpan={canDelete ? 7 : 6} className="text-center py-10 text-gray-400 text-sm">
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
                                        {canDelete && (
                                            <td className="px-4 py-3">
                                                <button onClick={() => { setDeleteTxModal(t); setDeleteTxError(''); }}
                                                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                                                    title="Permanently Delete Transfer">
                                                    <Trash2 className="h-3 w-3" /> Delete
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

          </div>{/* /max-w page container */}

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
                                { label: 'Date',             key: 'date',       type: 'date'   },
                                { label: 'Total Sale (₹)',   key: 'total_sale', type: 'number' },
                                { label: 'Cash (₹)',         key: 'cash',       type: 'number' },
                                { label: 'QR/Card/Bank (₹)', key: 'online',     type: 'number' },
                                { label: 'RazorPay (₹)',     key: 'razorpay',   type: 'number' },
                            ].map(({ label, key, type }) => (
                                <div key={key}>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                                    <input
                                        type={type}
                                        value={editForm[key] ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                    />
                                </div>
                            ))}

                            {/* Payment In */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">
                                    Payment In (₹)
                                    <span className="ml-1 font-normal text-indigo-400">(optional · not counted as sale)</span>
                                </label>
                                <input
                                    type="number" min="0" step="0.01"
                                    value={editForm.payment_in ?? ''}
                                    onChange={e => setEditForm(f => ({ ...f, payment_in: e.target.value }))}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                                />
                            </div>

                            {/* Admin Bank Account — shown only when Payment In > 0 */}
                            {parseFloat(editForm.payment_in) > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                                        Admin Bank Account *
                                    </label>
                                    <select
                                        value={editForm.payment_in_admin_id ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, payment_in_admin_id: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white text-gray-700"
                                    >
                                        <option value="">— Select admin —</option>
                                        {piAdmins.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Breakdown indicator */}
                            {(() => {
                                const breakdown = parseFloat(editForm.cash || 0)
                                    + parseFloat(editForm.online || 0)
                                    + parseFloat(editForm.razorpay || 0)
                                    + parseFloat(editForm.payment_in || 0);
                                const total  = parseFloat(editForm.total_sale || 0);
                                const ok     = Math.abs(breakdown - total) <= 0.01;
                                return (
                                    <div className={`px-3 py-2 rounded-lg border text-xs flex justify-between ${ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                        <span>Cash + Razorpay + QR + Payment In</span>
                                        <span className="font-bold">{fmt(breakdown)} {ok ? '✓' : `≠ ${fmt(total)}`}</span>
                                    </div>
                                );
                            })()}
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

            {/* ── Photo Proof Lightbox ─────────────────────────── */}
            {photoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.75)' }}
                    onClick={() => setPhotoModal(null)}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: 'var(--bg-surface)' }}
                        onClick={(ev) => ev.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>Photo Proof</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{photoModal.shop_name || 'Entry'}</p>
                                </div>
                            </div>
                            <button onClick={() => setPhotoModal(null)}
                                className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-secondary)' }} aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Image */}
                        <div className="p-5 flex items-center justify-center min-h-[240px]"
                            style={{ background: 'var(--bg-primary)' }}>
                            {photoLoading ? (
                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    <span className="text-xs font-medium">Loading photo…</span>
                                </div>
                            ) : photoError ? (
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <AlertCircle className={`h-8 w-8 ${photoError === 'No Photo Proof' ? 'text-gray-400' : 'text-red-500'}`} />
                                    <span className={`text-sm font-semibold ${photoError === 'No Photo Proof' ? 'text-gray-500' : 'text-red-600'}`}>
                                        {photoError}
                                    </span>
                                    {photoError !== 'No Photo Proof' && (
                                        <button onClick={() => openPhoto(photoModal)}
                                            className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                            <RefreshCw className="h-3 w-3" /> Retry
                                        </button>
                                    )}
                                </div>
                            ) : photoUrl ? (
                                <img src={photoUrl} alt="Photo Proof"
                                    className="max-w-full max-h-[65vh] rounded-lg object-contain shadow-sm"
                                    onError={() => setPhotoError('Could not load photo. Please retry.')} />
                            ) : null}
                        </div>

                        {/* Meta footer */}
                        <div className="px-5 py-3 border-t grid grid-cols-3 gap-3"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Date</p>
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtDate(photoModal.date)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Shop</p>
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{photoModal.shop_name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Uploaded by</p>
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {photoModal.submitted_by_name || photoModal.submitted_by_mobile || '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Excel Sheet Modal ────────────────────────────── */}
            {excelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl p-6 flex flex-col" style={{ maxHeight: '90vh' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                    Excel Sheet
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {excelModal.shop_name} — {new Date(excelModal.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => { setExcelModal(null); setExcelData(null); setExcelTab(1); }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col flex-1 min-h-0">
                            {excelLoading && (
                                <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Loading sheet…</span>
                                </div>
                            )}
                            {!excelLoading && !excelData && (
                                <div className="text-center py-16 text-gray-400 text-sm">
                                    No Excel sheet found for this entry.
                                </div>
                            )}
                            {!excelLoading && excelData && (() => {
                                const rd = excelData.row_data;
                                // New format: { tab1: [...], tab2: [...], tab1_name, tab2_name }
                                // Old format: array
                                const isMultiTab = rd && !Array.isArray(rd) && rd.tab1;
                                const tab1Rows = isMultiTab ? (rd.tab1 || []) : (Array.isArray(rd) ? rd : []);
                                const tab2Rows = isMultiTab ? (rd.tab2 || []) : [];
                                const tab1Name = isMultiTab ? (rd.tab1_name || 'Sheet 1') : 'Sheet 1';
                                const tab2Name = isMultiTab ? (rd.tab2_name || 'Sheet 2') : 'Sheet 2';
                                const activeRows = excelTab === 2 ? tab2Rows : tab1Rows;
                                const cols = activeRows.length > 0 ? Object.keys(activeRows[0]) : [];
                                return (
                                    <>
                                        {/* Tab switcher */}
                                        {isMultiTab && tab2Rows.length > 0 && (
                                            <div className="flex gap-1 mb-2 flex-shrink-0">
                                                {[{ n: 1, label: tab1Name }, { n: 2, label: tab2Name }].map(({ n, label }) => (
                                                    <button key={n} onClick={() => setExcelTab(n)}
                                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${excelTab === n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="overflow-auto flex-1 border border-gray-100 rounded-lg">
                                            {cols.length === 0 ? (
                                                <div className="text-center py-10 text-gray-400 text-sm">No data in this sheet.</div>
                                            ) : (
                                                <table className="min-w-full text-xs border-collapse">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            {cols.map(col => (
                                                                <th key={col} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase border-b border-gray-200 whitespace-nowrap">
                                                                    {col}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {activeRows.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                {cols.map(col => (
                                                                    <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                                                                        {row[col] != null ? String(row[col]) : '—'}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        {!excelLoading && excelData && (
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
                                <span>{excelData.filename}</span>
                                <span>Total Sale: ₹{Number(excelData.total_sale || 0).toLocaleString('en-IN')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ───────────────────────── */}
            {deleteModalEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
                            <div className="flex items-center gap-2 text-red-600">
                                <TriangleAlert className="h-5 w-5" />
                                <h3 className="text-base font-bold text-gray-900">Delete Daily Entry</h3>
                            </div>
                            <button onClick={() => setDeleteModalEntry(null)} disabled={deleteLoading}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-gray-700 font-medium">
                                Are you sure you want to delete this entry?
                            </p>
                            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-xs space-y-1.5 text-gray-600">
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Shop:</span> <span className="font-bold text-gray-800">{deleteModalEntry.shop_name}</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Date:</span> <span className="font-medium text-gray-800">{fmtDate(deleteModalEntry.date)}</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Total Sale:</span> <span className="font-bold text-indigo-600">{fmt(deleteModalEntry.total_sale)}</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Status:</span> <span className="font-semibold text-gray-700">{deleteModalEntry.approval_status}</span></div>
                            </div>
                            <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100">
                                Warning: This action will permanently remove this daily entry and all related records (uploaded sheet, approvals, ledgers).
                            </p>
                            {deleteError && (
                                <p className="text-xs text-red-600 font-semibold">{deleteError}</p>
                            )}
                        </div>
                        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button onClick={() => setDeleteModalEntry(null)} disabled={deleteLoading}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDeleteConfirm} disabled={deleteLoading}
                                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50">
                                {deleteLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</> : <><Trash2 className="h-3.5 w-3.5" /> Delete Entry</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cash Transfer Delete Confirmation Modal ────────── */}
            {deleteTxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
                            <div className="flex items-center gap-2 text-red-600">
                                <TriangleAlert className="h-5 w-5" />
                                <h3 className="text-base font-bold text-gray-900">Delete Cash Transfer</h3>
                            </div>
                            <button onClick={() => setDeleteTxModal(null)} disabled={deleteTxLoading}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-sm text-gray-700 font-medium">
                                Are you sure you want to delete this cash transfer?
                            </p>
                            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-xs space-y-1.5 text-gray-600">
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">From:</span> <span className="font-bold text-gray-800">{deleteTxModal.from_name} ({deleteTxModal.from_mobile})</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">To:</span> <span className="font-bold text-indigo-600">{deleteTxModal.to_name} ({deleteTxModal.to_mobile})</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Amount:</span> <span className="font-bold text-emerald-600">{fmt(deleteTxModal.amount)}</span></div>
                                <div className="flex justify-between"><span className="font-semibold text-gray-500">Status:</span> <span className="font-semibold text-gray-700">{deleteTxModal.status}</span></div>
                            </div>
                            <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100">
                                Warning: This will permanently remove the transfer record. If accepted, wallet balances will be automatically restored.
                            </p>
                            {deleteTxError && (
                                <p className="text-xs text-red-600 font-semibold">{deleteTxError}</p>
                            )}
                        </div>
                        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                            <button onClick={() => setDeleteTxModal(null)} disabled={deleteTxLoading}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleDeleteTxConfirm} disabled={deleteTxLoading}
                                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50">
                                {deleteTxLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…</> : <><Trash2 className="h-3.5 w-3.5" /> Delete Transfer</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default EntriesPage;
