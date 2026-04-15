import React, { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
    Send, RefreshCw, LogOut, IndianRupee, Store, Lock, Camera,
    MapPin, AlertCircle, FileSpreadsheet, X, CheckCircle2, XCircle,
    Loader2, Calendar, Pencil,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

/* ── Geo helpers ─────────────────────────────────────────────────── */
const toRad = (v) => (v * Math.PI) / 180;
const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ── Date helpers ────────────────────────────────────────────────── */
const normDate = (d) => (d ? String(d).split('T')[0] : null);
const fmtDate = (d) => {
    if (!d) return '—';
    const s = normDate(d);
    if (!s) return '—';
    const [y, mo, day] = s.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('en-IN');
};

/* ── Client-side Excel parser ────────────────────────────────────── */
function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];

                // Dynamic header detection: scan every row for "Received Amount"
                const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                const headerIdx = rawRows.findIndex(
                    (row) =>
                        Array.isArray(row) &&
                        row.some(
                            (c) =>
                                typeof c === 'string' &&
                                c.trim().toLowerCase() === 'received amount',
                        ),
                );

                if (headerIdx === -1) {
                    reject(new Error("Invalid Excel format. 'Received Amount' column not found."));
                    return;
                }

                const rows = XLSX.utils.sheet_to_json(ws, { range: headerIdx, defval: null });

                // Column finder (case-insensitive, trims spaces)
                const find = (row, names) => {
                    const k = Object.keys(row).find((k) =>
                        names.includes(k.trim().toLowerCase()),
                    );
                    return k !== undefined ? row[k] : null;
                };

                // Safe number conversion (strips ₹, commas, spaces)
                const toNum = (v) => {
                    if (v == null || v === '') return 0;
                    return parseFloat(String(v).replace(/[₹,\s]/g, '')) || 0;
                };

                // Date normalizer
                const parseDate = (v) => {
                    if (!v) return null;
                    if (v instanceof Date) return v.toISOString().split('T')[0];
                    const s = String(v).trim();
                    // DD/MM/YYYY or DD-MM-YYYY
                    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (m) {
                        return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                    }
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                };

                const mapped = rows
                    .map((row) => {
                        const date = parseDate(find(row, ['date']));
                        const sale = toNum(
                            find(row, ['received amount', 'sale', 'total sale', 'total_sale']),
                        );
                        const cash = toNum(find(row, ['cash']));
                        const paytm =
                            toNum(find(row, ['paytm', 'upi', 'qr', 'card', 'bank', 'digital', 'qr/card/bank'])) +
                            toNum(find(row, ['razorpay', 'online']));
                        const expense = toNum(find(row, ['expense']));
                        if (!sale && !cash && !paytm && !expense && !date) return null;
                        return { date, sale, cash, paytm, expense };
                    })
                    .filter(Boolean);

                if (mapped.length === 0) {
                    reject(new Error('No valid data rows found in the Excel file.'));
                    return;
                }

                resolve({ mapped });
            } catch (err) {
                reject(new Error('Failed to parse Excel file. ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
    });
}

