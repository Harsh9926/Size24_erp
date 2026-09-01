import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import Layout from '../components/Layout';
import { useSearchParams } from 'react-router-dom';
import {
    CheckCircle2, XCircle, IndianRupee, Store, Calendar,
    PlusCircle, AlertCircle, FileSpreadsheet, Camera, Loader2,
    Info, Send, X, Calculator, Image as ImageIcon, RefreshCw,
} from 'lucide-react';

/* ── Excel parser (no date restriction for admin) ─────────────────── */
const normalKey = (k) => String(k).trim().replace(/\s+/g, ' ').toLowerCase();

const parseCurrency = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/₹/g, '').replace(/,/g, '').trim());
    return isNaN(n) ? null : n;
};

const isSummaryRow = (row) =>
    Object.values(row).some((v) => {
        if (typeof v !== 'string') return false;
        const t = v.trim().toLowerCase();
        return t === 'total' || t === 'grand total' || t === 'total:' || t === 'totals';
    });

function parseExcelForAdmin(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

                const headerIdx = rawRows.findIndex(
                    (row) => Array.isArray(row) &&
                        row.some((c) => typeof c === 'string' && normalKey(c) === 'received amount'),
                );
                if (headerIdx === -1) {
                    reject(new Error("'Received Amount' column not found. Ensure the header is exactly \"Received Amount\"."));
                    return;
                }

                const rows = XLSX.utils.sheet_to_json(ws, { range: headerIdx, defval: null });
                const raKey = Object.keys(rows[0] ?? {}).find((k) => normalKey(k) === 'received amount');
                if (!raKey) { reject(new Error("'Received Amount' key could not be resolved.")); return; }

                const dateKey    = Object.keys(rows[0] ?? {}).find((k) => normalKey(k) === 'date');
                const expCatKey  = Object.keys(rows[0] ?? {}).find((k) => normalKey(k) === 'expense category');
                const parseDate = (v) => {
                    if (!v) return null;
                    if (v instanceof Date) return v.toISOString().split('T')[0];
                    if (typeof v === 'number' && v > 40000) {
                        const d = new Date((v - 25569) * 86400 * 1000);
                        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                    }
                    const s = String(v).trim();
                    const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
                    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                };

                let totalSale = 0;
                let excelDate = null;
                const previewRows = [];

                for (const row of rows) {
                    if (isSummaryRow(row)) continue;
                    // Skip OFFICE EXP rows
                    if (expCatKey && String(row[expCatKey] ?? '').trim().toUpperCase() === 'OFFICE EXP') continue;
                    const rawVal = row[raKey];
                    if (rawVal == null || rawVal === '') continue;
                    const amt = parseCurrency(rawVal);
                    if (amt === null) continue;
                    if (dateKey && !excelDate) excelDate = parseDate(row[dateKey]);
                    totalSale += amt;
                    previewRows.push({ date: excelDate, receivedAmount: amt });
                }

                if (previewRows.length === 0) {
                    reject(new Error("No valid rows found in 'Received Amount' column."));
                    return;
                }

                resolve({ date: excelDate, totalSale, previewRows });
            } catch (err) {
                reject(new Error('Failed to parse Excel: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
    });
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const getTodayISO = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

const fmtAmt = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const EMPTY = { shop_id: '', date: getTodayISO(), excel_total_sale: '', cash: '', online: '', razorpay: '', cheque: '', payment_in: '', payment_in_admin_id: '' };

/* ══════════════════════════════════════════════════════════════════
   CAMERA CAPTURE MODAL — live preview → capture → retake / use photo
══════════════════════════════════════════════════════════════════ */
const CameraProofModal = ({ onClose, onUse }) => {
    const videoRef  = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [active, setActive]     = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError]       = useState('');
    const [preview, setPreview]   = useState('');   // object URL after capture
    const [blob, setBlob]         = useState(null); // captured blob

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    const start = useCallback(async () => {
        setError(''); setStarting(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } }, audio: false,
            });
            streamRef.current = stream;
            setActive(true);
        } catch {
            stopStream();
            setError('Camera access denied or unavailable. Please allow camera permission, or use "Upload Image" instead.');
        } finally { setStarting(false); }
    }, [stopStream]);

    // Auto-start the camera when the modal opens.
    useEffect(() => { start(); return () => stopStream(); }, [start, stopStream]);

    // Bind the stream only AFTER <video> is mounted (avoids black screen).
    useEffect(() => {
        if (!active || !streamRef.current) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = streamRef.current;
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
    }, [active]);

    const snap = () => {
        const video = videoRef.current, canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth  || 720;
        canvas.height = video.videoHeight || 960;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
            if (!b) return;
            setBlob(b);
            setPreview(URL.createObjectURL(b));
            stopStream(); setActive(false);
        }, 'image/jpeg', 0.9);
    };

    const retake = () => { setPreview(''); setBlob(null); start(); };

    const use = () => {
        if (!blob) return;
        const file = new File([blob], `proof-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopStream();
        onUse(file);
    };

    const close = () => { stopStream(); onClose(); };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-orange-500" />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Capture Photo Proof</h3>
                    </div>
                    <button onClick={close} className="p-1.5 rounded-lg hover:bg-gray-200/50" aria-label="Close">
                        <X className="h-5 w-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-5">
                    <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
                        {preview ? (
                            <img src={preview} alt="captured proof" className="w-full h-full object-cover" />
                        ) : active ? (
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                                {starting ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-10 w-10" />}
                                <span className="text-xs">{starting ? 'Starting camera…' : 'Camera preview'}</span>
                            </div>
                        )}
                        {preview && (
                            <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Captured
                            </span>
                        )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />

                    {error && (
                        <p className="mt-3 text-[11px] text-amber-700 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
                        </p>
                    )}

                    <div className="mt-4 flex items-center justify-center gap-2.5">
                        {active && !preview && (
                            <button type="button" onClick={snap}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all"
                                style={{ background: 'linear-gradient(90deg,#FF6B00,#ff8c33)' }}>
                                <Camera className="h-4 w-4" /> Capture Photo
                            </button>
                        )}
                        {!active && !preview && !starting && (
                            <button type="button" onClick={start}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
                                style={{ background: '#FF6B00' }}>
                                <RefreshCw className="h-4 w-4" /> Retry Camera
                            </button>
                        )}
                        {preview && (
                            <>
                                <button type="button" onClick={retake}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition-colors">
                                    <RefreshCw className="h-4 w-4" /> Retake
                                </button>
                                <button type="button" onClick={use}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all"
                                    style={{ background: 'linear-gradient(90deg,#059669,#10b981)' }}>
                                    <CheckCircle2 className="h-4 w-4" /> Use Photo
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   ADMIN ENTRY PAGE
══════════════════════════════════════════════════════════════════ */
const AdminEntryPage = () => {
    const [searchParams] = useSearchParams();

    const [shops,      setShops]      = useState([]);
    const [form,       setForm]       = useState(() => ({ ...EMPTY, shop_id: searchParams.get('shop_id') || '' }));
    const [submitting, setSubmitting] = useState(false);
    const [success,    setSuccess]    = useState(null);
    const [error,      setError]      = useState(null);
    const [allowMismatch, setAllowMismatch] = useState(false);

    // Excel
    const xlRef = useRef(null);
    const [xlLoading,    setXlLoading]   = useState(false);
    const [xlError,      setXlError]     = useState('');
    const [showPreview,  setShowPreview] = useState(false);
    const [previewData,  setPreviewData] = useState({ date: null, totalSale: 0, previewRows: [] });
    const [pendingXlFile, setPendingXlFile] = useState(null);

    // Payment In
    const [piAdmins, setPiAdmins] = useState([]);

    // Photo Proof (mandatory · private S3) — camera capture OR device upload
    const fileRef    = useRef(null);
    const [photoFile,    setPhotoFile]    = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [proofKey,       setProofKey]       = useState('');
    const [proofUploading, setProofUploading] = useState(false);
    const [proofError,     setProofError]     = useState('');
    const [proofSource,    setProofSource]    = useState('');   // 'camera' | 'upload'
    const [showCamera,     setShowCamera]     = useState(false);

    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
    }, []);

    // Sync shop_id when navigating from Shops page
    useEffect(() => {
        const sid = searchParams.get('shop_id');
        if (sid) setForm(prev => ({ ...prev, shop_id: sid }));
    }, [searchParams]);

    const set = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        setError(null); setSuccess(null);
    };

    const total      = parseFloat(form.excel_total_sale || 0);
    // Payment In is a non-sales fund deposit — excluded from the breakdown that
    // must reconcile against Total Sale (matches backend entryController.js).
    const breakdown  = parseFloat(form.cash || 0) + parseFloat(form.online || 0) + parseFloat(form.razorpay || 0) + parseFloat(form.cheque || 0);
    const diff       = breakdown - total;
    const mismatch   = form.excel_total_sale !== '' && Math.abs(diff) > 0.01;
    const canSubmit  = form.shop_id && form.date && form.excel_total_sale !== '' && !submitting && (!mismatch || allowMismatch) && !!proofKey && !proofUploading;

    /* ── Photo Proof ────────────────────────────────────────────── */
    // Shared upload flow — used by BOTH camera capture and device upload.
    // Uploads to private S3 and stores the returned object key (unchanged API).
    const uploadProof = async (f, source) => {
        if (!f) return;
        setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); setProofSource(source);
        setProofKey(''); setProofError(''); setProofUploading(true);
        try {
            const fd = new FormData(); fd.append('photo', f);
            const res = await api.post('/upload/photo-proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (!res.data?.key) throw new Error('No key returned');
            setProofKey(res.data.key);
        } catch (err) {
            setProofKey('');
            setProofError(err.response?.data?.error || 'Photo upload failed. Please retry.');
        } finally {
            setProofUploading(false);
        }
    };

    // 🖼 Upload Image — device gallery / file picker
    const handlePhotoChange = (e) => {
        const f = e.target.files[0];
        if (f) uploadProof(f, 'upload');
        if (fileRef.current) fileRef.current.value = '';
    };

    // 📷 Camera — receive the captured File, upload, close modal
    const handleCameraUse = (file) => {
        setShowCamera(false);
        uploadProof(file, 'camera');
    };

    const clearProof = () => {
        setPhotoFile(null); setPhotoPreview(''); setProofKey(''); setProofError(''); setProofSource('');
    };

    /* ── Excel ──────────────────────────────────────────────────── */
    const fetchPiAdmins = async () => {
        if (piAdmins.length > 0) return;
        try {
            const res = await api.get('/payment-in/admins');
            setPiAdmins(Array.isArray(res.data) ? res.data : []);
        } catch {}
    };

    const handleExcelFile = async (file) => {
        if (!file) return;
        setXlLoading(true); setXlError('');
        try {
            const result = await parseExcelForAdmin(file);
            setPreviewData(result);
            setPendingXlFile(file);
            setShowPreview(true);
        } catch (err) {
            setXlError(err.message);
        } finally {
            setXlLoading(false);
            if (xlRef.current) xlRef.current.value = '';
        }
    };

    const confirmExcel = () => {
        const { date, totalSale } = previewData;
        setShowPreview(false);
        setAllowMismatch(false);
        setForm(prev => ({
            ...prev,
            ...(date ? { date } : {}),
            excel_total_sale: String(totalSale.toFixed(2)),
            cash: '', online: '', razorpay: '', cheque: '',
        }));
    };

    /* ── Submit ─────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        if (!proofKey) { setProofError('Photo Proof is required to submit this entry.'); return; }
        setSubmitting(true); setError(null); setSuccess(null);
        try {
            const piAmt = parseFloat(form.payment_in || 0);
            if (piAmt > 0 && !form.payment_in_admin_id) {
                setError('Select an Admin Bank Account for Payment In.');
                setSubmitting(false);
                return;
            }
            const payload = {
                shop_id:             parseInt(form.shop_id),
                date:                form.date,
                excel_total_sale:    parseFloat(form.excel_total_sale),
                cash:                parseFloat(form.cash     || 0),
                online:              parseFloat(form.online   || 0),
                razorpay:            parseFloat(form.razorpay || 0),
                cheque:              parseFloat(form.cheque   || 0),
                payment_in:          piAmt,
                payment_in_admin_id: form.payment_in_admin_id || null,
                photo_url:           null,
                photo_proof_key:     proofKey,
            };
            await api.post('/entries', payload);

            // Save Excel to DB so it appears in entries view
            if (pendingXlFile) {
                const fd = new FormData();
                fd.append('excel', pendingXlFile);
                fd.append('shop_id', String(payload.shop_id));
                fd.append('skip_date_check', 'true');
                fd.append('upload_date_override', payload.date);
                api.post('/excel/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                    .catch(() => {});
                setPendingXlFile(null);
            }

            const shopName = shops.find(s => String(s.id) === String(form.shop_id))?.shop_name || 'Shop';
            setSuccess(
                `Entry for "${shopName}" on ${form.date} created & auto-approved. ` +
                `₹${payload.cash.toFixed(2)} credited to wallet.`
            );
            setForm(prev => ({ ...EMPTY, shop_id: prev.shop_id, date: prev.date }));
            setAllowMismatch(false);
            clearProof();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create entry.');
        } finally {
            setSubmitting(false);
        }
    };

    const iCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none transition bg-white";
    const lCls = "block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide";
    const selectedShop = shops.find(s => String(s.id) === String(form.shop_id));

    return (
        <Layout title="Admin Direct Entry">
            <div className="max-w-2xl mx-auto space-y-5">

                {/* Info banner */}
                <div className="flex items-start gap-3 p-4 rounded-xl border"
                    style={{ background: 'rgba(255,107,0,0.06)', borderColor: 'rgba(255,107,0,0.2)' }}>
                    <PlusCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#FF6B00' }} />
                    <div>
                        <p className="text-sm font-semibold" style={{ color: '#FF6B00' }}>Admin Direct Entry</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Entries are <strong>auto-approved instantly</strong> with no approval queue.
                            Cash amount is credited to the shop user's wallet immediately.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100">

                    {/* Card header + Excel button */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <IndianRupee className="h-4 w-4 text-orange-500" />
                            New Entry
                        </h3>
                        <button
                            type="button"
                            onClick={() => xlRef.current?.click()}
                            disabled={xlLoading}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all"
                            style={{ background: xlLoading ? '#9ca3af' : 'linear-gradient(90deg,#059669,#10b981)' }}
                        >
                            {xlLoading
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                                : <><FileSpreadsheet className="h-3.5 w-3.5" /> Upload Excel</>}
                        </button>
                        <input ref={xlRef} type="file" accept=".xls,.xlsx" className="hidden"
                            onChange={(e) => handleExcelFile(e.target.files[0])} />
                    </div>

                    {xlError && (
                        <div className="mx-6 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span className="flex-1">{xlError}</span>
                            <button onClick={() => setXlError('')}><X className="h-3 w-3" /></button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">

                        {/* Shop selector */}
                        <div>
                            <label className={lCls}>Shop <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <select className={`${iCls} pl-9`} value={form.shop_id} onChange={set('shop_id')} required>
                                    <option value="">Select a shop…</option>
                                    {shops.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.shop_name}{s.city_name ? ` — ${s.city_name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedShop?.shop_address && (
                                <p className="text-xs text-gray-400 mt-1 pl-1">{selectedShop.shop_address}</p>
                            )}
                        </div>

                        {/* Date */}
                        <div>
                            <label className={lCls}>Date <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input type="date" className={`${iCls} pl-9`} value={form.date} onChange={set('date')} required />
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Total Sale */}
                        <div>
                            <label className={lCls}>
                                Total Sale (₹) <span className="text-red-500">*</span>
                                <span className="ml-2 text-[10px] normal-case font-normal text-gray-400">
                                    — enter manually or upload Excel to auto-fill
                                </span>
                            </label>
                            <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                <input type="number" min="0" step="0.01"
                                    className={`${iCls} pl-9 text-lg font-semibold text-teal-700`}
                                    placeholder="0.00"
                                    value={form.excel_total_sale}
                                    onChange={set('excel_total_sale')}
                                    required />
                            </div>
                        </div>

                        {/* Breakdown: Cash / Online / Razorpay / Cheque */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                ['cash',     'Cash'],
                                ['online',   'QR / Card / Bank'],
                                ['razorpay', 'Razorpay'],
                                ['cheque',   'Cheque'],
                            ].map(([field, label]) => (
                                <div key={field}>
                                    <label className={lCls}>{label} (₹)</label>
                                    <input type="number" min="0" step="0.01"
                                        className={iCls}
                                        placeholder="0.00"
                                        value={form[field]}
                                        onChange={set(field)} />
                                </div>
                            ))}
                        </div>

                        {/* Payment In */}
                        <div>
                            <label className={lCls}>
                                Payment In (₹)
                                <span className="ml-2 text-[10px] normal-case font-normal text-indigo-400">(optional · not counted as sale)</span>
                            </label>
                            <input type="number" min="0" step="0.01"
                                className={iCls}
                                placeholder="0.00"
                                value={form.payment_in}
                                onChange={e => {
                                    set('payment_in')(e);
                                    fetchPiAdmins();
                                }} />
                            {parseFloat(form.payment_in) > 0 && (
                                <div className="mt-2">
                                    <label className={lCls}>Admin Bank Account <span className="text-red-500">*</span></label>
                                    <select className={iCls}
                                        value={form.payment_in_admin_id}
                                        onChange={set('payment_in_admin_id')}
                                        required>
                                        <option value="">— Select admin —</option>
                                        {piAdmins.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Live Difference Calculator */}
                        {form.excel_total_sale !== '' && (
                            <div className={`rounded-xl border overflow-hidden transition-all ${
                                !mismatch
                                    ? 'border-green-200'
                                    : allowMismatch
                                        ? 'border-amber-300'
                                        : 'border-red-200'
                            }`}>
                                {/* Breakdown & Total rows */}
                                <div className={`px-4 pt-3 pb-2.5 space-y-2 ${
                                    !mismatch ? 'bg-green-50' : allowMismatch ? 'bg-amber-50' : 'bg-red-50'
                                }`}>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Breakdown (Cash + Razorpay + QR + Cheque + Payment In)</span>
                                        <span className="font-bold text-gray-800">{fmtAmt(breakdown)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600 font-medium">Total Sale</span>
                                        <span className="font-bold text-teal-700">{fmtAmt(total)}</span>
                                    </div>
                                </div>

                                {/* Difference row */}
                                <div className={`px-4 py-2.5 border-t flex items-center justify-between ${
                                    !mismatch
                                        ? 'border-green-200 bg-green-100'
                                        : allowMismatch
                                            ? 'border-amber-300 bg-amber-100'
                                            : 'border-red-200 bg-red-100'
                                }`}>
                                    <div className="flex items-center gap-1.5">
                                        <Calculator className="h-4 w-4 text-gray-500" title="Auto-calculated difference" />
                                        <span className="text-sm font-semibold text-gray-700">Difference</span>
                                    </div>
                                    {!mismatch ? (
                                        <span className="text-sm font-bold text-green-700">✔ Perfect Match</span>
                                    ) : diff > 0 ? (
                                        <span className={`text-sm font-bold ${allowMismatch ? 'text-amber-700' : 'text-red-600'}`}>
                                            +{fmtAmt(diff)} Extra (Over Amount) ❌
                                        </span>
                                    ) : (
                                        <span className={`text-sm font-bold ${allowMismatch ? 'text-amber-700' : 'text-red-600'}`}>
                                            -{fmtAmt(Math.abs(diff))} Short (Less Amount) ❌
                                        </span>
                                    )}
                                </div>

                                {/* Admin override checkbox */}
                                {mismatch && (
                                    <div className={`px-4 py-2.5 border-t flex items-center gap-2 ${
                                        allowMismatch ? 'border-amber-300 bg-amber-50' : 'border-red-200 bg-red-50'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            id="allowMismatch"
                                            checked={allowMismatch}
                                            onChange={(e) => setAllowMismatch(e.target.checked)}
                                            className="h-3.5 w-3.5 accent-orange-500 cursor-pointer"
                                        />
                                        <label htmlFor="allowMismatch" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                                            Allow mismatch (Admin only) — submit anyway
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Photo Proof (MANDATORY · private S3) — Camera or Upload */}
                        <div>
                            <label className={lCls}>Photo Proof <span className="text-red-600 font-bold">* (Required)</span></label>

                            <div className="rounded-xl border p-4"
                                style={{ borderColor: proofKey ? '#86efac' : 'var(--border-color)', background: proofKey ? 'rgba(16,185,129,0.04)' : 'var(--bg-primary)' }}>

                                {!photoPreview ? (
                                    /* ── Two options: Open Camera · Upload Image ── */
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => { setProofError(''); setShowCamera(true); }} disabled={proofUploading}
                                            className="group flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed transition-all hover:border-orange-400 hover:bg-orange-50 disabled:opacity-50"
                                            style={{ borderColor: 'var(--border-color)' }}>
                                            <span className="h-11 w-11 rounded-full flex items-center justify-center bg-orange-100 group-hover:bg-orange-500 transition-colors">
                                                <Camera className="h-5 w-5 text-orange-500 group-hover:text-white transition-colors" />
                                            </span>
                                            <span className="text-xs font-bold text-gray-700">📷 Open Camera</span>
                                            <span className="text-[10px] text-gray-400">Live capture</span>
                                        </button>

                                        <button type="button" onClick={() => { setProofError(''); fileRef.current?.click(); }} disabled={proofUploading}
                                            className="group flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed transition-all hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                                            style={{ borderColor: 'var(--border-color)' }}>
                                            <span className="h-11 w-11 rounded-full flex items-center justify-center bg-indigo-100 group-hover:bg-indigo-500 transition-colors">
                                                <ImageIcon className="h-5 w-5 text-indigo-500 group-hover:text-white transition-colors" />
                                            </span>
                                            <span className="text-xs font-bold text-gray-700">🖼 Upload Image</span>
                                            <span className="text-[10px] text-gray-400">From device</span>
                                        </button>
                                    </div>
                                ) : (
                                    /* ── Captured / selected preview ── */
                                    <div className="flex items-center gap-4">
                                        <div className="relative flex-shrink-0">
                                            <img src={photoPreview} alt="proof preview" className="h-24 w-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
                                            {proofUploading && (
                                                <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                {proofSource === 'camera' ? <><Camera className="h-3.5 w-3.5 text-orange-500" /> Camera Photo</> : <><ImageIcon className="h-3.5 w-3.5 text-indigo-500" /> Uploaded Image</>}
                                            </p>
                                            {proofUploading ? (
                                                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>
                                            ) : proofKey ? (
                                                <p className="text-[11px] text-green-700 font-semibold mt-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Photo uploaded successfully</p>
                                            ) : null}
                                            <div className="mt-2 flex items-center gap-2">
                                                <button type="button" onClick={() => { setProofError(''); setShowCamera(true); }} disabled={proofUploading}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 disabled:opacity-50">
                                                    <Camera className="h-3 w-3" /> Retake
                                                </button>
                                                <button type="button" onClick={() => { setProofError(''); fileRef.current?.click(); }} disabled={proofUploading}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50">
                                                    <ImageIcon className="h-3 w-3" /> Replace
                                                </button>
                                                <button type="button" onClick={clearProof} disabled={proofUploading}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg text-gray-500 border border-gray-200 hover:bg-gray-100 disabled:opacity-50">
                                                    <X className="h-3 w-3" /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {proofError && (
                                <p className="text-[11px] text-red-600 flex items-center gap-1 font-semibold mt-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" /> {proofError}
                                </p>
                            )}
                            {!proofKey && !proofUploading && !proofError && (
                                <p className="text-[11px] text-amber-700 mt-1.5">Photo Proof is required to submit this entry.</p>
                            )}
                            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                        </div>

                        {/* Feedback */}
                        {error && (
                            <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
                            </div>
                        )}
                        {success && (
                            <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />{success}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" disabled={!canSubmit}
                            className="w-full py-3 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
                            style={{
                                background: canSubmit ? '#FF6B00' : '#d1d5db',
                                cursor:     canSubmit ? 'pointer' : 'not-allowed',
                            }}>
                            {submitting
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                                : <><Send className="h-4 w-4" /> Create & Auto-Approve Entry</>}
                        </button>
                        {mismatch && !allowMismatch ? (
                            <p className="text-center text-xs text-red-500 font-semibold">
                                ⚠ Check "Allow mismatch" above to enable submit
                            </p>
                        ) : (
                            <p className="text-center text-xs text-gray-400">
                                Entry will be saved as <strong>Approved</strong> immediately — cash credited to shop wallet.
                            </p>
                        )}
                    </form>
                </div>
            </div>

            {/* ── CAMERA CAPTURE MODAL ────────────────────────────────── */}
            {showCamera && (
                <CameraProofModal onClose={() => setShowCamera(false)} onUse={handleCameraUse} />
            )}

            {/* ── EXCEL PREVIEW MODAL ─────────────────────────────────── */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--bg-surface)' }}>

                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-green-50">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Excel Preview</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {previewData.previewRows.length} row(s) · confirm to auto-fill Total Sale
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreview(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Info */}
                        <div className="mx-6 mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 text-xs">
                            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                Total Sale will be set to <strong>{fmtAmt(previewData.totalSale)}</strong> (sum of Received Amount).
                                {previewData.date
                                    ? <> Date will be set to <strong>{previewData.date}</strong>.</>
                                    : <> No date found in Excel — current date will be kept.</>}
                                {' '}All fields remain manually editable after loading.
                            </span>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto mt-4">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0" style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        {['#', 'Date', 'Received Amount (₹)'].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.previewRows.map((r, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {r.date || <span className="text-gray-400 italic">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 font-bold text-teal-700">
                                                ₹{r.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 gap-4"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                    Total Sale (Sum of Received Amount)
                                </p>
                                <p className="font-extrabold text-teal-700 text-xl">
                                    {fmtAmt(previewData.totalSale)}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
                                    Cancel
                                </button>
                                <button onClick={confirmExcel}
                                    className="px-5 py-2 text-sm font-bold rounded-lg text-white transition-all shadow-md"
                                    style={{ background: 'linear-gradient(90deg,#059669,#10b981)' }}>
                                    ✓ Confirm &amp; Load
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default AdminEntryPage;
