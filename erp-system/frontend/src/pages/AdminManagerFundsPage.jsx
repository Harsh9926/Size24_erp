import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    CheckCircle2, XCircle, Clock, Loader2, RefreshCw,
    Eye, AlertCircle, Building2, ArrowUpRight, ArrowDownRight,
    Wallet, Users, Store,
} from 'lucide-react';

/* ── Badges ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
    const s = status === 'accepted' ? 'approved' : status;
    const cfg = {
        pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock,        label: 'Pending'  },
        approved: { cls: 'bg-green-100 text-green-700 border-green-200', Icon: CheckCircle2, label: 'Approved' },
        rejected: { cls: 'bg-red-100   text-red-700   border-red-200',   Icon: XCircle,      label: 'Rejected' },
    }[s] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Clock, label: s };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
            <cfg.Icon className="h-3 w-3" />{cfg.label}
        </span>
    );
};

const TypeBadge = ({ type }) => {
    const map = {
        user_to_manager: { cls: 'bg-teal-100 text-teal-700',     Icon: ArrowDownRight, label: 'User → Manager'   },
        manager_to_admin:{ cls: 'bg-blue-100 text-blue-700',     Icon: ArrowUpRight,   label: 'Manager → Admin'  },
        manager_to_bank: { cls: 'bg-purple-100 text-purple-700', Icon: Building2,      label: 'Manager → Bank'   },
    };
    const { cls, Icon, label } = map[type] || { cls: 'bg-gray-100 text-gray-600', Icon: Clock, label: type };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>
            <Icon className="h-3 w-3" />{label}
        </span>
    );
};

/* ── Reject Modal ─────────────────────────────────────────────────── */
const RejectModal = ({ open, onClose, onConfirm, acting }) => {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (open) setNote('');
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-xl">
                        <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Reject Transfer</h3>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                    Please provide a reason for rejecting this transfer. This will be saved for the manager's reference.
                </p>
                <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Enter rejection reason…"
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
                <div className="flex gap-3 mt-4 justify-end">
                    <button
                        onClick={onClose}
                        disabled={acting}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(note)}
                        disabled={!note.trim() || acting}
                        className="px-4 py-2 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50 flex items-center gap-2"
                        style={{ background: (!note.trim() || acting) ? '#9ca3af' : 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
                        {acting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Confirm Reject
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Page ─────────────────────────────────────────────────────────── */
const AdminManagerFundsPage = () => {
    const navigate = useNavigate();

    const [transfers,     setTransfers]     = useState([]);
    const [managers,      setManagers]      = useState([]);
    const [storeWallets,  setStoreWallets]  = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [acting,        setActing]        = useState(null);
    const [toast,         setToast]         = useState(null);
    const [filterStatus,  setFilterStatus]  = useState('pending');
    const [filterType,    setFilterType]    = useState('all');
    const [filterManager, setFilterManager] = useState('');
    const [walletView,    setWalletView]    = useState('all'); // 'all' | 'manager' | 'store'

    // Reject modal state
    const [rejectModal, setRejectModal] = useState({ open: false, id: null });

    /* ── Data fetching ─────────────────────────────────────────────── */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [txRes, mgrRes, storeRes] = await Promise.allSettled([
            api.get('/manager-transfers/all'),
            api.get('/manager-transfers/managers'),
            api.get('/manager-transfers/store-wallets'),
        ]);
        if (txRes.status    === 'fulfilled') setTransfers(txRes.value.data      || []);
        if (mgrRes.status   === 'fulfilled') setManagers(mgrRes.value.data      || []);
        if (storeRes.status === 'fulfilled') setStoreWallets(storeRes.value.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = (type, text) => setToast({ type, text });

    /* ── Approve ───────────────────────────────────────────────────── */
    const handleApprove = async (id) => {
        setActing(id);
        try {
            await api.put(`/manager-transfers/${id}/approve`);
            showToast('success', 'Transfer approved — manager wallet debited.');
            fetchAll();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Approval failed.');
        } finally { setActing(null); }
    };

    /* ── Reject (modal) ────────────────────────────────────────────── */
    const openRejectModal  = (id) => setRejectModal({ open: true, id });
    const closeRejectModal = ()   => setRejectModal({ open: false, id: null });

    const handleRejectConfirm = async (note) => {
        const id = rejectModal.id;
        closeRejectModal();
        setActing(id);
        try {
            await api.put(`/manager-transfers/${id}/reject`, { rejection_note: note });
            showToast('success', 'Transfer rejected.');
            fetchAll();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Rejection failed.');
        } finally { setActing(null); }
    };

    /* ── Filter logic ──────────────────────────────────────────────── */
    const filtered = transfers.filter(t => {
        const normalStatus = t.status === 'accepted' ? 'approved' : t.status;
        if (filterStatus  !== 'all' && normalStatus    !== filterStatus)  return false;
        if (filterType    !== 'all' && t.type          !== filterType)    return false;
        if (filterManager && String(t.manager_id)      !== filterManager) return false;
        return true;
    });

    const pendingCount = transfers.filter(t =>
        t.status === 'pending' && t.type !== 'user_to_manager'
    ).length;

    /* ── Summary cards ─────────────────────────────────────────────── */
    const totalReceived = transfers
        .filter(t => t.type === 'user_to_manager' && ['approved', 'accepted'].includes(t.status))
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    const totalToAdmin = transfers
        .filter(t => t.type === 'manager_to_admin' && t.status === 'approved')
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    const totalToBank = transfers
        .filter(t => t.type === 'manager_to_bank' && t.status === 'approved')
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    const fmtAmt = v => `₹${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const showManagers = walletView === 'all' || walletView === 'manager';
    const showStores   = walletView === 'all' || walletView === 'store';

    return (
        <Layout title="Manager Funds">

            {/* Reject Modal */}
            <RejectModal
                open={rejectModal.open}
                onClose={closeRejectModal}
                onConfirm={handleRejectConfirm}
                acting={acting !== null}
            />

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

            {/* ── Summary Strip ────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Managers',          value: managers.length,        color: 'text-orange-600', bg: 'bg-orange-100',  Icon: Users        },
                    { label: 'User→Mgr Received', value: fmtAmt(totalReceived),  color: 'text-teal-600',   bg: 'bg-teal-100',   Icon: ArrowDownRight },
                    { label: 'Sent to Admin',      value: fmtAmt(totalToAdmin),   color: 'text-blue-600',   bg: 'bg-blue-100',   Icon: ArrowUpRight   },
                    { label: 'Deposited to Bank',  value: fmtAmt(totalToBank),    color: 'text-purple-600', bg: 'bg-purple-100', Icon: Building2      },
                ].map(({ label, value, color, bg, Icon }) => (
                    <div key={label} className="rounded-xl p-4 border shadow-sm"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: 'var(--text-secondary)' }}>{label}</p>
                            <div className={`p-1.5 rounded-lg ${bg}`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                        </div>
                        <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Wallet Section Header + Filter ───────────────────── */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-secondary)' }}>Wallets</h3>
                <div className="flex gap-1 p-1 rounded-lg border"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    {[
                        { key: 'all',     label: 'All'     },
                        { key: 'manager', label: 'Managers' },
                        { key: 'store',   label: 'Stores'  },
                    ].map(({ key, label }) => (
                        <button key={key} onClick={() => setWalletView(key)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                walletView === key
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Manager Wallet Cards ─────────────────────────────── */}
            {showManagers && (
                <>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        <Users className="h-3.5 w-3.5" /> Manager Wallets
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                        {managers.map(mgr => (
                            <div key={mgr.id}
                                className="rounded-xl p-4 border cursor-pointer hover:border-orange-400 transition-all group"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                                onClick={() => navigate(`/admin/manager/${mgr.id}`)}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 rounded-lg bg-orange-100">
                                        <Wallet className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <Eye className="h-3.5 w-3.5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                </div>
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {mgr.name}
                                </p>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{mgr.mobile}</p>
                                <p className="text-lg font-extrabold text-orange-600">
                                    ₹{parseFloat(mgr.wallet_balance || 0).toLocaleString('en-IN')}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    wallet balance · click for full trail
                                </p>
                            </div>
                        ))}
                        {managers.length === 0 && !loading && (
                            <div className="col-span-full py-8 text-center text-gray-400 text-sm">No managers found.</div>
                        )}
                    </div>
                </>
            )}

            {/* ── Store Wallet Cards ────────────────────────────────── */}
            {showStores && (
                <>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        <Store className="h-3.5 w-3.5" /> Store Wallets
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                        {storeWallets.map(sw => (
                            <div key={sw.shop_id}
                                className="rounded-xl p-4 border"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-1.5 rounded-lg bg-teal-100">
                                        <Store className="h-4 w-4 text-teal-600" />
                                    </div>
                                    <span className="text-[10px] font-medium text-gray-400">
                                        #{sw.shop_id}
                                    </span>
                                </div>
                                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {sw.shop_name}
                                </p>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    {sw.user_name || 'No user assigned'}
                                </p>
                                <p className="text-lg font-extrabold text-teal-600">
                                    ₹{parseFloat(sw.wallet_balance || 0).toLocaleString('en-IN')}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    store wallet balance
                                </p>
                            </div>
                        ))}
                        {storeWallets.length === 0 && !loading && (
                            <div className="col-span-full py-8 text-center text-gray-400 text-sm">No stores found.</div>
                        )}
                    </div>
                </>
            )}

            {/* ── Transfer Table ───────────────────────────────────── */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                {/* Header + filters */}
                <div className="px-6 py-4 border-b flex flex-wrap items-center gap-3 justify-between"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            All Transfer Requests
                        </h3>
                        {pendingCount > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold">
                                {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={filterManager}
                            onChange={e => setFilterManager(e.target.value)}
                            className="px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Managers</option>
                            {managers.map(m => (
                                <option key={m.id} value={String(m.id)}>{m.name}</option>
                            ))}
                        </select>

                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                            className="px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="all">All Types</option>
                            <option value="user_to_manager">User → Manager</option>
                            <option value="manager_to_admin">Manager → Admin</option>
                            <option value="manager_to_bank">Manager → Bank</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All</option>
                        </select>

                        <button onClick={fetchAll} disabled={loading}
                            className="flex items-center gap-1.5 text-xs text-orange-600 hover:underline font-medium">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Manager', 'Type', 'From / Note', 'Amount', 'Receipt', 'Status', 'Date', 'Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(t => {
                                const isActing = acting === t.id;
                                const canAct   = t.status === 'pending' && t.type !== 'user_to_manager';
                                return (
                                    <tr key={`${t.type}-${t.id}`}
                                        style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {t.manager_name}
                                            </p>
                                            <p className="text-xs text-gray-400">{t.manager_mobile}</p>
                                        </td>

                                        <td className="px-4 py-3">
                                            <TypeBadge type={t.type} />
                                        </td>

                                        <td className="px-4 py-3 max-w-[140px]">
                                            {t.from_name && (
                                                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                                    {t.from_name}
                                                </p>
                                            )}
                                            {t.note && (
                                                <p className="text-xs truncate text-gray-400" title={t.note}>
                                                    {t.note}
                                                </p>
                                            )}
                                            {!t.from_name && !t.note && (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">
                                            ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                        </td>

                                        <td className="px-4 py-3">
                                            {t.receipt_url
                                                ? <a href={t.receipt_url} target="_blank" rel="noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />View
                                                </a>
                                                : <span className="text-gray-400 text-xs">—</span>}
                                        </td>

                                        <td className="px-4 py-3">
                                            <StatusBadge status={t.status} />
                                        </td>

                                        <td className="px-4 py-3 text-xs whitespace-nowrap"
                                            style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(t.created_at).toLocaleDateString('en-IN')}
                                        </td>

                                        <td className="px-4 py-3">
                                            {canAct ? (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApprove(t.id)} disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all"
                                                        style={{ background: isActing ? '#9ca3af' : 'linear-gradient(135deg,#059669,#10b981)' }}>
                                                        {isActing
                                                            ? <Loader2      className="h-3 w-3 animate-spin" />
                                                            : <CheckCircle2 className="h-3 w-3" />}
                                                        Approve
                                                    </button>
                                                    <button onClick={() => openRejectModal(t.id)} disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-all">
                                                        {isActing
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <XCircle className="h-3 w-3" />}
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : t.type === 'user_to_manager' && t.status === 'pending' ? (
                                                <span className="text-xs text-gray-400 italic">Manager action</span>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400">
                                        No transfers found for the selected filters.
                                    </td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400 animate-pulse">
                                        Loading…
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

export default AdminManagerFundsPage;
