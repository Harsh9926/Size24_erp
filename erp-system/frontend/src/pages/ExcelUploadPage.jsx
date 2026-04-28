import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileSpreadsheet, CheckCircle2, XCircle,
    TrendingUp, Calendar, RefreshCw, History, Eye,
    ChevronDown, ChevronUp, AlertCircle, Loader2,
    UserCheck, Clock, ShieldAlert,
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmt     = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/* ── Already-Submitted Modal ─────────────────────────────────────── */
const AlreadySubmittedModal = ({ data, onClose, onForce, isAdmin, forceLoading }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
        <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.92, y: 16  }}
            className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                <div className="p-2 rounded-xl bg-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    Report Already Submitted
                </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Today's report has already been submitted by{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{data.submitted_by}</strong>.
                </p>

                {data.submitted_at && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: 'var(--bg-primary)' }}>
                        <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Submitted at <strong style={{ color: 'var(--text-primary)' }}>{fmtTime(data.submitted_at)}</strong>
                            {' '}on {fmtDate(data.submitted_at)}
                        </p>
                    </div>
                )}

                {isAdmin && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                        <ShieldAlert className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-orange-700">
                            As admin, you can override this and force a new upload for today.
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
                <button onClick={onClose}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    OK
                </button>
                {isAdmin && (
                    <button onClick={onForce} disabled={forceLoading}
                        className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all"
                        style={{ background: forceLoading ? '#9ca3af' : '#FF6B00' }}>
                        {forceLoading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <ShieldAlert className="h-4 w-4" />}
                        {forceLoading ? 'Uploading…' : 'Upload Anyway'}
                    </button>
                )}
            </div>
        </motion.div>
    </div>
);

/* ── Already-Submitted Banner (inline, on page load) ─────────────── */
const AlreadySubmittedBanner = ({ data, isAdmin, onOverride }) => (
    <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
        <UserCheck className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
                Today's report already submitted
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
                Submitted by <strong>{data.submitted_by}</strong> at <strong>{fmtTime(data.submitted_at)}</strong>
                {data.total_sale > 0 && ` · Total Sale: ${fmt(data.total_sale)}`}
            </p>
        </div>
        {isAdmin && (
            <button onClick={onOverride}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all"
                style={{ background: '#FF6B00' }}>
                Override
            </button>
        )}
    </motion.div>
);

