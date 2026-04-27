import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import Layout from '../components/Layout';
import { useSearchParams } from 'react-router-dom';
import {
    CheckCircle2, XCircle, IndianRupee, Store, Calendar,
    PlusCircle, AlertCircle, FileSpreadsheet, Camera, Loader2,
    Info, Send, X, Calculator,
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

                const dateKey = Object.keys(rows[0] ?? {}).find((k) => normalKey(k) === 'date');
                const parseDate = (v) => {
                    if (!v) return null;
                    if (v instanceof Date) return v.toISOString().split('T')[0];
                    // Excel serial number (e.g. 45123)
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

const EMPTY = { shop_id: '', date: getTodayISO(), excel_total_sale: '', cash: '', online: '', razorpay: '' };

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
    const [xlLoading,   setXlLoading]   = useState(false);
    const [xlError,     setXlError]     = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState({ date: null, totalSale: 0, previewRows: [] });

    // Photo
    const fileRef    = useRef(null);
    const [photoFile,    setPhotoFile]    = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');

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
    const breakdown  = parseFloat(form.cash || 0) + parseFloat(form.online || 0) + parseFloat(form.razorpay || 0);
    const diff       = breakdown - total;
    const mismatch   = form.excel_total_sale !== '' && Math.abs(diff) > 0.01;
    const canSubmit  = form.shop_id && form.date && form.excel_total_sale !== '' && !submitting && (!mismatch || allowMismatch);

    /* ── Photo ──────────────────────────────────────────────────── */
    const handlePhotoChange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f));
    };
    const uploadPhoto = async () => {
        if (!photoFile) return null;
        const fd = new FormData(); fd.append('photo', photoFile);
        const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        return res.data.url;
    };

    /* ── Excel ──────────────────────────────────────────────────── */
    const handleExcelFile = async (file) => {
        if (!file) return;
        setXlLoading(true); setXlError('');
        try {
            const result = await parseExcelForAdmin(file);
            setPreviewData(result);
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
            cash: '', online: '', razorpay: '',
        }));
    };

    /* ── Submit ─────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true); setError(null); setSuccess(null);
        try {
            let photoUrl = null;
            if (photoFile) photoUrl = await uploadPhoto();
            const payload = {
                shop_id:          parseInt(form.shop_id),
                date:             form.date,
                excel_total_sale: parseFloat(form.excel_total_sale),
                cash:             parseFloat(form.cash     || 0),
                online:           parseFloat(form.online   || 0),
                razorpay:         parseFloat(form.razorpay || 0),
                photo_url:        photoUrl,
            };
            await api.post('/entries', payload);
            const shopName = shops.find(s => String(s.id) === String(form.shop_id))?.shop_name || 'Shop';
            setSuccess(
                `Entry for "${shopName}" on ${form.date} created & auto-approved. ` +
                `₹${payload.cash.toFixed(2)} credited to wallet.`
            );
            setForm(prev => ({ ...EMPTY, shop_id: prev.shop_id, date: prev.date }));
            setAllowMismatch(false);
            setPhotoFile(null); setPhotoPreview('');
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

                        {/* Breakdown: Cash / Online / Razorpay */}
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                ['cash',     'Cash'],
                                ['online',   'QR / Card / Bank'],
                                ['razorpay', 'Razorpay'],
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
                                        <span className="text-gray-600 font-medium">Breakdown (Cash + Razorpay + QR)</span>
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

                        {/* Photo Proof */}
                        <div>
                            <label className={lCls}>Photo Proof (optional)</label>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => fileRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                                    <Camera className="h-3.5 w-3.5" />
                                    {photoFile ? 'Change Photo' : 'Upload Photo'}
                                </button>
                                {photoPreview && (
                                    <div className="relative">
                                        <img src={photoPreview} alt="proof" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />
                                        <button type="button"
                                            onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
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
