import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    CheckCircle2, XCircle, Clock, Loader2, RefreshCw,
    Eye, AlertCircle, Building2, ArrowUpRight, Wallet,
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
const AdminManagerFundsPage = () => {
    const navigate = useNavigate();

    const [transfers,    setTransfers]    = useState([]);
    const [managers,     setManagers]     = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [acting,       setActing]       = useState(null);
    const [toast,        setToast]        = useState(null);
    const [filterStatus, setFilterStatus] = useState('pending');

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [txRes, mgrRes] = await Promise.all([
                api.get('/manager-transfers/all'),
                api.get('/manager-transfers/managers'),
            ]);
            setTransfers(txRes.data);
            setManagers(mgrRes.data);
        } catch {}
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = (type, text) => setToast({ type, text });

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

    const handleReject = async (id) => {
        setActing(id);
        try {
            await api.put(`/manager-transfers/${id}/reject`);
            showToast('success', 'Transfer rejected.');
            fetchAll();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Rejection failed.');
        } finally { setActing(null); }
    };

    const filtered     = transfers.filter(t => filterStatus === 'all' || t.status === filterStatus);
    const pendingCount = transfers.filter(t => t.status === 'pending').length;

    return (
        <Layout title="Manager Funds">

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

            {/* ── Manager Wallet Cards ─────────────────────────────── */}
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3"
                style={{ color: 'var(--text-secondary)' }}>Manager Wallets</h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
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
                    <div className="col-span-full py-10 text-center text-gray-400">No managers found.</div>
                )}
            </div>

            {/* ── Transfer Requests table ──────────────────────────── */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                {/* Table header */}
                <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Manager Transfer Requests
                        </h3>
                        {pendingCount > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold">
                                {pendingCount > 99 ? '99+' : pendingCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
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
                                {['Manager', 'Type', 'Amount', 'Note', 'Receipt', 'Status', 'Date', 'Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(t => {
                                const isActing = acting === t.id;
                                return (
                                    <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {t.manager_name}
                                            </p>
                                            <p className="text-xs text-gray-400">{t.manager_mobile}</p>
                                        </td>
                                        <td className="px-4 py-3"><TypeBadge type={t.type} /></td>
                                        <td className="px-4 py-3 font-bold text-emerald-600">
                                            ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[110px] truncate"
                                            style={{ color: 'var(--text-secondary)' }} title={t.note}>
                                            {t.note || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.receipt_url
                                                ? <a href={t.receipt_url} target="_blank" rel="noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />View
                                                </a>
                                                : <span className="text-gray-400 text-xs">—</span>}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {new Date(t.created_at).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApprove(t.id)} disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all"
                                                        style={{ background: isActing ? '#9ca3af' : 'linear-gradient(135deg,#059669,#10b981)' }}>
                                                        {isActing
                                                            ? <Loader2      className="h-3 w-3 animate-spin" />
                                                            : <CheckCircle2 className="h-3 w-3" />}
                                                        Approve
                                                    </button>
                                                    <button onClick={() => handleReject(t.id)} disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-all">
                                                        {isActing
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <XCircle className="h-3 w-3" />}
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400">
                                        No {filterStatus !== 'all' ? filterStatus : ''} transfers found.
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
