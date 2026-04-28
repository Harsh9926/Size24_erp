import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    ArrowUpRight, Building2, Upload, CheckCircle2, XCircle,
    Clock, AlertCircle, Loader2, RefreshCw, X, Wallet, FileText,
} from 'lucide-react';

/* ── Badges ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
    const cfg = {
        pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock,        label: 'Pending'  },
        approved: { cls: 'bg-green-100 text-green-700 border-green-200', Icon: CheckCircle2, label: 'Approved' },
        rejected: { cls: 'bg-red-100   text-red-700   border-red-200',   Icon: XCircle,      label: 'Rejected' },
    }[status] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Clock, label: status };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
            <cfg.Icon className="h-3 w-3" />{cfg.label}
        </span>
    );
};

const TypeBadge = ({ type }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
        type === 'manager_to_admin' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>
        {type === 'manager_to_admin'
            ? <><ArrowUpRight className="h-3 w-3" />To Admin</>
            : <><Building2    className="h-3 w-3" />To Bank</>}
    </span>
);

/* ── Page ─────────────────────────────────────────────────────────── */
const ManagerCashTransferPage = () => {
    const [activeTab,          setActiveTab]          = useState('admin');
    const [transfers,          setTransfers]          = useState([]);
    const [incomingTransfers,  setIncomingTransfers]  = useState([]);
    const [loading,            setLoading]            = useState(false);
    const [submitting,         setSubmitting]         = useState(false);
    const [actionLoading,      setActionLoading]      = useState({});
    const [walletBalance,      setWalletBalance]      = useState(0);
    const [toast,              setToast]              = useState(null);

    const [adminForm, setAdminForm] = useState({ amount: '', note: '' });
    const [bankForm,  setBankForm]  = useState({ amount: '', note: '' });
    const [receiptFile,    setReceiptFile]    = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);

    /* ── Data fetching ─────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [balRes, txRes, incomingRes] = await Promise.all([
                api.get('/transfers/balance'),
                api.get('/manager-transfers/mine'),
                api.get('/transfers/manager'),
            ]);
            setWalletBalance(parseFloat(balRes.data.balance || 0));
            setTransfers(txRes.data);
            setIncomingTransfers(incomingRes.data.filter(t => t.status === 'pending'));
        } catch {}
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = (type, text) => setToast({ type, text });

    /* ── Accept / Reject incoming user→manager transfer ───────────── */
    const handleAccept = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: 'accept' }));
        try {
            await api.put(`/transfers/${id}/accept`);
            showToast('success', 'Transfer accepted. Amount credited to your wallet.');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to accept transfer.');
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    const handleReject = async (id) => {
        setActionLoading(prev => ({ ...prev, [id]: 'reject' }));
        try {
            await api.put(`/transfers/${id}/reject`);
            showToast('success', 'Transfer rejected.');
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to reject transfer.');
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n; });
        }
    };

    /* ── Submit: Transfer to Admin ─────────────────────────────────── */
    const handleAdminSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(adminForm.amount);
        if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount.');
        if (amt > walletBalance)
            return showToast('error', `Amount exceeds wallet balance (₹${walletBalance.toFixed(2)}).`);

        setSubmitting(true);
        try {
            await api.post('/manager-transfers', {
                amount: amt,
                type:   'manager_to_admin',
                note:   adminForm.note,
            });
            showToast('success', 'Transfer request sent. Awaiting admin approval.');
            setAdminForm({ amount: '', note: '' });
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to send transfer.');
        } finally { setSubmitting(false); }
    };

    /* ── Submit: Bank Deposit ──────────────────────────────────────── */
    const handleBankSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(bankForm.amount);
        if (!amt || amt <= 0) return showToast('error', 'Enter a valid amount.');
        if (amt > walletBalance)
            return showToast('error', `Amount exceeds wallet balance (₹${walletBalance.toFixed(2)}).`);
        if (!receiptFile) return showToast('error', 'Receipt upload is mandatory for bank deposits.');

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('amount',  amt);
            fd.append('type',    'manager_to_bank');
            fd.append('note',    bankForm.note);
            fd.append('receipt', receiptFile);

            await api.post('/manager-transfers', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            showToast('success', 'Bank deposit request sent. Awaiting admin approval.');
            setBankForm({ amount: '', note: '' });
            clearReceipt();
            fetchData();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to send request.');
        } finally { setSubmitting(false); }
    };

    /* ── Receipt file handling ─────────────────────────────────────── */
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setReceiptFile(file);
        if (file.type === 'application/pdf') {
            setReceiptPreview('pdf');
        } else {
            const reader = new FileReader();
            reader.onload = (ev) => setReceiptPreview(ev.target.result);
            reader.readAsDataURL(file);
        }
    };
    const clearReceipt = () => { setReceiptFile(null); setReceiptPreview(null); };

    /* ── Derived stats for the sidebar summary ─────────────────────── */
    const pendingCount   = transfers.filter(t => t.status === 'pending').length;
    const approvedAdmin  = transfers
        .filter(t => t.type === 'manager_to_admin' && t.status === 'approved')
        .reduce((s, t) => s + parseFloat(t.amount), 0);
    const approvedBank   = transfers
        .filter(t => t.type === 'manager_to_bank'  && t.status === 'approved')
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    /* ── Shared styles ─────────────────────────────────────────────── */
    const inputCls   = 'w-full px-4 py-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';
    const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
    const labelCls   = 'block text-xs font-semibold uppercase tracking-wide mb-1.5';

    return (
        <Layout title="Cash Transfer">

            {/* Toast */}
            {toast && (
                <div className={`mb-5 flex items-center gap-3 px-5 py-3.5 rounded-xl border text-sm font-medium ${
                    toast.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success'
                        ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        : <AlertCircle  className="h-5 w-5 text-red-600   flex-shrink-0" />}
                    <span className="flex-1">{toast.text}</span>
                </div>
            )}

            {/* Wallet Balance banner */}
            <div className="flex items-center justify-between mb-6 px-6 py-4 rounded-2xl text-white"
                style={{ background: 'linear-gradient(135deg,#FF6B00,#ff9a00)' }}>
                <div>
                    <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide">Available Balance</p>
                    <p className="text-3xl font-extrabold mt-1">
                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-orange-200" />
                    <button onClick={fetchData} disabled={loading}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                        <RefreshCw className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Pending Requests from Users ────────────────────────── */}
            {incomingTransfers.length > 0 && (
                <div className="rounded-xl border shadow-sm overflow-hidden mb-6"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="px-6 py-4 border-b flex items-center gap-2"
                        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Pending Requests from Users
                        </h3>
                        <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                            {incomingTransfers.length}
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead style={{ background: 'var(--bg-primary)' }}>
                                <tr>
                                    {['From', 'Amount', 'Note', 'Date', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {incomingTransfers.map(t => (
                                    <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {t.from_name}
                                            <span className="block text-xs text-gray-400">{t.from_mobile}</span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-emerald-600">
                                            ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[140px] truncate"
                                            style={{ color: 'var(--text-secondary)' }} title={t.note}>
                                            {t.note || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(t.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAccept(t.id)}
                                                    disabled={!!actionLoading[t.id]}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg text-white flex items-center gap-1 transition-all"
                                                    style={{ background: actionLoading[t.id] ? '#9ca3af' : '#16a34a' }}>
                                                    {actionLoading[t.id] === 'accept'
                                                        ? <Loader2       className="h-3 w-3 animate-spin" />
                                                        : <CheckCircle2  className="h-3 w-3" />}
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => handleReject(t.id)}
                                                    disabled={!!actionLoading[t.id]}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg text-white flex items-center gap-1 transition-all"
                                                    style={{ background: actionLoading[t.id] ? '#9ca3af' : '#dc2626' }}>
                                                    {actionLoading[t.id] === 'reject'
                                                        ? <Loader2  className="h-3 w-3 animate-spin" />
                                                        : <XCircle  className="h-3 w-3" />}
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

                {/* ── Transfer Form (3 cols) ─────────────────────────── */}
                <div className="lg:col-span-3 rounded-2xl border shadow-sm overflow-hidden"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                    {/* Tab buttons */}
                    <div className="flex border-b" style={{ borderColor: 'var(--border-color)' }}>
                        {[
                            { id: 'admin', label: 'Transfer to Admin', Icon: ArrowUpRight },
                            { id: 'bank',  label: 'Deposit to Bank',   Icon: Building2   },
                        ].map(({ id, label, Icon }) => (
                            <button key={id} onClick={() => setActiveTab(id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-all ${
                                    activeTab === id ? 'text-white' : 'text-gray-500 hover:text-gray-800'
                                }`}
                                style={activeTab === id ? { background: '#FF6B00' } : {}}>
                                <Icon className="h-4 w-4" />{label}
                            </button>
                        ))}
                    </div>

                    {/* ── Admin Transfer form ──────────────────────────── */}
                    {activeTab === 'admin' && (
                        <form onSubmit={handleAdminSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 mb-2">
                                Transfer physical cash directly to the Admin. Admin will approve and deduct from your wallet.
                            </p>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
                                <input type="number" min="1" step="0.01" required
                                    value={adminForm.amount}
                                    onChange={e => setAdminForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="e.g. 5000"
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                                <textarea rows={3}
                                    value={adminForm.note}
                                    onChange={e => setAdminForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="Add context for the admin…"
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <button type="submit" disabled={submitting}
                                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                style={{ background: submitting ? '#9ca3af' : '#FF6B00' }}>
                                {submitting
                                    ? <Loader2      className="h-4 w-4 animate-spin" />
                                    : <ArrowUpRight className="h-4 w-4" />}
                                {submitting ? 'Sending…' : 'Send to Admin'}
                            </button>
                        </form>
                    )}

                    {/* ── Bank Deposit form ────────────────────────────── */}
                    {activeTab === 'bank' && (
                        <form onSubmit={handleBankSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 mb-2">
                                Deposited cash to bank? Upload the receipt and submit for admin approval.
                            </p>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Amount (₹)</label>
                                <input type="number" min="1" step="0.01" required
                                    value={bankForm.amount}
                                    onChange={e => setBankForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="e.g. 2500"
                                    className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Note (optional)</label>
                                <textarea rows={2}
                                    value={bankForm.note}
                                    onChange={e => setBankForm(f => ({ ...f, note: e.target.value }))}
                                    placeholder="Bank name, account number, branch…"
                                    className={inputCls} style={inputStyle} />
                            </div>

                            {/* Receipt upload */}
                            <div>
                                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                                    Bank Receipt <span className="text-red-500 normal-case font-normal">* required</span>
                                </label>

                                {receiptPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border"
                                        style={{ borderColor: 'var(--border-color)' }}>
                                        {receiptPreview === 'pdf' ? (
                                            <div className="flex items-center gap-3 px-4 py-5 bg-blue-50">
                                                <FileText className="h-8 w-8 text-blue-600" />
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-700">PDF Receipt</p>
                                                    <p className="text-xs text-blue-500 truncate max-w-[220px]">{receiptFile?.name}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <img src={receiptPreview} alt="Receipt preview"
                                                className="w-full max-h-44 object-cover" />
                                        )}
                                        <button type="button" onClick={clearReceipt}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center gap-2 py-7 border-2 border-dashed rounded-xl cursor-pointer hover:border-orange-400 transition-colors"
                                        style={{ borderColor: 'var(--border-color)' }}>
                                        <Upload className="h-8 w-8 text-gray-400" />
                                        <p className="text-sm font-medium text-gray-500">Click to upload receipt</p>
                                        <p className="text-xs text-gray-400">JPG, PNG, WEBP or PDF · max 5 MB</p>
                                        <input type="file" accept="image/*,application/pdf"
                                            onChange={handleFileChange} className="hidden" />
                                    </label>
                                )}
                            </div>

                            <button type="submit" disabled={submitting}
                                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                style={{ background: submitting ? '#9ca3af' : '#8b5cf6' }}>
                                {submitting
                                    ? <Loader2   className="h-4 w-4 animate-spin" />
                                    : <Building2 className="h-4 w-4" />}
                                {submitting ? 'Submitting…' : 'Submit Bank Deposit'}
                            </button>
                        </form>
                    )}
                </div>

                {/* ── Summary Sidebar (2 cols) ───────────────────────── */}
                <div className="lg:col-span-2 space-y-4">
                    {[
                        {
                            label: 'Pending Approval',
                            value: pendingCount,
                            suffix: pendingCount === 1 ? 'request' : 'requests',
                            color: 'text-amber-600',
                            bg:    'bg-amber-50',
                            Icon:  Clock,
                            desc:  'Awaiting admin decision',
                        },
                        {
                            label: 'Approved (Admin)',
                            value: `₹${approvedAdmin.toLocaleString('en-IN')}`,
                            color: 'text-blue-600',
                            bg:    'bg-blue-50',
                            Icon:  ArrowUpRight,
                            desc:  'Total transferred to admin',
                        },
                        {
                            label: 'Approved (Bank)',
                            value: `₹${approvedBank.toLocaleString('en-IN')}`,
                            color: 'text-purple-600',
                            bg:    'bg-purple-50',
                            Icon:  Building2,
                            desc:  'Total deposited to bank',
                        },
                    ].map(({ label, value, suffix, color, bg, Icon, desc }) => (
                        <div key={label} className="rounded-xl p-5 border flex items-center gap-4"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <div className={`p-3 rounded-xl flex-shrink-0 ${bg}`}>
                                <Icon className={`h-5 w-5 ${color}`} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                <p className={`text-xl font-extrabold mt-0.5 ${color}`}>
                                    {value}{suffix ? <span className="text-sm font-normal ml-1">{suffix}</span> : ''}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Transfer History ───────────────────────────────────── */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Transfer History
                    </h3>
                    <button onClick={fetchData} disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-orange-600 hover:underline font-medium">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Type', 'Amount', 'Note', 'Receipt', 'Status', 'Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map(t => (
                                <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                                        ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-xs max-w-[140px] truncate"
                                        style={{ color: 'var(--text-secondary)' }} title={t.note}>
                                        {t.note || '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.receipt_url
                                            ? <a href={t.receipt_url} target="_blank" rel="noreferrer"
                                                className="text-xs text-blue-600 hover:underline">View</a>
                                            : <span className="text-xs text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {new Date(t.created_at).toLocaleDateString('en-IN')}
                                    </td>
                                </tr>
                            ))}
                            {transfers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        No transfer history yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default ManagerCashTransferPage;