/* ── Drop-zone component ─────────────────────────────────────────── */
const DropZone = ({ onFile, loading, disabled, disabledReason }) => {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        if (disabled || loading) return;
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
    }, [onFile, disabled, loading]);

    const handleChange = (e) => {
        const file = e.target.files[0];
        if (file) onFile(file);
        e.target.value = '';
    };

    if (disabled) {
        return (
            <div className="relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-12 select-none"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', opacity: 0.6 }}>
                <div className="p-5 rounded-2xl bg-gray-100">
                    <FileSpreadsheet className="h-12 w-12 text-gray-400" />
                </div>
                <div className="text-center">
                    <p className="text-base font-bold text-gray-500">Upload Unavailable</p>
                    <p className="text-sm mt-1 text-gray-400">
                        {disabledReason || "Today's report has already been submitted."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current.click()}
            animate={{ borderColor: dragging ? '#FF6B00' : '#e5e7eb', scale: dragging ? 1.01 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-12 cursor-pointer select-none transition-colors"
            style={{
                background:   dragging ? 'rgba(255,107,0,0.05)' : 'var(--bg-surface)',
                borderColor:  dragging ? '#FF6B00' : 'var(--border-color)',
            }}>
            <input ref={inputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleChange} />

            {loading ? (
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#FF6B00' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Processing your file…</p>
                </div>
            ) : (
                <>
                    <motion.div
                        className="p-5 rounded-2xl"
                        style={{ background: dragging ? 'rgba(255,107,0,0.15)' : 'rgba(255,107,0,0.08)' }}
                        animate={{ rotate: dragging ? 5 : 0 }}>
                        <FileSpreadsheet className="h-12 w-12" style={{ color: '#FF6B00' }} />
                    </motion.div>
                    <div className="text-center">
                        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                            {dragging ? 'Drop it here!' : 'Drag & drop your Excel file'}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            or <span className="font-semibold underline" style={{ color: '#FF6B00' }}>browse</span> to choose
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>.xls &amp; .xlsx — max 10 MB</p>
                    </div>
                </>
            )}
        </motion.div>
    );
};

/* ── Preview table ───────────────────────────────────────────────── */
const PreviewTable = ({ rows }) => {
    const [expanded, setExpanded] = useState(false);
    if (!rows || rows.length === 0) return null;

    const headers = Object.keys(rows[0]);
    const visible = expanded ? rows : rows.slice(0, 10);

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" style={{ color: '#FF6B00' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Data Preview <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>({rows.length} rows total)</span>
                    </span>
                </div>
                <button onClick={() => setExpanded(v => !v)}
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    style={{ color: '#FF6B00', background: 'rgba(255,107,0,0.08)' }}>
                    {expanded ? <><ChevronUp className="h-3.5 w-3.5" />Less</> : <><ChevronDown className="h-3.5 w-3.5" />All {rows.length}</>}
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr style={{ background: 'var(--bg-primary)' }}>
                            {headers.map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                                    style={{
                                        color:      h.trim().toLowerCase() === 'received amount' ? '#FF6B00' : 'var(--text-secondary)',
                                        background: h.trim().toLowerCase() === 'received amount' ? 'rgba(255,107,0,0.06)' : undefined,
                                    }}>
                                    {h.trim().toLowerCase() === 'received amount' ? '★ ' : ''}{h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}
                                className="hover:opacity-80 transition-opacity">
                                {headers.map(h => (
                                    <td key={h} className="px-4 py-2.5 whitespace-nowrap"
                                        style={{
                                            color:      h.trim().toLowerCase() === 'received amount' ? '#10b981' : 'var(--text-primary)',
                                            fontWeight: h.trim().toLowerCase() === 'received amount' ? 600 : 400,
                                        }}>
                                        {row[h] instanceof Date
                                            ? row[h].toLocaleDateString('en-IN')
                                            : String(row[h] ?? '—')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};

/* ── History row ─────────────────────────────────────────────────── */
const HistoryRow = ({ item }) => (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ borderTop: '1px solid var(--border-color)' }}
        className="hover:opacity-80 transition-opacity">
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 flex-shrink-0" style={{ color: '#FF6B00' }} />
                <span className="max-w-[200px] truncate" title={item.filename}>{item.filename}</span>
            </div>
        </td>
        <td className="px-4 py-3 text-sm font-bold" style={{ color: '#10b981' }}>{fmt(item.total_sale)}</td>
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDate(item.upload_date)}</td>
        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.uploaded_by || '—'}</td>
        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(item.created_at)}</td>
    </motion.tr>
);

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
const ExcelUploadPage = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin';

    const [loading,          setLoading]          = useState(false);
    const [result,           setResult]           = useState(null);
    const [error,            setError]            = useState('');
    const [history,          setHistory]          = useState([]);
    const [histLoading,      setHistLoading]      = useState(true);
    const [selectedFile,     setSelectedFile]     = useState(null);

    /* Already-submitted state (null = still checking, false = clear, object = submitted) */
    const [submittedInfo,    setSubmittedInfo]    = useState(null);
    const [checkingToday,    setCheckingToday]    = useState(true);
    const [overrideMode,     setOverrideMode]     = useState(false); // admin pressed Override

    /* Duplicate-upload modal (shown when API returns 409 mid-upload) */
    const [dupModal,         setDupModal]         = useState(null);
    const [pendingFile,      setPendingFile]      = useState(null); // file waiting for force upload
    const [forceLoading,     setForceLoading]     = useState(false);

    /* ── Check if today's upload already exists ─────────────────── */
    const checkToday = useCallback(async () => {
        setCheckingToday(true);
        try {
            const params = user?.shopId ? `?shop_id=${user.shopId}` : '';
            const res = await api.get(`/excel/check-today${params}`);
            setSubmittedInfo(res.data.already_submitted ? res.data : false);
        } catch {
            setSubmittedInfo(false);
        } finally {
            setCheckingToday(false);
        }
    }, [user?.shopId]);

    const fetchHistory = async () => {
        setHistLoading(true);
        try {
            const r = await api.get('/excel/history?limit=20');
            setHistory(r.data);
        } catch { /* ignore */ }
        finally { setHistLoading(false); }
    };

    useEffect(() => {
        checkToday();
        fetchHistory();
    }, [checkToday]);

    /* ── Core upload function ────────────────────────────────────── */
    const doUpload = useCallback(async (file, force = false) => {
        setError('');
        setResult(null);
        setLoading(true);

        try {
            const fd = new FormData();
            fd.append('excel', file);
            if (user?.shopId) fd.append('shop_id', user.shopId);
            if (force) fd.append('force', 'true');

            const res = await api.post('/excel/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setResult(res.data);
            // Mark as submitted so the banner shows up even without a page refresh
            setSubmittedInfo({
                already_submitted: true,
                submitted_by:      user?.name || 'You',
                submitted_at:      new Date().toISOString(),
                total_sale:        res.data.totalSale,
            });
            setOverrideMode(false);
            fetchHistory();
        } catch (e) {
            if (e.response?.status === 409) {
                // Another user already submitted today → show the modal
                setDupModal(e.response.data);
                setPendingFile(file);
            } else {
                setError(e.response?.data?.error || 'Upload failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [user?.shopId, user?.name]);

    const handleFile = (file) => {
        setSelectedFile(file);
        doUpload(file, false);
    };

    /* ── Admin: force re-upload from modal ───────────────────────── */
    const handleForceUpload = async () => {
        if (!pendingFile) return;
        setForceLoading(true);
        setDupModal(null);
        await doUpload(pendingFile, true);
        setPendingFile(null);
        setForceLoading(false);
    };

    /* ── Admin: override banner → enter override mode ───────────── */
    const handleOverride = () => setOverrideMode(true);

    const handleReupload = () => {
        setResult(null);
        setError('');
        setSelectedFile(null);
    };

    /* ── Determine if DropZone should be disabled ────────────────── */
    const dropZoneDisabled =
        !isAdmin &&               // non-admin
        !overrideMode &&          // not in override mode
        !!submittedInfo;          // and today is already submitted

    return (
        <Layout title="Excel Upload — Total Sale">
            {/* Already-submitted modal (triggered by mid-upload 409) */}
            <AnimatePresence>
                {dupModal && (
                    <AlreadySubmittedModal
                        data={dupModal}
                        isAdmin={isAdmin}
                        forceLoading={forceLoading}
                        onClose={() => { setDupModal(null); setPendingFile(null); }}
                        onForce={handleForceUpload}
                    />
                )}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                            📊 Excel Sales Upload
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Upload an Excel file to extract Total Sale from "Received Amount" column
                        </p>
                    </div>
                    {result && (
                        <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            onClick={handleReupload}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                            style={{ background: 'linear-gradient(90deg,#FF6B00,#ff9040)', boxShadow: '0 3px 12px rgba(255,107,0,0.35)' }}>
                            <RefreshCw className="h-4 w-4" /> Upload Again
                        </motion.button>
                    )}
                </div>

                {/* Already-submitted banner — shown while checking or when confirmed */}
                {checkingToday ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <span className="text-sm text-gray-400">Checking today's submission status…</span>
                    </div>
                ) : submittedInfo && !overrideMode ? (
                    <AlreadySubmittedBanner
                        data={submittedInfo}
                        isAdmin={isAdmin}
                        onOverride={handleOverride}
                    />
                ) : overrideMode ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-200 bg-orange-50">
                        <ShieldAlert className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-orange-800">Admin Override Active</p>
                            <p className="text-xs text-orange-600 mt-0.5">
                                You are about to re-upload today's report. The existing record will be kept and a new one added.
                            </p>
                        </div>
                        <button onClick={() => setOverrideMode(false)}
                            className="text-xs text-orange-600 hover:underline font-medium">
                            Cancel
                        </button>
                    </motion.div>
                ) : null}

                {/* Upload / Result area */}
                <AnimatePresence mode="wait">
                    {!result ? (
                        <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <DropZone
                                onFile={handleFile}
                                loading={loading}
                                disabled={dropZoneDisabled}
                                disabledReason={
                                    submittedInfo
                                        ? `Today's report was already submitted by ${submittedInfo.submitted_by}.`
                                        : undefined
                                }
                            />

                            {/* Error message */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div key="err"
                                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="mt-4 flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
                                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-700">Upload Error</p>
                                            <p className="text-sm text-red-600 mt-0.5">{error}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">

                            {/* Success banner */}
                            <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-800">File processed successfully!</p>
                                    <p className="text-xs text-green-600 mt-0.5">
                                        {result.filename} · {result.rowCount} rows parsed
                                    </p>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
                                    className="rounded-2xl p-6 border shadow-sm"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)' }}>
                                            <TrendingUp className="h-6 w-6 text-emerald-500" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                            Total Sale
                                        </span>
                                    </div>
                                    <p className="text-3xl font-extrabold" style={{ color: '#10b981' }}>
                                        {fmt(result.totalSale)}
                                    </p>
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        Sum of "Received Amount" column
                                    </p>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                                    className="rounded-2xl p-6 border shadow-sm"
                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,107,0,0.1)' }}>
                                            <Calendar className="h-6 w-6" style={{ color: '#FF6B00' }} />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                            Date
                                        </span>
                                    </div>
                                    <p className="text-3xl font-extrabold" style={{ color: '#FF6B00' }}>
                                        {fmtDate(result.uploadDate)}
                                    </p>
                                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        From Date column / filename / today
                                    </p>
                                </motion.div>
                            </div>

                            {/* Data Preview */}
                            <PreviewTable rows={result.preview} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Upload History */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="px-5 py-4 border-b flex items-center justify-between"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4" style={{ color: '#FF6B00' }} />
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upload History</span>
                        </div>
                        <button onClick={fetchHistory}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: '#FF6B00', background: 'rgba(255,107,0,0.08)' }}>
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </button>
                    </div>

                    {histLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#FF6B00' }} />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <AlertCircle className="h-8 w-8 text-gray-400" />
                            <p className="text-sm text-gray-400">No uploads yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr style={{ background: 'var(--bg-primary)' }}>
                                        {['File Name', 'Total Sale', 'Date', 'Uploaded By', 'Uploaded At'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(item => <HistoryRow key={item.id} item={item} />)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default ExcelUploadPage;
