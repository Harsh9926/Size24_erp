import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    CheckCircle2, XCircle, Clock, ShieldCheck, ShieldX,
    X, RefreshCw, Store, Calendar, ChevronRight,
    User, AlertCircle, Loader2, Search,
    ThumbsUp, ThumbsDown, Info, WifiOff,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
};
const fmtTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
};
const fmtAmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/**
 * Normalise approval_status to uppercase string.
 * Handles: undefined, null, lowercase ("pending"), uppercase ("PENDING").
 * Returns: 'PENDING' | 'APPROVED' | 'REJECTED'
 */
const normalizeStatus = (raw) => {
    const s = (raw ?? '').toString().toUpperCase().trim();
    if (s === 'APPROVED') return 'APPROVED';
    if (s === 'REJECTED') return 'REJECTED';
    return 'PENDING'; // default / fallback
};

/* ═══════════════════════════════════════════════════════════════════
   MOCK DATA  — used if API fails or returns empty
═══════════════════════════════════════════════════════════════════ */
const MOCK_ENTRIES = [
    {
        id: 1, shop_name: 'KALAYANI – Demo', city_name: 'Demo City',
        date: new Date().toISOString(), created_at: new Date().toISOString(),
        total_sale: 14000, excel_total_sale: 14000,
        cash: 7000, razorpay: 5000, online: 2000,
        approval_status: 'PENDING',
    },
    {
        id: 2, shop_name: 'SIZE24 – Main', city_name: 'Mumbai',
        date: new Date().toISOString(), created_at: new Date().toISOString(),
        total_sale: 8500, excel_total_sale: 8500,
        cash: 4000, razorpay: 2500, online: 2000,
        approval_status: 'APPROVED', approved_at: new Date().toISOString(),
    },
    {
        id: 3, shop_name: 'SIZE24 – West', city_name: 'Pune',
        date: new Date().toISOString(), created_at: new Date().toISOString(),
        total_sale: 6200, excel_total_sale: 6200,
        cash: 3000, razorpay: 2000, online: 1200,
        approval_status: 'REJECTED',
        rejection_note: 'Breakdown mismatch, please re-verify.',
    },
];

