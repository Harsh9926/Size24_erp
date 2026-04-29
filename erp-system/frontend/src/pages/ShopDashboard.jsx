import React, { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import {
    Send, RefreshCw, LogOut, IndianRupee, Store, Lock,
    Camera, MapPin, AlertCircle, FileSpreadsheet, X,
    CheckCircle2, XCircle, Loader2, Calendar, Pencil,
    Info, Clock, ShieldCheck, ShieldX, Wallet, ArrowRightLeft,
    ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

/* ── Geo helpers ─────────────────────────────────────────────────── */
const toRad  = (v) => (v * Math.PI) / 180;
const getDist = (lat1, lng1, lat2, lng2) => {
    const R = 6371000, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

/* ── Date helpers ───────────────────────────────────────────────── */
const normDate  = (d) => (d ? String(d).split('T')[0] : null);
const fmtDate   = (d) => {
    if (!d) return '—';
    const s = normDate(d); if (!s) return '—';
    const [y, mo, day] = s.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('en-IN');
};
const getTodayISO = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
};

/* ── Status badge helper ─────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
    const map = {
        PENDING:  { cls: 'bg-amber-100 text-amber-700 border-amber-200',  icon: Clock,        label: 'Pending' },
        APPROVED: { cls: 'bg-green-100 text-green-700 border-green-200',  icon: ShieldCheck,  label: 'Approved' },
        REJECTED: { cls: 'bg-red-100   text-red-700   border-red-200',    icon: ShieldX,      label: 'Rejected' },
    };
    const { cls, icon: Icon, label } = map[status] || map.PENDING;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cls}`}>
            <Icon className="h-3 w-3" />{label}
        </span>
    );
};

/* ── Empty form ──────────────────────────────────────────────────── */
const EMPTY_FORM = () => ({
    date:             getTodayISO(),
    excel_total_sale: '',   // locked from Excel
    cash:             '',
    online:           '',   // QR / Card / Bank
    razorpay:         '',
});

/* ══════════════════════════════════════════════════════════════════
   EXCEL PARSER
   Rule: totalSale = SUM("Received Amount" column) ONLY
   - Ignores: Total Amount, Paid Amount, Balance Amount
   - Skips: Total/summary rows, empty rows, header row
   - Handles currency: "₹ 2555.00", "2,232.00", 0.00, plain numbers
══════════════════════════════════════════════════════════════════ */

// Normalise column header for comparison (trim + collapse internal spaces + lowercase)
const normalKey = (k) => String(k).trim().replace(/\s+/g, ' ').toLowerCase();

// Parse currency string OR plain number → float
// Handles: "₹ 2555.00", "₹2,232.00", "0.00", 2555 (number), "2555.00"
const parseCurrency = (v) => {
    if (v == null || v === '') return null; // null = cell is truly empty
    if (typeof v === 'number') return v;    // xlsx already gave us a number
    const cleaned = String(v)
        .replace(/₹/g, '')     // remove rupee symbol
        .replace(/,/g, '')     // remove thousand separators
        .trim();               // strip surrounding whitespace
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
};

// A "Total" summary row: any cell whose trimmed value is exactly
// "total", "grand total", or starts with "total:" (case-insensitive).
// This is the row Excel/POS systems add at the bottom with summed values.
const isSummaryRow = (row) =>
    Object.values(row).some((v) => {
        if (typeof v !== 'string') return false;
        const t = v.trim().toLowerCase();
        return t === 'total' || t === 'grand total' || t === 'total:' || t === 'totals';
    });

function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

                // ── Step 1: find the header row that has "Received Amount" ──
                const headerIdx = rawRows.findIndex(
                    (row) => Array.isArray(row) &&
                        row.some(
                            (c) => typeof c === 'string' &&
                                normalKey(c) === 'received amount',
                        ),
                );
                if (headerIdx === -1) {
                    reject(new Error(
                        "Invalid Excel format. 'Received Amount' column not found. " +
                        'Check that the column header is exactly "Received Amount".',
                    ));
                    return;
                }

                // ── Step 2: parse rows starting from the header ──────────
                // sheet_to_json uses the header row as keys automatically
                const rows = XLSX.utils.sheet_to_json(ws, { range: headerIdx, defval: null });
                if (rows.length === 0) {
                    reject(new Error('No data rows found after the header row.'));
                    return;
                }

                // ── Step 3: find the exact "Received Amount" key ─────────
                // (key preserves original casing from Excel)
                const raKey = Object.keys(rows[0] ?? {}).find(
                    (k) => normalKey(k) === 'received amount',
                );
                if (!raKey) {
                    reject(new Error("'Received Amount' column key could not be resolved."));
                    return;
                }

                // ── Step 4: find the "Date" key (optional) ───────────────
                const dateKey = Object.keys(rows[0] ?? {}).find(
                    (k) => normalKey(k) === 'date',
                );

                const parseDate = (v) => {
                    if (!v) return null;
                    if (v instanceof Date) return v.toISOString().split('T')[0];
                    const s = String(v).trim();
                    // dd/mm/yyyy or dd-mm-yyyy
                    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
                };

                // ── Step 5: iterate rows, skip summary/empty rows ────────
                const today    = getTodayISO();
                let totalSale  = 0;
                let excelDate  = null;
                const previewRows = [];

                for (const row of rows) {
                    // Skip Total/Grand Total summary rows
                    if (isSummaryRow(row)) continue;

                    const rawVal = row[raKey];

                    // Skip rows where "Received Amount" cell is empty
                    if (rawVal == null || rawVal === '') continue;

                    const amt = parseCurrency(rawVal);

                    // Skip rows where value couldn't be parsed as a number
                    if (amt === null) continue;

                    // Extract date (take first non-null date found)
                    if (dateKey && !excelDate) {
                        excelDate = parseDate(row[dateKey]);
                    }

                    // ✅ Only accumulate from "Received Amount" column
                    totalSale += amt;
                    previewRows.push({ date: excelDate, receivedAmount: amt });
                }

                if (previewRows.length === 0) {
                    reject(new Error(
                        "No valid rows found in 'Received Amount' column. " +
                        'Ensure the column has numeric values and no merge cells.',
                    ));
                    return;
                }

                // Validate date — only if Excel has an explicit date column
                if (excelDate && excelDate !== today) {
                    reject(new Error(
                        `Excel date (${excelDate}) is not today (${today}). ` +
                        "Only today's data is allowed.",
                    ));
                    return;
                }

                resolve({ date: excelDate || today, totalSale, previewRows });
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
    const fileRef  = useRef(null);
    const xlRef    = useRef(null);

    /* ── state ───────────────────────────────────────────────────── */
    const [data,       setData]       = useState({ summary: {}, latestEntries: [], shop: null });
    const [loading,    setLoading]    = useState(true);
    const [form,       setForm]       = useState(EMPTY_FORM());
    const [editId,     setEditId]     = useState(null);
    const [editLocked, setEditLocked] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [gpsStatus, setGpsStatus] = useState('idle');
    const [gpsError,  setGpsError]  = useState('');

    const [photoFile,    setPhotoFile]    = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');

    const [countdown, setCountdown] = useState('');

    const [xlLoading,   setXlLoading]   = useState(false);
    const [xlError,     setXlError]     = useState('');
    const [xlSuccess,   setXlSuccess]   = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState({ date: '', totalSale: 0, previewRows: [] });
    const [excelLoaded, setExcelLoaded] = useState(false);

    const [dateFilter,   setDateFilter]   = useState('');
    const [activeRowIdx, setActiveRowIdx] = useState(null);

    // ── Wallet / Transfer state ───────────────────────────────────
    const [walletBalance,     setWalletBalance]     = useState(0);
    const [managers,          setManagers]          = useState([]);
    const [myTransfers,       setMyTransfers]       = useState([]);
    const [showTransferPanel, setShowTransferPanel] = useState(false);
    const [transferForm,      setTransferForm]      = useState({ to_user_id: '', amount: '', note: '' });
    const [transferring,      setTransferring]      = useState(false);
    const [transferMsg,       setTransferMsg]       = useState(null); // {type, text}

    /* ── Wallet helpers ──────────────────────────────────────────── */
    const fetchBalance = useCallback(async () => {
        try {
            const res = await api.get('/transfers/balance');
            setWalletBalance(res.data.balance);
        } catch {}
    }, []);

    const fetchManagers = useCallback(async () => {
        try {
            const res = await api.get('/transfers/managers');
            setManagers(res.data);
        } catch {}
    }, []);

    const fetchMyTransfers = useCallback(async () => {
        try {
            const res = await api.get('/transfers/mine');
            setMyTransfers(res.data);
        } catch {}
    }, []);

    const handleTransfer = async (e) => {
        e.preventDefault();
        const amt = parseFloat(transferForm.amount);
        if (!transferForm.to_user_id) return setTransferMsg({ type: 'error', text: 'Select a manager.' });
        if (!amt || amt <= 0)         return setTransferMsg({ type: 'error', text: 'Enter a valid amount.' });
        if (amt > walletBalance)      return setTransferMsg({ type: 'error', text: `Insufficient balance. Available: ₹${walletBalance.toFixed(2)}` });

        setTransferring(true);
        setTransferMsg(null);
        try {
            await api.post('/transfers', {
                to_user_id: transferForm.to_user_id,
                amount:     amt,
                note:       transferForm.note || undefined,
            });
            setTransferMsg({ type: 'success', text: 'Transfer sent! Waiting for manager acceptance.' });
            setTransferForm({ to_user_id: '', amount: '', note: '' });
            fetchMyTransfers();
        } catch (err) {
            setTransferMsg({ type: 'error', text: err.response?.data?.error || 'Transfer failed.' });
        } finally {
            setTransferring(false);
        }
    };

    /* ── effects ─────────────────────────────────────────────────── */
    useEffect(() => {
        fetchData();
        fetchBalance();
        fetchManagers();
        fetchMyTransfers();
    }, []);
    useEffect(() => {
        if (!xlSuccess) return;
        const t = setTimeout(() => setXlSuccess(''), 5000);
        return () => clearTimeout(t);
    }, [xlSuccess]);
    useEffect(() => {
        const tick = () => {
            const now = new Date(), mid = new Date();
            mid.setHours(24,0,0,0);
            const d = Math.max(0, mid - now);
            setCountdown(
                `${String(Math.floor(d/3600000)).padStart(2,'0')}:` +
                `${String(Math.floor((d%3600000)/60000)).padStart(2,'0')}:` +
                `${String(Math.floor((d%60000)/1000)).padStart(2,'0')}`,
            );
        };
        tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
    }, []);

    /* ── Auto-calculate Total Sale from breakdown ─────────────────── */
    useEffect(() => {
        if (!excelLoaded) return; // Only enforce when Excel locked
        // total sale stays fixed as excel_total_sale; we don't auto-update it here
    }, [form.cash, form.online, form.razorpay, excelLoaded]);

    /* ── Computed validation ──────────────────────────────────────── */
    const excelTotal   = parseFloat(form.excel_total_sale || 0);
    const breakdownSum = parseFloat(form.cash || 0) + parseFloat(form.online || 0) + parseFloat(form.razorpay || 0);
    const difference   = (breakdownSum - excelTotal).toFixed(2);
    const isMatch      = Math.abs(breakdownSum - excelTotal) <= 0.01;

    /* ── API ──────────────────────────────────────────────────────── */
    const fetchData = async () => {
        try {
            const res = await api.get('/dashboard/shop');
            setData(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    /* ── GPS ──────────────────────────────────────────────────────── */
    const checkGPS = () => {
        setGpsStatus('checking'); setGpsError('');
        if (!navigator.geolocation) { setGpsStatus('fail'); setGpsError('GPS not supported.'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const shop = data.shop;
                if (!shop?.latitude || !shop?.longitude) { setGpsStatus('no_coords'); return; }
                const dist = getDist(latitude, longitude, +shop.latitude, +shop.longitude);
                dist <= 100 ? setGpsStatus('ok') : (setGpsStatus('fail'), setGpsError(`${Math.round(dist)}m away. Must be within 100m.`));
            },
            () => { setGpsStatus('fail'); setGpsError('Location permission denied.'); },
        );
    };

    /* ── Photo ────────────────────────────────────────────────────── */
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

    /* ── Form helpers ─────────────────────────────────────────────── */
    const isFormLocked = editId !== null ? editLocked : false;

    const loadEntryForEdit = useCallback((entry) => {
        const unlockActive = entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);
        setEditId(entry.id);
        setEditLocked((entry.locked && !unlockActive) || entry.approval_status === 'APPROVED');
        setExcelLoaded(true);
        setForm({
            date:             normDate(entry.date) || getTodayISO(),
            excel_total_sale: String(entry.excel_total_sale ?? entry.total_sale ?? ''),
            cash:             String(entry.cash      ?? ''),
            online:           String(entry.online    ?? entry.paytm ?? ''),
            razorpay:         String(entry.razorpay  ?? ''),
        });
    }, []);

    const resetForm = useCallback(() => {
        setEditId(null); setEditLocked(false); setExcelLoaded(false);
        setPhotoFile(null); setPhotoPreview(''); setActiveRowIdx(null);
        setForm(EMPTY_FORM());
    }, []);

    /* ── Submit ───────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isMatch) return alert('Breakdown must match Total Sale before submitting.');
        if (excelTotal <= 0) return alert('Please upload an Excel file first to set Total Sale.');
        if (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')
            return alert('GPS check required. Click "Check Location" first.');

        setSubmitting(true);
        try {
            let photoUrl = null;
            if (photoFile) photoUrl = await uploadPhoto();

            const payload = {
                date:             form.date,
                excel_total_sale: form.excel_total_sale,
                cash:             form.cash     || '0',
                online:           form.online   || '0',
                razorpay:         form.razorpay || '0',
                photo_url:        photoUrl,
            };

            if (editId !== null) {
                await api.put(`/entries/${editId}`, payload);
                alert('Entry updated and re-submitted for approval!');
            } else {
                try {
                    await api.post('/entries', { shop_id: user?.shopId, ...payload });
                    alert('Entry submitted for admin approval! ✅');
                } catch (postErr) {
                    if (postErr.response?.status === 409 && postErr.response?.data?.existing) {
                        loadEntryForEdit(postErr.response.data.existing);
                        alert('An entry for this date already exists — loaded for editing.');
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

    /* ── Excel ────────────────────────────────────────────────────── */
    const handleExcelFile = async (file) => {
        if (!file) return;
        setXlLoading(true); setXlError(''); setXlSuccess('');
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

    // Confirms Excel preview — sets ONLY date + totalSale; breakdown is filled manually
    const confirmExcel = () => {
        const { date, totalSale, previewRows } = previewData;
        setShowPreview(false);
        setExcelLoaded(true);
        setForm({
            date:             date || getTodayISO(),
            excel_total_sale: String(totalSale.toFixed(2)),
            cash:             '',
            online:           '',
            razorpay:         '',
        });
        setXlSuccess(
            `✓ Excel loaded — ${previewRows.length} row(s) · Total Sale ₹${totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        );
    };

    /* ── Entries display ──────────────────────────────────────────── */
    const entries = data.latestEntries || [];
    const displayEntries = useMemo(
        () => dateFilter ? entries.filter((e) => normDate(e.date) === dateFilter) : entries,
        [entries, dateFilter],
    );

    /* ── Input style helper ───────────────────────────────────────── */
    const inputCls = (disabled) =>
        `w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-colors ${
            disabled
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 focus:ring-2 focus:ring-teal-500 bg-white'
        }`;

    const fmtAmt = (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading...</div>;

    /* ══════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>

            {/* Navbar */}
            <nav className="bg-teal-700 px-8 py-4 flex items-center justify-between shadow-md">
                <div>
                    <h1 className="text-white text-lg font-bold tracking-wide">Shop Dashboard</h1>
                    <p className="text-teal-200 text-xs mt-0.5 flex items-center gap-1.5">
                        {user?.name || user?.mobile}
                        {user?.shopName && <><span>·</span><Store className="h-3 w-3" />{user.shopName}</>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <p className="text-teal-300 text-xs">Locks in</p>
                        <p className={`font-mono font-bold text-sm ${countdown < '00:30:00' ? 'text-red-300' : 'text-white'}`}>{countdown}</p>
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

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                        ['Sales (month)',  data.summary?.total_sales,  'text-teal-600'],
                        ['Cash (month)',   data.summary?.total_cash,   'text-blue-600'],
                        ['Online (month)', data.summary?.total_online, 'text-purple-600'],
                    ].map(([l, v, c]) => (
                        <div key={l} className="rounded-xl p-4 shadow-sm border"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</p>
                            <p className={`text-xl font-bold ${c}`}>₹{Number(v || 0).toLocaleString('en-IN')}</p>
                        </div>
                    ))}

                    {/* Wallet Balance Card */}
                    <div className="rounded-xl p-4 shadow-sm border flex flex-col justify-between"
                        style={{ background: 'linear-gradient(135deg,#0f766e,#14b8a6)', borderColor: 'transparent' }}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-teal-100 font-semibold">Wallet Balance</p>
                            <Wallet className="h-4 w-4 text-teal-200" />
                        </div>
                        <p className="text-xl font-extrabold text-white">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <button
                            onClick={() => { setShowTransferPanel(p => !p); setTransferMsg(null); }}
                            className="mt-2 flex items-center gap-1 text-xs font-semibold text-teal-100 hover:text-white transition-colors">
                            <ArrowRightLeft className="h-3 w-3" />
                            Transfer Cash
                            <ChevronDown className={`h-3 w-3 transition-transform ${showTransferPanel ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ── Cash Transfer Panel ─────────────────────────── */}
                {showTransferPanel && (
                    <div className="rounded-xl border mb-6 overflow-hidden shadow-sm"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="px-6 py-4 border-b flex items-center gap-2"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <ArrowRightLeft className="h-4 w-4 text-teal-600" />
                            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Transfer Cash to Manager</h3>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Transfer Form */}
                            <form onSubmit={handleTransfer} className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Select Manager</label>
                                    <select
                                        value={transferForm.to_user_id}
                                        onChange={e => setTransferForm(p => ({ ...p, to_user_id: e.target.value }))}
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                        required>
                                        <option value="">— Choose a manager —</option>
                                        {managers.map(m => (
                                            <option key={m.id} value={m.id}>{m.name || m.mobile}</option>
                                        ))}
                                    </select>
                                    {managers.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">No managers found.</p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                        Amount (₹) <span className="font-normal text-gray-400">— Available: ₹{walletBalance.toFixed(2)}</span>
                                    </label>
                                    <input
                                        type="number" min="1" step="0.01"
                                        value={transferForm.amount}
                                        onChange={e => setTransferForm(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                                        required />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                                    <input
                                        type="text"
                                        value={transferForm.note}
                                        onChange={e => setTransferForm(p => ({ ...p, note: e.target.value }))}
                                        placeholder="e.g. Daily cash handover"
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                </div>

                                {transferMsg && (
                                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border ${
                                        transferMsg.type === 'success'
                                            ? 'bg-green-50 border-green-200 text-green-700'
                                            : 'bg-red-50 border-red-200 text-red-700'
                                    }`}>
                                        {transferMsg.type === 'success'
                                            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                            : <AlertCircle  className="h-4 w-4 flex-shrink-0" />}
                                        {transferMsg.text}
                                    </div>
                                )}

                                <button type="submit" disabled={transferring}
                                    className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                                    style={{ background: transferring ? '#9ca3af' : 'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
                                    {transferring
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                                        : <><Send className="h-4 w-4" /> Send Transfer</>}
                                </button>
                            </form>

                            {/* My Transfer History */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    My Transfer History
                                </p>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {myTransfers.length === 0 && (
                                        <p className="text-sm text-gray-400 py-4 text-center">No transfers yet.</p>
                                    )}
                                    {myTransfers.map(t => {
                                        const statusCfg = {
                                            pending:  { cls: 'bg-amber-100 text-amber-700', label: '⏳ Pending'  },
                                            approved: { cls: 'bg-green-100 text-green-700', label: '✅ Approved' },
                                            accepted: { cls: 'bg-green-100 text-green-700', label: '✅ Approved' },
                                            rejected: { cls: 'bg-red-100   text-red-700',   label: '❌ Rejected' },
                                        }[t.status] || { cls: 'bg-gray-100 text-gray-600', label: t.status };
                                        return (
                                            <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs"
                                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                                                <div>
                                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                        ₹{parseFloat(t.amount).toLocaleString('en-IN')} → {t.to_name || t.to_mobile}
                                                    </p>
                                                    {t.note && <p className="text-gray-400 truncate max-w-[160px]">{t.note}</p>}
                                                    <p className="text-gray-400">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* ── ENTRY FORM ─────────────────────────────────── */}
                    <div className="lg:col-span-2 rounded-xl shadow-sm border p-6"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                        <h3 className="text-base font-bold mb-1 flex items-center gap-2 pb-3 border-b"
                            style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}>
                            <IndianRupee className="h-4 w-4 text-teal-600" />
                            {editId !== null ? `Edit Entry — ${fmtDate(form.date)}` : 'New Daily Entry'}
                            {editId !== null && (
                                <button type="button" onClick={resetForm}
                                    className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 transition-colors">
                                    Cancel
                                </button>
                            )}
                        </h3>

                        {/* Locked / approved warning */}
                        {isFormLocked && (
                            <div className="my-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                <Lock className="h-4 w-4 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold">This entry is approved and locked</p>
                                    <p className="text-xs mt-0.5">Contact admin to make changes.</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3 mt-4">

                            {/* ── Date (read-only, from Excel) ───────── */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Date
                                    <span className="ml-1 text-[10px] font-normal text-amber-600">(from Excel · read-only)</span>
                                </label>
                                <div className="relative">
                                    <input id="field-date" type="date"
                                        className={inputCls(true) + ' pr-8'}
                                        value={form.date} disabled readOnly />
                                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* ── Total Sale (locked from Excel) ─────── */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Total Sale (₹)
                                    <span className="ml-1 text-[10px] font-normal text-teal-600">(locked from Excel)</span>
                                </label>
                                <div className="relative">
                                    <input id="field-total-sale" type="text"
                                        className={inputCls(true) + ' font-bold text-teal-700 pr-8'}
                                        value={excelLoaded ? `₹ ${fmtAmt(form.excel_total_sale).replace('₹','').trim()}` : 'Upload Excel to set Total Sale'}
                                        disabled readOnly
                                        aria-label="Total Sale (locked from Excel)" />
                                    <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                                </div>
                                {!excelLoaded && (
                                    <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                                        <Info className="h-3 w-3" />
                                        Upload Excel first — Total Sale will be automatically set.
                                    </p>
                                )}
                                {excelLoaded && (
                                    <p className="mt-1 text-[11px] text-teal-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Total Sale is locked from Excel. Upload again to change it.
                                    </p>
                                )}
                            </div>

                            {/* ── Cash ──────────────────────────────── */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Cash (₹)</label>
                                <input id="field-cash" type="number" min="0" step="0.01"
                                    className={inputCls(isFormLocked || !excelLoaded)}
                                    value={form.cash}
                                    onChange={(e) => !isFormLocked && excelLoaded && setForm((p) => ({ ...p, cash: e.target.value }))}
                                    placeholder="0.00"
                                    disabled={isFormLocked || !excelLoaded} />
                            </div>

                            {/* ── RazorPay ──────────────────────────── */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>RazorPay (₹)</label>
                                <input id="field-razorpay" type="number" min="0" step="0.01"
                                    className={inputCls(isFormLocked || !excelLoaded)}
                                    value={form.razorpay}
                                    onChange={(e) => !isFormLocked && excelLoaded && setForm((p) => ({ ...p, razorpay: e.target.value }))}
                                    placeholder="0.00"
                                    disabled={isFormLocked || !excelLoaded} />
                            </div>

                            {/* ── QR / Card / Bank ──────────────────── */}
                            <div>
                                <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>QR / Card / Bank (₹)</label>
                                <input id="field-online" type="number" min="0" step="0.01"
                                    className={inputCls(isFormLocked || !excelLoaded)}
                                    value={form.online}
                                    onChange={(e) => !isFormLocked && excelLoaded && setForm((p) => ({ ...p, online: e.target.value }))}
                                    placeholder="0.00"
                                    disabled={isFormLocked || !excelLoaded} />
                            </div>

                            {/* ── Validation indicator ───────────────── */}
                            {excelLoaded && (
                                <div className={`p-3 rounded-lg border transition-all ${isMatch
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-semibold text-gray-600">Breakdown Sum</span>
                                        <span className={`text-base font-extrabold ${isMatch ? 'text-green-600' : 'text-red-600'}`}>
                                            {fmtAmt(breakdownSum)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs font-semibold text-gray-600">Total Sale</span>
                                        <span className="text-base font-extrabold text-teal-700">{fmtAmt(excelTotal)}</span>
                                    </div>
                                    <div className={`mt-2 pt-2 border-t ${isMatch ? 'border-green-200' : 'border-red-200'} flex items-center justify-center gap-1.5`}>
                                        {isMatch
                                            ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-xs font-bold text-green-700">Breakdown matches ✓</span></>
                                            : <><XCircle className="h-4 w-4 text-red-600" /><span className="text-xs font-bold text-red-700">Breakdown must match Total Sale</span></>
                                        }
                                    </div>
                                    <p className="text-[10px] text-center mt-1 text-gray-400">
                                        Cash + RazorPay + QR/Card/Bank = Total Sale
                                    </p>
                                </div>
                            )}

                            {/* GPS check */}
                            {!isFormLocked && data.shop?.latitude && (
                                <div className="space-y-1">
                                    <button type="button" onClick={checkGPS}
                                        className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                                            gpsStatus === 'ok'       ? 'bg-green-50 border-green-300 text-green-700' :
                                            gpsStatus === 'fail'     ? 'bg-red-50 border-red-300 text-red-700' :
                                            gpsStatus === 'checking' ? 'bg-blue-50 border-blue-200 text-blue-600 animate-pulse' :
                                                                       'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                        <MapPin className="h-4 w-4" />
                                        {gpsStatus === 'ok' ? '✓ Location Verified' :
                                         gpsStatus === 'checking' ? 'Checking...' :
                                         gpsStatus === 'fail' ? '✗ Location Failed' : 'Check Location'}
                                    </button>
                                    {gpsError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{gpsError}</p>}
                                </div>
                            )}

                            {/* Photo */}
                            {!isFormLocked && (
                                <div>
                                    <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Photo Proof (optional)</label>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={() => fileRef.current?.click()}
                                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                                            <Camera className="h-3.5 w-3.5" />
                                            {photoFile ? 'Change Photo' : 'Upload Photo'}
                                        </button>
                                        {photoPreview && <img src={photoPreview} alt="preview" className="h-10 w-10 object-cover rounded-md border" />}
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                </div>
                            )}

                            {/* Submit */}
                            <button id="btn-submit-entry" type="submit"
                                disabled={submitting || isFormLocked || !excelLoaded || !isMatch ||
                                    (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 transition-all ${
                                    submitting || isFormLocked || !excelLoaded || !isMatch ||
                                    (data.shop?.latitude && gpsStatus !== 'ok' && gpsStatus !== 'no_coords')
                                        ? 'bg-gray-300 cursor-not-allowed'
                                        : 'bg-teal-600 hover:bg-teal-700 shadow-sm'
                                }`}>
                                {submitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                                    : isFormLocked
                                    ? <><Lock className="h-4 w-4" /> Entry Locked</>
                                    : editId !== null
                                    ? <><Send className="h-4 w-4" /> Re-submit for Approval</>
                                    : <><Send className="h-4 w-4" /> Submit for Approval</>
                                }
                            </button>
                            {excelLoaded && !isFormLocked && (
                                <p className="text-[11px] text-center text-gray-400">
                                    Entry will be sent to admin for approval before it appears in final records.
                                </p>
                            )}
                        </form>
                    </div>

                    {/* ── MY ENTRIES ─────────────────────────────────── */}
                    <div className="lg:col-span-3 rounded-xl shadow-sm border overflow-hidden"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                        {/* Header */}
                        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>My Entries</h3>
                                <div className="flex items-center gap-2">
                                    <button id="btn-upload-excel" onClick={() => xlRef.current?.click()} disabled={xlLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all shadow-sm"
                                        style={{ background: xlLoading ? '#9ca3af' : 'linear-gradient(90deg,#059669,#10b981)' }}>
                                        {xlLoading
                                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…</>
                                            : <><FileSpreadsheet className="h-3.5 w-3.5" /> Upload Excel</>}
                                    </button>
                                    <input ref={xlRef} type="file" accept=".xls,.xlsx" className="hidden"
                                        onChange={(e) => handleExcelFile(e.target.files[0])} />
                                    <button onClick={fetchData} className="p-1 text-teal-600 hover:text-teal-800"><RefreshCw className="h-4 w-4" /></button>
                                </div>
                            </div>

                            {/* Date filter */}
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                <input type="date" value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-400"
                                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                                {dateFilter && (
                                    <button onClick={() => setDateFilter('')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                                        <X className="h-3 w-3" /> Clear
                                    </button>
                                )}
                            </div>

                            {/* Status messages */}
                            {xlSuccess && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5" />{xlSuccess}
                                </div>
                            )}
                            {xlError && (
                                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                                    <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                    <span className="flex-1">{xlError}</span>
                                    <button onClick={() => setXlError('')}><X className="h-3 w-3" /></button>
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                <thead style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        {['Date', 'Total Sale', 'Cash', 'RazorPay', 'QR/Card/Bank', 'Status', ''].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase"
                                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayEntries.map((e, idx) => {
                                        const status = e.approval_status || 'PENDING';
                                        return (
                                        <tr key={e.id || idx}
                                            className="cursor-pointer transition-colors hover:opacity-90"
                                            style={{ borderTop: '1px solid var(--border-color)', background: activeRowIdx === idx ? 'rgba(20,184,166,0.10)' : undefined }}
                                            onClick={() => { setActiveRowIdx(idx); loadEntryForEdit(e); }}>
                                            <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fmtDate(e.date)}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-teal-700">₹{Number(e.total_sale || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(e.cash || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(e.razorpay || 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(e.online ?? e.paytm ?? 0).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={status} />
                                                {status === 'REJECTED' && e.rejection_note && (
                                                    <p className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate" title={e.rejection_note}>
                                                        {e.rejection_note}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {status !== 'APPROVED' && (
                                                    <button type="button" title="Edit entry"
                                                        onClick={(ev) => { ev.stopPropagation(); loadEntryForEdit(e); }}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {displayEntries.length === 0 && (
                                        <tr><td colSpan="7" className="text-center py-12 text-gray-400 text-sm">No entries yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── EXCEL PREVIEW MODAL ──────────────────────────────────── */}
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
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        {previewData.previewRows.length} transaction row(s) · confirm to load Total Sale
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreview(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Info banner */}
                        <div className="mx-6 mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
                            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span>
                                <strong>Total Sale</strong> is auto-calculated as the sum of all Received Amount values.
                                You will enter <strong>Cash, RazorPay, and QR/Card/Bank</strong> manually after loading.
                            </span>
                        </div>

                        {/* Preview table */}
                        <div className="flex-1 overflow-auto mt-4">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0" style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        {['#', 'Date', 'Received Amount (₹)'].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                                                style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.previewRows.map((r, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }} className="hover:opacity-80">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                                                {r.date ? fmtDate(r.date) : <span className="text-gray-400 italic">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5 font-bold text-teal-700">
                                                ₹{r.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0 gap-4"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Sale (Sum of Received Amount)</p>
                                <p className="font-extrabold text-teal-700 text-xl">
                                    ₹{previewData.totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 text-sm font-semibold rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
                                    Cancel
                                </button>
                                <button id="btn-confirm-excel" onClick={confirmExcel}
                                    className="px-5 py-2 text-sm font-bold rounded-lg text-white transition-all shadow-md"
                                    style={{ background: 'linear-gradient(90deg,#059669,#10b981)' }}>
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