/* ══════════════════════════════════════════════════════════════════
   SHOP DASHBOARD
══════════════════════════════════════════════════════════════════ */
const ShopDashboard = () => {
    const { logout, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const xlRef = useRef(null);

    /* ── Dashboard data ──────────────────────────────────────────── */
    const [data, setData] = useState({ summary: {}, latestEntries: [], shop: null });
    const [loading, setLoading] = useState(true);
    const [todayLocked, setTodayLocked] = useState(false);

    /* ── GPS ─────────────────────────────────────────────────────── */
    const [gpsStatus, setGpsStatus] = useState('idle'); // idle|checking|ok|fail|no_coords
    const [gpsError, setGpsError] = useState('');

    /* ── Photo ───────────────────────────────────────────────────── */
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');

    /* ── Countdown ───────────────────────────────────────────────── */
    const [countdown, setCountdown] = useState('');

    /* ── Entry form ──────────────────────────────────────────────── */
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        total_sale: '', cash: '', paytm: '', expense: '',
    });
    const [editId, setEditId] = useState(null);       // null = new, number = editing existing
    const [editLocked, setEditLocked] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    /* ── Excel state ─────────────────────────────────────────────── */
    const [xlLoading, setXlLoading]           = useState(false);
    const [xlError, setXlError]               = useState('');
    const [xlSuccess, setXlSuccess]           = useState('');
    const [showPreview, setShowPreview]       = useState(false);
    const [previewData, setPreviewData]       = useState({ mapped: [] });
    const [excelRows, setExcelRows]           = useState([]);
    const [replaceMode, setReplaceMode]       = useState(true);
    const [excelDrivenTotal, setExcelDrivenTotal] = useState(false);

    /* ── Entries view ────────────────────────────────────────────── */
    const [dateFilter, setDateFilter]   = useState('');
    const [activeRowIdx, setActiveRowIdx] = useState(null);

    /* ── Effects ─────────────────────────────────────────────────── */
    useEffect(() => { fetchData(); }, []);

    // Auto-dismiss success toast
    useEffect(() => {
        if (!xlSuccess) return;
        const t = setTimeout(() => setXlSuccess(''), 4000);
        return () => clearTimeout(t);
    }, [xlSuccess]);

    // Countdown to midnight
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            const diff = Math.max(0, midnight - now);
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(
                `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            );
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, []);

    // When date filter changes and Excel rows exist, sync form to that date's data
    useEffect(() => {
        if (excelRows.length === 0) return;
        if (dateFilter) {
            const row = excelRows.find((r) => r.date === dateFilter);
            if (row) {
                setActiveRowIdx(null);
                setExcelDrivenTotal(false);
                setForm({
                    date:       row.date,
                    total_sale: String(row.sale || ''),
                    cash:       String(row.cash || ''),
                    paytm:      String(row.paytm || ''),
                    expense:    String(row.expense || ''),
                });
            }
        } else {
            const total = excelRows.reduce((s, r) => s + (r.sale || 0), 0);
            setForm((prev) => ({ ...prev, total_sale: String(total) }));
            setExcelDrivenTotal(true);
        }
    }, [dateFilter, excelRows]);

    /* ── API ─────────────────────────────────────────────────────── */
    const fetchData = async () => {
        try {
            const res = await api.get('/dashboard/shop');
            setData(res.data);
            const today = new Date().toISOString().split('T')[0];
            const todayEntry = res.data.latestEntries?.find(
                (e) => e.date?.split('T')[0] === today,
            );
            if (todayEntry) {
                const unlockActive =
                    todayEntry.edit_enabled_till &&
                    new Date() < new Date(todayEntry.edit_enabled_till);
                setTodayLocked(todayEntry.locked && !unlockActive);
            } else {
                setTodayLocked(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    /* ── GPS ─────────────────────────────────────────────────────── */
    const checkGPS = () => {
        setGpsStatus('checking');
        setGpsError('');
        if (!navigator.geolocation) {
            setGpsStatus('fail');
            setGpsError('GPS not supported on this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const shop = data.shop;
                if (!shop?.latitude || !shop?.longitude) {
                    setGpsStatus('no_coords');
                    return;
                }
                const dist = getDistance(
                    latitude, longitude,
                    parseFloat(shop.latitude), parseFloat(shop.longitude),
                );
                if (dist <= 100) {
                    setGpsStatus('ok');
                } else {
                    setGpsStatus('fail');
                    setGpsError(`You are ${Math.round(dist)}m away. Must be within 100m.`);
                }
            },
            () => { setGpsStatus('fail'); setGpsError('Location permission denied. Enable GPS.'); },
        );
    };

    /* ── Photo ───────────────────────────────────────────────────── */
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const uploadPhoto = async () => {
        if (!photoFile) return null;
        const fd = new FormData();
        fd.append('photo', photoFile);
        const res = await api.post('/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data.url;
    };

    /* ── Form ────────────────────────────────────────────────────── */
    const diff = useMemo(() => {
        const sale = parseFloat(form.total_sale || 0);
        const sum = parseFloat(form.cash || 0) + parseFloat(form.paytm || 0) + parseFloat(form.expense || 0);
        return (sale - sum).toFixed(2);
    }, [form.total_sale, form.cash, form.paytm, form.expense]);

    // Lock state: when editing an existing entry, use that entry's lock; otherwise today's lock
    const isFormLocked = editId !== null ? editLocked : todayLocked;

    const loadEntryForEdit = useCallback((entry) => {
        const unlockActive =
            entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);
        setEditId(entry.id);
        setEditLocked(entry.locked && !unlockActive);
        setExcelDrivenTotal(false);
        setForm({
            date:       normDate(entry.date) || new Date().toISOString().split('T')[0],
            total_sale: String(entry.total_sale ?? ''),
            cash:       String(entry.cash ?? ''),
            paytm:      String((+(entry.paytm || 0) + +(entry.razorpay || 0))),
            expense:    String(entry.expense ?? ''),
        });
    }, []);

    const resetForm = useCallback(() => {
        setEditId(null);
        setEditLocked(false);
        setExcelDrivenTotal(false);
        setPhotoFile(null);
        setPhotoPreview('');
        setActiveRowIdx(null);
        setForm({
            date: new Date().toISOString().split('T')[0],
            total_sale: '', cash: '', paytm: '', expense: '',
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (diff !== '0.00') return alert('Difference must be ₹0 before submitting');
        if (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')
            return alert('GPS check required. Click "Check Location" first.');
        setSubmitting(true);
        try {
            let url = null;
            if (photoFile) url = await uploadPhoto();

            if (editId !== null) {
                // Update existing entry
                await api.put(`/entries/${editId}`, { ...form, razorpay: 0, photo_url: url });
                alert('Entry updated!');
            } else {
                // Create new entry
                try {
                    await api.post('/entries', { shop_id: user?.shopId, ...form, razorpay: 0, photo_url: url });
                    alert('Entry submitted!');
                } catch (postErr) {
                    if (postErr.response?.status === 409 && postErr.response?.data?.existing) {
                        // Auto-load existing entry into edit mode
                        loadEntryForEdit(postErr.response.data.existing);
                        alert('An entry for this date already exists — loaded it for editing.');
                        setSubmitting(false);
                        return;
                    }
                    throw postErr;
                }
            }

            resetForm();
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    /* ── Excel ───────────────────────────────────────────────────── */
    const fillFormFromRow = useCallback((row) => {
        setExcelDrivenTotal(false);
        setForm({
            date:       normDate(row.date) || new Date().toISOString().split('T')[0],
            total_sale: String(row.sale ?? row.total_sale ?? ''),
            cash:       String(row.cash ?? ''),
            paytm:      String(row.paytm ?? ''),
            expense:    String(row.expense ?? ''),
        });
    }, []);

    const handleExcelFile = async (file) => {
        if (!file) return;
        setXlLoading(true);
        setXlError('');
        setXlSuccess('');
        try {
            const result = await parseExcelFile(file);
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
        const mapped = previewData.mapped;
        const total = mapped.reduce((s, r) => s + (r.sale || 0), 0);
        setExcelRows(mapped);
        setShowPreview(false);
        setActiveRowIdx(null);
        setForm((prev) => ({ ...prev, total_sale: String(total), cash: '', paytm: '', expense: '' }));
        setExcelDrivenTotal(true);
        setXlSuccess(`Excel loaded — ${mapped.length} rows · Total Sale ₹${total.toLocaleString('en-IN')}`);
    };

    const clearExcel = () => {
        setExcelRows([]);
        setActiveRowIdx(null);
        setXlError('');
        setXlSuccess('');
        setExcelDrivenTotal(false);
    };

    /* ── Combined + filtered entries ─────────────────────────────── */
    const combinedEntries = useMemo(() => {
        const apiEntries = data.latestEntries || [];
        if (excelRows.length === 0) return apiEntries;

        const toXlEntry = (r, i) => ({
            id: `xl-${i}`, date: r.date, total_sale: r.sale,
            cash: r.cash, paytm: r.paytm, razorpay: 0, expense: r.expense,
            locked: false, photo_url: null, _excel: true, _raw: r,
        });

        if (replaceMode) return excelRows.map(toXlEntry);

        // Merge: add Excel rows only for dates not already in API
        const result = [...apiEntries];
        for (let i = 0; i < excelRows.length; i++) {
            const xr = excelRows[i];
            if (!apiEntries.some((e) => normDate(e.date) === normDate(xr.date))) {
                result.push(toXlEntry(xr, i));
            }
        }
        return result.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }, [data.latestEntries, excelRows, replaceMode]);

    const displayEntries = useMemo(
        () =>
            dateFilter
                ? combinedEntries.filter((e) => normDate(e.date) === dateFilter)
                : combinedEntries,
        [combinedEntries, dateFilter],
    );

    const handleRowClick = (entry, idx) => {
        setActiveRowIdx(idx);
        if (entry._excel) {
            fillFormFromRow(entry._raw);
        } else {
            loadEntryForEdit(entry);
        }
    };

    /* ── Style helper ────────────────────────────────────────────── */
    const inputCls = (disabled) =>
        `w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-colors ${
            disabled
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white'
        }`;

    /* ── Loading screen ──────────────────────────────────────────── */
    if (loading)
        return <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>;

    /* ══════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>

            {/* ── Navbar ──────────────────────────────────────────── */}
            <nav className="bg-teal-700 px-8 py-4 flex items-center justify-between shadow-md">
                <div>
                    <h1 className="text-white text-lg font-bold tracking-wide">Shop Dashboard</h1>
                    <p className="text-teal-200 text-xs mt-0.5 flex items-center gap-1.5">
                        {user?.name || user?.mobile}
                        {user?.shopName && (
                            <><span>·</span><Store className="h-3 w-3" />{user.shopName}</>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <p className="text-teal-300 text-xs">Locks in</p>
                        <p className={`font-mono font-bold text-sm ${countdown < '00:30:00' ? 'text-red-300' : 'text-white'}`}>
                            {countdown}
                        </p>
                    </div>
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="flex items-center gap-2 text-sm text-teal-200 hover:text-white border border-teal-500 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <LogOut className="h-4 w-4" /> Logout
                    </button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* ── Summary Cards ───────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        ['Sales',   data.summary?.total_sales,   'text-teal-600'],
                        ['Cash',    data.summary?.total_cash,    'text-blue-600'],
                        ['Online',  data.summary?.total_online,  'text-purple-600'],
                        ['Expense', data.summary?.total_expense, 'text-red-500'],
                    ].map(([label, val, cls]) => (
                        <div
                            key={label}
                            className="rounded-xl p-4 shadow-sm border"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                        >
                            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                                {label} (this month)
                            </p>
                            <p className={`text-xl font-bold ${cls}`}>
                                ₹{Number(val || 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* ── Entry Form ──────────────────────────────── */}
                    <div
                        className="lg:col-span-2 rounded-xl shadow-sm border p-6"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                    >
                        <h3
                            className="text-base font-bold mb-1 flex items-center gap-2 pb-3 border-b"
                            style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                        >
                            <IndianRupee className="h-4 w-4 text-teal-600" />
                            {editId !== null ? `Edit Entry — ${fmtDate(form.date)}` : 'New Daily Entry'}
                            {editId !== null && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    title="Cancel editing"
                                    className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            {editId === null && activeRowIdx !== null && (
                                <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                    Row filled ✓
                                </span>
                            )}
                        </h3>

                        {/* Locked warning */}
                        {isFormLocked && (
                            <div className="my-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                <Lock className="h-4 w-4 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold">
                                        {editId !== null ? 'This entry is locked' : "Today's entry is locked"}
                                    </p>
                                    <p className="text-xs mt-0.5">Contact admin to unlock.</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
                            {/* Date */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                                <input
                                    type="date"
                                    className={inputCls(isFormLocked || editId !== null)}
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    disabled={isFormLocked || editId !== null}
                                    required
                                />
                            </div>

                            {/* Total Sale */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Total Sale (₹)</label>
                                <input
                                    type="number"
                                    className={inputCls(isFormLocked || excelDrivenTotal) + ' font-bold'}
                                    value={form.total_sale}
                                    onChange={(e) => !excelDrivenTotal && setForm({ ...form, total_sale: e.target.value })}
                                    placeholder="0.00"
                                    disabled={isFormLocked}
                                    required
                                />
                                {excelDrivenTotal && (
                                    <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Auto-calculated from uploaded Excel
                                    </p>
                                )}
                            </div>

                            {/* Cash / Expense */}
                            <div className="grid grid-cols-2 gap-2">
                                {[['cash', 'Cash'], ['expense', 'Expense']].map(([f, l]) => (
                                    <div key={f}>
                                        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>
                                        <input
                                            type="number"
                                            className={inputCls(isFormLocked)}
                                            value={form[f]}
                                            onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                                            placeholder="0"
                                            disabled={isFormLocked}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* QR / CARD / BANK */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>QR / CARD / BANK</label>
                                <input
                                    type="number"
                                    className={inputCls(isFormLocked)}
                                    value={form.paytm}
                                    onChange={(e) => setForm({ ...form, paytm: e.target.value })}
                                    placeholder="0"
                                    disabled={isFormLocked}
                                    required
                                />
                            </div>

                            {/* Difference indicator */}
                            {!isFormLocked && (
                                <div className={`p-3 rounded-lg border ${diff === '0.00' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex justify-between">
                                        <span className="text-xs font-semibold text-gray-600">Difference:</span>
                                        <span className={`text-lg font-bold ${diff === '0.00' ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{diff}
                                        </span>
                                    </div>
                                    <p className="text-xs text-center mt-0.5 text-gray-400">
                                        Must be ₹0.00 · Total Sale = Cash + QR/CARD/BANK + Expense
                                    </p>
                                </div>
                            )}

                            {/* GPS check */}
                            {!isFormLocked && data.shop?.latitude && (
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={checkGPS}
                                        className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                                            gpsStatus === 'ok'       ? 'bg-green-50 border-green-300 text-green-700' :
                                            gpsStatus === 'fail'     ? 'bg-red-50 border-red-300 text-red-700' :
                                            gpsStatus === 'checking' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
                                                                       'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <MapPin className="h-4 w-4" />
                                        {gpsStatus === 'ok'       ? '✓ Location Verified' :
                                         gpsStatus === 'checking' ? 'Checking...' :
                                         gpsStatus === 'fail'     ? '✗ Location Failed' : 'Check Location'}
                                    </button>
                                    {gpsError && (
                                        <p className="text-xs text-red-600 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />{gpsError}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Photo upload */}
                            {!isFormLocked && (
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                        Photo Proof (optional)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileRef.current?.click()}
                                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <Camera className="h-3.5 w-3.5" />
                                            {photoFile ? 'Change Photo' : 'Upload Photo'}
                                        </button>
                                        {photoPreview && (
                                            <img src={photoPreview} alt="preview" className="h-10 w-10 object-cover rounded-md border" />
                                        )}
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                </div>
                            )}

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={
                                    submitting || isFormLocked || diff !== '0.00' ||
                                    (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')
                                }
                                className={`w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all ${
                                    submitting || isFormLocked || diff !== '0.00' ||
                                    (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')
                                        ? 'bg-gray-300 cursor-not-allowed'
                                        : 'bg-teal-600 hover:bg-teal-700'
                                }`}
                            >
                                <Send className="h-4 w-4" />
                                {submitting
                                    ? (editId !== null ? 'Updating...' : 'Submitting...')
                                    : isFormLocked
                                    ? 'Entry Locked'
                                    : editId !== null
                                    ? 'Update Entry'
                                    : 'Submit Entry'}
                            </button>
                        </form>
                    </div>

                    {/* ── My Entries ──────────────────────────────── */}
                    <div
                        className="lg:col-span-3 rounded-xl shadow-sm border overflow-hidden"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            {/* Title row */}
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    My Entries
                                </h3>
                                <div className="flex items-center gap-2">
                                    {/* Upload Excel button */}
                                    <button
                                        onClick={() => xlRef.current?.click()}
                                        disabled={xlLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all shadow-sm"
                                        style={{
                                            background: xlLoading
                                                ? '#9ca3af'
                                                : 'linear-gradient(90deg,#059669,#10b981)',
                                        }}
                                    >
                                        {xlLoading
                                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                                            : <><FileSpreadsheet className="h-3.5 w-3.5" /> Upload Excel</>
                                        }
                                    </button>
                                    <input
                                        ref={xlRef}
                                        type="file"
                                        accept=".xls,.xlsx"
                                        className="hidden"
                                        onChange={(e) => handleExcelFile(e.target.files[0])}
                                    />

                                    {/* Refresh */}
                                    <button onClick={fetchData} className="p-1 text-teal-600 hover:text-teal-800">
                                        <RefreshCw className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Filter row */}
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Date filter */}
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                    <input
                                        type="date"
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-400"
                                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                                    />
                                    {dateFilter && (
                                        <button
                                            onClick={() => setDateFilter('')}
                                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                                        >
                                            <X className="h-3 w-3" /> Clear
                                        </button>
                                    )}
                                </div>

                                {/* Replace / Merge toggle — shown only when Excel rows are loaded */}
                                {excelRows.length > 0 && (
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <span className="text-xs text-gray-400">Excel:</span>
                                        <button
                                            onClick={() => setReplaceMode((v) => !v)}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                                                replaceMode
                                                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                            }`}
                                        >
                                            {replaceMode ? '⟳ Replace' : '⊕ Merge'}
                                        </button>
                                        <button
                                            onClick={clearExcel}
                                            title="Remove Excel data"
                                            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Status messages */}
                            {xlSuccess && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                    {xlSuccess}
                                </div>
                            )}
                            {xlError && (
                                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                                    <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span className="flex-1">{xlError}</span>
                                    <button onClick={() => setXlError('')}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                <thead style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        {['Date', 'Sale', 'Cash', 'Online', 'Expense', 'Photo', 'Status', ''].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-semibold uppercase"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayEntries.map((e, idx) => (
                                        <tr
                                            key={e.id || idx}
                                            onClick={() => handleRowClick(e, idx)}
                                            title="Click to auto-fill form"
                                            className="cursor-pointer transition-colors hover:opacity-90"
                                            style={{
                                                borderTop: '1px solid var(--border-color)',
                                                background:
                                                    activeRowIdx === idx
                                                        ? 'rgba(20,184,166,0.10)'
                                                        : e._excel
                                                        ? 'rgba(16,185,129,0.04)'
                                                        : undefined,
                                            }}
                                        >
                                            {/* Date */}
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                <div className="flex items-center gap-1.5">
                                                    {fmtDate(e.date)}
                                                    {e._excel && (
                                                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700 font-bold leading-none">
                                                            XL
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Sale */}
                                            <td className="px-4 py-3 text-sm font-bold text-teal-700">
                                                ₹{Number(e.total_sale || 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* Cash */}
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                ₹{Number(e.cash || 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* Online */}
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                ₹{(+(e.paytm || 0) + +(e.razorpay || 0)).toFixed(0)}
                                            </td>

                                            {/* Expense */}
                                            <td className="px-4 py-3 text-sm text-red-500">
                                                ₹{Number(e.expense || 0).toLocaleString('en-IN')}
                                            </td>

                                            {/* Photo */}
                                            <td className="px-4 py-3">
                                                {e.photo_url ? (
                                                    <a
                                                        href={`${BACKEND_URL}${e.photo_url}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(ev) => ev.stopPropagation()}
                                                    >
                                                        <img
                                                            src={`${BACKEND_URL}${e.photo_url}`}
                                                            alt="proof"
                                                            className="h-8 w-8 object-cover rounded-md border hover:opacity-80"
                                                        />
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${e.locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {e.locked ? 'Locked' : 'Open'}
                                                </span>
                                            </td>

                                            {/* Edit */}
                                            <td className="px-4 py-3">
                                                {!e._excel && (
                                                    <button
                                                        type="button"
                                                        title="Edit this entry"
                                                        onClick={(ev) => { ev.stopPropagation(); loadEntryForEdit(e); }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Empty state */}
                                    {displayEntries.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="text-center py-12 text-gray-400 text-sm">
                                                {dateFilter
                                                    ? `No entries found for ${fmtDate(dateFilter)}`
                                                    : 'No entries yet'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                PREVIEW MODAL
            ══════════════════════════════════════════════════════ */}
            {showPreview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                >
                    <div
                        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
                        style={{ background: 'var(--bg-surface)' }}
                    >
                        {/* Modal header */}
                        <div
                            className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
                            style={{ borderColor: 'var(--border-color)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-green-50">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                                        Excel Preview
                                    </h3>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        {previewData.mapped.length} rows parsed — review and confirm
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Replace / Merge toggle */}
                        <div
                            className="px-6 py-3 border-b flex items-center gap-3 flex-shrink-0"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                        >
                            <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                On confirm:
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setReplaceMode(true)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                        replaceMode
                                            ? 'bg-orange-500 text-white border-orange-500'
                                            : 'border-gray-200 text-gray-600 hover:border-orange-300'
                                    }`}
                                    style={{ background: replaceMode ? undefined : 'var(--bg-surface)' }}
                                >
                                    ⟳ Replace existing entries
                                </button>
                                <button
                                    onClick={() => setReplaceMode(false)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                        !replaceMode
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'border-gray-200 text-gray-600 hover:border-blue-300'
                                    }`}
                                    style={{ background: !replaceMode ? undefined : 'var(--bg-surface)' }}
                                >
                                    ⊕ Merge with existing
                                </button>
                            </div>
                        </div>

                        {/* Preview table — scrollable */}
                        <div className="flex-1 overflow-auto">
                            <table className="min-w-full text-sm">
                                <thead
                                    className="sticky top-0"
                                    style={{ background: 'var(--bg-primary)' }}
                                >
                                    <tr>
                                        {['#', 'Date', 'Sale (₹)', 'Cash (₹)', 'QR / CARD / BANK (₹)', 'Expense (₹)'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.mapped.map((r, i) => (
                                        <tr
                                            key={i}
                                            style={{ borderTop: '1px solid var(--border-color)' }}
                                            className="hover:opacity-80"
                                        >
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                                {r.date ? fmtDate(r.date) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 font-bold text-teal-700">
                                                {r.sale?.toLocaleString('en-IN') ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                                                {r.cash?.toLocaleString('en-IN') ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                                                {r.paytm?.toLocaleString('en-IN') ?? 0}
                                            </td>
                                            <td className="px-4 py-2.5 text-red-500">
                                                {r.expense?.toLocaleString('en-IN') ?? 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal footer */}
                        <div
                            className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 gap-4"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                        >
                            {/* Total sale summary */}
                            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Total Sale:&nbsp;
                                <span className="font-extrabold text-teal-700 text-base">
                                    ₹{previewData.mapped
                                        .reduce((s, r) => s + (r.sale || 0), 0)
                                        .toLocaleString('en-IN')}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-shrink-0">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmExcel}
                                    className="px-5 py-2 text-sm font-bold rounded-lg text-white transition-all shadow-md"
                                    style={{ background: 'linear-gradient(90deg,#059669,#10b981)' }}
                                >
                                    ✓ Confirm &amp; Load
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopDashboard;