/* ═══════════════════════════════════════════════════════════════════
   STATUS BADGE
═══════════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
    PENDING:  { cls: 'bg-amber-100 text-amber-700 border-amber-200',  Icon: Clock,       label: 'Pending'  },
    APPROVED: { cls: 'bg-green-100 text-green-700 border-green-200',  Icon: ShieldCheck, label: 'Approved' },
    REJECTED: { cls: 'bg-red-100   text-red-700   border-red-200',    Icon: ShieldX,     label: 'Rejected' },
};

const StatusBadge = ({ status, size = 'sm' }) => {
    const key = normalizeStatus(status);
    const { cls, Icon, label } = STATUS_CFG[key] ?? STATUS_CFG.PENDING;
    const sz = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';
    return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full border ${sz} ${cls}`}>
            <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
            {label}
        </span>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   DETAIL ROW  (used inside drawer)
═══════════════════════════════════════════════════════════════════ */
const DetailRow = ({ label, value, highlight }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-0"
        style={{ borderColor: 'var(--border-color)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className={`text-sm font-bold ${highlight ?? ''}`}
            style={!highlight ? { color: 'var(--text-primary)' } : {}}>{value}</span>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════
   ENTRY DRAWER  — slide-in side panel
═══════════════════════════════════════════════════════════════════ */
const EntryDrawer = ({ entry, onClose, onApprove, onReject, actionLoading }) => {
    const [rejectNote,    setRejectNote]    = useState('');
    const [showRejectBox, setShowRejectBox] = useState(false);

    // Always reset reject box when entry changes
    useEffect(() => { setRejectNote(''); setShowRejectBox(false); }, [entry?.id]);

    // ── Null-guard: MUST be first conditional after hooks ──────────
    if (!entry) return null;

    const status       = normalizeStatus(entry.approval_status);
    const excelTotal   = parseFloat(entry.excel_total_sale ?? entry.total_sale ?? 0);
    const breakdownSum =
        parseFloat(entry.cash     ?? 0) +
        parseFloat(entry.online   ?? entry.paytm ?? 0) +
        parseFloat(entry.razorpay ?? 0);
    const diff    = (breakdownSum - excelTotal).toFixed(2);
    const isMatch = Math.abs(breakdownSum - excelTotal) <= 0.01;

    const handleRejectClick = () => {
        if (showRejectBox) { onReject(entry.id, rejectNote); }
        else               { setShowRejectBox(true); }
    };

    const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:5000';

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-2xl"
                style={{ background: 'var(--bg-surface)' }}
            >
                {/* ── Header ─────────────────────────────────────── */}
                <div className="px-6 py-5 border-b flex items-center justify-between flex-shrink-0"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div>
                        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            Entry Details
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            #{entry.id} · {fmtDate(entry.created_at)} {fmtTime(entry.created_at)}
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                        style={{ color: 'var(--text-secondary)' }}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Scrollable body ─────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Status row */}
                    <div className="flex items-center justify-between">
                        <StatusBadge status={status} size="lg" />
                        {(status === 'APPROVED' || status === 'REJECTED') && (
                            <span className={`text-xs ${status === 'REJECTED' ? 'text-red-500' : 'text-gray-500'}`}>
                                {entry.approved_by_name ? `by ${entry.approved_by_name}` : ''}
                            </span>
                        )}
                    </div>

                    {/* Shop card */}
                    <div className="rounded-xl border p-4 space-y-1.5"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-bold text-indigo-600">
                                {entry.shop_name ?? '—'}
                            </span>
                        </div>
                        {entry.city_name && (
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                📍 {entry.city_name}
                            </p>
                        )}
                        {entry.submitted_by_name && (
                            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                <User className="h-3 w-3" />
                                {entry.submitted_by_name}
                                {entry.submitted_by_mobile && ` · ${entry.submitted_by_mobile}`}
                            </p>
                        )}
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Calendar className="h-3 w-3" />
                            Entry Date: <strong>{fmtDate(entry.date)}</strong>
                        </p>
                    </div>

                    {/* Financial breakdown */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2"
                            style={{ color: 'var(--text-secondary)' }}>
                            Financial Breakdown
                        </p>
                        <div className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--border-color)' }}>
                            <div className="px-4 py-1">
                                <DetailRow label="Total Sale (Excel)" value={fmtAmt(excelTotal)} highlight="text-teal-700" />
                                <DetailRow label="Cash"              value={fmtAmt(entry.cash)} />
                                <DetailRow label="RazorPay"          value={fmtAmt(entry.razorpay)} />
                                <DetailRow label="QR / Card / Bank"  value={fmtAmt(entry.online ?? entry.paytm ?? 0)} />
                            </div>

                            {/* Validation banner */}
                            <div className={`px-4 py-3 flex items-center justify-between border-t ${
                                isMatch ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    {isMatch
                                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        : <XCircle     className="h-4 w-4 text-red-600"   />
                                    }
                                    <span className={`text-xs font-bold ${isMatch ? 'text-green-700' : 'text-red-700'}`}>
                                        {isMatch ? 'Breakdown matches ✓' : 'Breakdown mismatch!'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sum</p>
                                    <p className={`text-base font-extrabold ${isMatch ? 'text-green-700' : 'text-red-700'}`}>
                                        {fmtAmt(breakdownSum)}
                                    </p>
                                    {!isMatch && (
                                        <p className="text-xs text-red-500 font-semibold">
                                            Diff: {parseFloat(diff) > 0 ? '+' : ''}{fmtAmt(diff)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rejection note (if rejected) */}
                    {status === 'REJECTED' && entry.rejection_note && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Rejection Reason
                            </p>
                            <p className="text-sm text-red-600">{entry.rejection_note}</p>
                        </div>
                    )}

                    {/* Photo proof */}
                    {entry.photo_url && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-2"
                                style={{ color: 'var(--text-secondary)' }}>
                                Photo Proof
                            </p>
                            <a href={`${BACKEND}${entry.photo_url}`} target="_blank" rel="noreferrer">
                                <img
                                    src={`${BACKEND}${entry.photo_url}`}
                                    alt="proof"
                                    className="w-full rounded-xl border object-cover max-h-48 hover:opacity-90 transition-opacity"
                                    style={{ borderColor: 'var(--border-color)' }}
                                />
                            </a>
                        </div>
                    )}

                    {/* Reject text area — shown when reject button first clicked */}
                    {showRejectBox && status === 'PENDING' && (
                        <div>
                            <label className="text-xs font-semibold block mb-1 text-red-600">
                                Rejection Reason (optional)
                            </label>
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                rows={3}
                                placeholder="e.g. Breakdown does not match, please re-verify."
                                className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg outline-none focus:ring-2 focus:ring-red-400 resize-none"
                                style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                            />
                            <button onClick={() => setShowRejectBox(false)}
                                className="mt-1 text-xs text-gray-400 hover:text-gray-600">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────── */}
                {status === 'PENDING' ? (
                    <div className="px-6 py-5 border-t flex gap-3 flex-shrink-0"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>

                        {/* REJECT */}
                        <button
                            id="btn-reject-entry"
                            onClick={handleRejectClick}
                            disabled={actionLoading}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                                showRejectBox
                                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                    : 'bg-transparent border-red-300 text-red-600 hover:bg-red-50'
                            }`}>
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                            {showRejectBox ? 'Confirm Reject' : 'Reject'}
                        </button>

                        {/* APPROVE */}
                        <button
                            id="btn-approve-entry"
                            onClick={() => onApprove(entry.id)}
                            disabled={actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md"
                            style={{ background: actionLoading ? '#9ca3af' : 'linear-gradient(135deg,#059669,#10b981)' }}>
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                            Approve
                        </button>
                    </div>
                ) : (
                    <div className="px-6 py-4 border-t text-center flex-shrink-0"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            This entry has been <strong>{status.charAt(0) + status.slice(1).toLowerCase()}</strong>
                            {entry.approved_at ? ` on ${fmtDate(entry.approved_at)}` : ''}.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};

/* ═══════════════════════════════════════════════════════════════════
   ADMIN APPROVAL PAGE
═══════════════════════════════════════════════════════════════════ */
const TABS = [
    { key: 'PENDING',  label: 'Pending',  color: '#d97706' },
    { key: 'APPROVED', label: 'Approved', color: '#059669' },
    { key: 'REJECTED', label: 'Rejected', color: '#dc2626' },
    { key: 'ALL',      label: 'All',      color: '#4b5563' },
];

const AdminApprovalPage = () => {
    const [entries,       setEntries]       = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [apiError,      setApiError]      = useState(false); // true = using mock data
    const [activeTab,     setActiveTab]     = useState('PENDING');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [search,        setSearch]        = useState('');
    const [toast,         setToast]         = useState(null);

    /* ── Normalise all entries from API ─────────────────────────── */
    const normalizeEntries = (raw) =>
        (Array.isArray(raw) ? raw : []).map((e) => ({
            ...e,
            approval_status: normalizeStatus(e.approval_status),
        }));

    /* ── Fetch ───────────────────────────────────────────────────── */
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        setApiError(false);
        try {
            const res = await api.get('/entries');
            const normalized = normalizeEntries(res.data);
            // If DB doesn't have approval_status yet (migration not run),
            // all entries will be PENDING — no crash occurs.
            setEntries(normalized.length > 0 ? normalized : normalizeEntries(MOCK_ENTRIES));
            if (normalized.length === 0) setApiError(true); // show mock banner
        } catch (err) {
            console.error('[AdminApprovalPage] fetchEntries error:', err);
            setApiError(true);
            setEntries(normalizeEntries(MOCK_ENTRIES));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    /* ── Auto-dismiss toast ──────────────────────────────────────── */
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    /* ── Approve ─────────────────────────────────────────────────── */
    const handleApprove = async (id) => {
        setActionLoading(true);
        try {
            await api.post(`/entries/${id}/approve`);
            setToast({ msg: '✅ Entry approved and added to final records.', type: 'success' });
            setSelectedEntry(null);
            fetchEntries();
        } catch (e) {
            setToast({ msg: e?.response?.data?.error ?? 'Approval failed.', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    /* ── Reject ──────────────────────────────────────────────────── */
    const handleReject = async (id, note) => {
        setActionLoading(true);
        try {
            await api.post(`/entries/${id}/reject`, { rejection_note: note ?? '' });
            setToast({ msg: '🚫 Entry rejected.', type: 'error' });
            setSelectedEntry(null);
            fetchEntries();
        } catch (e) {
            setToast({ msg: e?.response?.data?.error ?? 'Rejection failed.', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    /* ── Filtered list ───────────────────────────────────────────── */
    const filtered = useMemo(() => {
        let list = entries;

        // Tab filter — ALL means no status filter
        if (activeTab !== 'ALL') {
            list = list.filter((e) => normalizeStatus(e.approval_status) === activeTab);
        }

        // Search filter
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((e) =>
                (e.shop_name  ?? '').toLowerCase().includes(q) ||
                (e.city_name  ?? '').toLowerCase().includes(q) ||
                String(e.total_sale ?? '').includes(q),
            );
        }

        return list;
    }, [entries, activeTab, search]);

    const countFor = (key) =>
        key === 'ALL' ? entries.length
            : entries.filter((e) => normalizeStatus(e.approval_status) === key).length;

    const pendingCount = countFor('PENDING');

    /* ──────────────────────────────────────────────────────────────── */
    return (
        <Layout title="Entry Approvals">
            <div className="space-y-5">

                {/* ── Page header ────────────────────────────────── */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-xl font-extrabold flex items-center gap-2"
                            style={{ color: 'var(--text-primary)' }}>
                            <ShieldCheck className="h-6 w-6 text-teal-600" />
                            Entry Approvals
                            {pendingCount > 0 && (
                                <span className="ml-1 inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-extrabold">
                                    {pendingCount}
                                </span>
                            )}
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Review and approve shop daily entries before they appear in final records.
                        </p>
                    </div>
                    <button onClick={fetchEntries} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                        style={{ background: 'linear-gradient(90deg,#1e1e2f,#374151)' }}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* ── Mock/error banner ───────────────────────────── */}
                {apiError && (
                    <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        <WifiOff className="h-4 w-4 flex-shrink-0" />
                        <span>
                            <strong>Demo Mode:</strong> Could not reach the API (possibly DB migration not run yet).
                            Showing sample data. Run <code className="bg-amber-100 px-1 rounded">migrate_approval_workflow.sql</code> and restart the backend.
                        </span>
                    </div>
                )}

                {/* ── Toast notification ─────────────────────────── */}
                {toast && (
                    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border text-sm font-medium ${
                        toast.type === 'success'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {toast.type === 'success'
                            ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                            : <XCircle      className="h-5 w-5 text-red-600   flex-shrink-0" />
                        }
                        <span className="flex-1">{toast.msg}</span>
                        <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* ── Tabs + Search ───────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Status tabs */}
                    <div className="flex items-center gap-1 p-1 rounded-xl border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        {TABS.map(({ key, label, color }) => {
                            const count    = countFor(key);
                            const isActive = activeTab === key;
                            return (
                                <button key={key} onClick={() => setActiveTab(key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                    style={isActive ? { background: color } : {}}>
                                    {label}
                                    {count > 0 && (
                                        <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-extrabold ${
                                            isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 min-w-44 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text" value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search shop, city, amount…"
                            className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl outline-none focus:ring-2 focus:ring-teal-400"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                {/* ── Hint when pending entries exist ─────────────── */}
                {activeTab === 'PENDING' && pendingCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        <Info className="h-4 w-4 flex-shrink-0" />
                        Click any row to open entry details and Approve or Reject it.
                    </div>
                )}

                {/* ── Main table ──────────────────────────────────── */}
                <div className="rounded-xl border overflow-hidden shadow-sm"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        {[
                                            'Date', 'Shop', 'Total Sale', 'Cash',
                                            'RazorPay', 'QR/Card/Bank', 'Breakdown', 'Match',
                                            'Submitted', 'Status', '',
                                        ].map((h) => (
                                            <th key={h}
                                                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                                                style={{ color: 'var(--text-secondary)' }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((entry) => {
                                        const status       = normalizeStatus(entry.approval_status);
                                        const excelTotal   = parseFloat(entry.excel_total_sale ?? entry.total_sale ?? 0);
                                        const breakdownSum =
                                            parseFloat(entry.cash     ?? 0) +
                                            parseFloat(entry.online   ?? entry.paytm ?? 0) +
                                            parseFloat(entry.razorpay ?? 0);
                                        const isMatch = Math.abs(breakdownSum - excelTotal) <= 0.01;

                                        return (
                                            <tr key={entry.id ?? Math.random()}
                                                onClick={() => setSelectedEntry({ ...entry, approval_status: status })}
                                                className="cursor-pointer hover:opacity-90 transition-all group"
                                                style={{ borderTop: '1px solid var(--border-color)' }}>

                                                <td className="px-4 py-3.5 font-medium whitespace-nowrap"
                                                    style={{ color: 'var(--text-primary)' }}>
                                                    {fmtDate(entry.date)}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <p className="font-semibold text-indigo-600 whitespace-nowrap">
                                                        {entry.shop_name ?? '—'}
                                                    </p>
                                                    {entry.city_name && (
                                                        <p className="text-xs text-gray-400">{entry.city_name}</p>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3.5 font-bold text-teal-700 whitespace-nowrap">
                                                    {fmtAmt(excelTotal)}
                                                </td>

                                                <td className="px-4 py-3.5 whitespace-nowrap"
                                                    style={{ color: 'var(--text-secondary)' }}>
                                                    {fmtAmt(entry.cash)}
                                                </td>

                                                <td className="px-4 py-3.5 whitespace-nowrap"
                                                    style={{ color: 'var(--text-secondary)' }}>
                                                    {fmtAmt(entry.razorpay)}
                                                </td>

                                                <td className="px-4 py-3.5 whitespace-nowrap"
                                                    style={{ color: 'var(--text-secondary)' }}>
                                                    {fmtAmt(entry.online ?? entry.paytm ?? 0)}
                                                </td>

                                                <td className={`px-4 py-3.5 font-bold whitespace-nowrap ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                                    {fmtAmt(breakdownSum)}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    {isMatch
                                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                                                            <CheckCircle2 className="h-3 w-3" />✓
                                                          </span>
                                                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
                                                            <XCircle className="h-3 w-3" />✗
                                                          </span>
                                                    }
                                                </td>

                                                <td className="px-4 py-3.5 whitespace-nowrap text-xs"
                                                    style={{ color: 'var(--text-secondary)' }}>
                                                    {fmtDate(entry.created_at)}<br />
                                                    <span className="text-[10px]">{fmtTime(entry.created_at)}</span>
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <StatusBadge status={status} />
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filtered.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="11" className="text-center py-16 text-gray-400">
                                                {activeTab === 'PENDING'
                                                    ? '🎉 No pending entries — all caught up!'
                                                    : `No ${activeTab.toLowerCase()} entries found.`}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Summary footer ──────────────────────────────── */}
                {!loading && entries.length > 0 && (
                    <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>Total: <strong>{entries.length}</strong></span>
                        <span className="text-amber-600 font-semibold">Pending: {countFor('PENDING')}</span>
                        <span className="text-green-600 font-semibold">Approved: {countFor('APPROVED')}</span>
                        <span className="text-red-600   font-semibold">Rejected: {countFor('REJECTED')}</span>
                    </div>
                )}
            </div>

            {/* ── Side drawer (portal-like) ────────────────────────── */}
            {selectedEntry != null && (
                <EntryDrawer
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    actionLoading={actionLoading}
                />
            )}
        </Layout>
    );
};

export default AdminApprovalPage;
