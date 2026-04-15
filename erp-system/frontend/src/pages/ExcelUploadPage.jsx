import React, { useState, useRef, useCallback, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileSpreadsheet, CheckCircle2, XCircle,
    TrendingUp, Calendar, RefreshCw, History, Eye,
    ChevronDown, ChevronUp, AlertCircle, Loader2
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout';
import { AuthContext } from '../context/AuthContext';

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ── Drop-zone component ─────────────────────────────────────────── */
const DropZone = ({ onFile, loading }) => {
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef();

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
    }, [onFile]);

    const handleChange = (e) => {
        const file = e.target.files[0];
        if (file) onFile(file);
        e.target.value = '';
    };

    return (
        <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current.click()}
            animate={{ borderColor: dragging ? '#FF6B00' : '#e5e7eb', scale: dragging ? 1.01 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-12 cursor-pointer select-none transition-colors"
            style={{
                background: dragging
                    ? 'rgba(255,107,0,0.05)'
                    : 'var(--bg-surface)',
                borderColor: dragging ? '#FF6B00' : 'var(--border-color)',
            }}
        >
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
                        animate={{ rotate: dragging ? 5 : 0 }}
                    >
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
                                        color: h.trim().toLowerCase() === 'received amount' ? '#FF6B00' : 'var(--text-secondary)',
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
                                            color: h.trim().toLowerCase() === 'received amount'
                                                ? '#10b981' : 'var(--text-primary)',
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
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // last upload result
    const [error, setError] = useState('');
    const [history, setHistory] = useState([]);
    const [histLoading, setHistLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchHistory = async () => {
        setHistLoading(true);
        try {
            const r = await api.get('/excel/history?limit=20');
            setHistory(r.data);
        } catch { /* ignore */ }
        finally { setHistLoading(false); }
    };

    useEffect(() => { fetchHistory(); }, []);

    const handleFile = async (file) => {
        setSelectedFile(file);
        setError('');
        setResult(null);
        setLoading(true);

        try {
            const fd = new FormData();
            fd.append('excel', file);
            if (user?.shopId) fd.append('shop_id', user.shopId);

            const res = await api.post('/excel/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setResult(res.data);
            fetchHistory(); // refresh history
        } catch (e) {
            setError(e.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleReupload = () => {
        setResult(null);
        setError('');
        setSelectedFile(null);
    };

    return (
        <Layout title="Excel Upload — Total Sale">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
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

                {/* Upload / Result area */}
                <AnimatePresence mode="wait">
                    {!result ? (
                        <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                            <DropZone onFile={handleFile} loading={loading} />

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
                                {/* Total Sale */}
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

                                {/* Date */}
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
