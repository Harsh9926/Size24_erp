import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Wallet, TrendingUp, ArrowUpRight, Building2,
    ArrowLeft, RefreshCw, CheckCircle2,
} from 'lucide-react';

/* ── Flow type badge ─────────────────────────────────────────────── */
const FlowBadge = ({ type }) => {
    const cfg = {
        user_to_manager:  { cls: 'bg-emerald-100 text-emerald-700', label: 'User → Manager' },
        manager_to_admin: { cls: 'bg-blue-100    text-blue-700',    label: 'Manager → Admin' },
        manager_to_bank:  { cls: 'bg-purple-100  text-purple-700',  label: 'Manager → Bank'  },
    }[type] || { cls: 'bg-gray-100 text-gray-600', label: type };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
};

/* ── Status chip ─────────────────────────────────────────────────── */
const StatusChip = ({ status }) => {
    const cls =
        status === 'accepted' || status === 'approved' ? 'bg-green-100 text-green-700' :
        status === 'pending'                           ? 'bg-amber-100 text-amber-700' :
                                                         'bg-red-100   text-red-700';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>
            {status}
        </span>
    );
};

/* ── Page ─────────────────────────────────────────────────────────── */
const AdminManagerProfilePage = () => {
    const { id }       = useParams();
    const navigate     = useNavigate();
    const [data,      setData]      = useState(null);
    const [loading,   setLoading]   = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/manager-transfers/summary/${id}`);
            setData(res.data);
        } catch {}
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) return (
        <Layout title="Manager Profile">
            <div className="text-center py-20 text-gray-400 animate-pulse">Loading…</div>
        </Layout>
    );
    if (!data) return (
        <Layout title="Manager Profile">
            <div className="text-center py-20 text-gray-400">Manager not found.</div>
        </Layout>
    );

    const { manager, summary, history } = data;

    const summaryCards = [
        {
            label: 'Wallet Balance',
            value: summary.wallet_balance,
            color: 'text-orange-600',
            bg:    'bg-orange-100',
            Icon:  Wallet,
            hint:  'Current cash in hand',
        },
        {
            label: 'Received from Users',
            value: summary.received_from_users,
            color: 'text-emerald-600',
            bg:    'bg-emerald-100',
            Icon:  TrendingUp,
            hint:  'Total accepted inflows',
        },
        {
            label: 'Given to Admin',
            value: summary.transferred_to_admin,
            color: 'text-blue-600',
            bg:    'bg-blue-100',
            Icon:  ArrowUpRight,
            hint:  'Approved admin transfers',
        },
        {
            label: 'Deposited to Bank',
            value: summary.deposited_to_bank,
            color: 'text-purple-600',
            bg:    'bg-purple-100',
            Icon:  Building2,
            hint:  'Approved bank deposits',
        },
        {
            label: 'Remaining Cash',
            value: summary.remaining_cash,
            color: 'text-gray-700',
            bg:    'bg-gray-100',
            Icon:  CheckCircle2,
            hint:  '= wallet balance',
        },
    ];

    return (
        <Layout title={`Manager: ${manager.name}`}>

            {/* Back */}
            <button onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm font-medium mb-6 hover:text-orange-600 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <ArrowLeft className="h-4 w-4" />Back
            </button>

            {/* Manager header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {manager.name}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {manager.mobile}
                    </p>
                </div>
                <button onClick={fetchData} disabled={loading}
                    className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-orange-50"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* ── Summary Cards ────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
                {summaryCards.map(({ label, value, color, bg, Icon, hint }) => (
                    <div key={label} className="rounded-xl p-4 border shadow-sm"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide leading-tight mb-1"
                            style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        <p className={`text-xl font-extrabold ${color}`}>
                            ₹{parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{hint}</p>
                    </div>
                ))}
            </div>

            {/* ── Formula note ─────────────────────────────────────── */}
            <div className="mb-6 px-4 py-3 rounded-xl text-xs font-medium"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderLeft: '3px solid #FF6B00' }}>
                <strong>Wallet formula:</strong> Received from Users − Given to Admin − Deposited to Bank = Remaining Cash
            </div>

            {/* ── Transaction History ──────────────────────────────── */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Transaction History
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Full cash trail: User → Manager → Admin / Bank
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['Type', 'Amount', 'From', 'To', 'Status', 'Receipt', 'Note', 'Date'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((row, i) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3"><FlowBadge type={row.flow_type} /></td>
                                    <td className="px-4 py-3 font-bold text-emerald-600">
                                        ₹{parseFloat(row.amount).toLocaleString('en-IN')}
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                                        {row.from_name || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                                        {row.to_name || '—'}
                                    </td>
                                    <td className="px-4 py-3"><StatusChip status={row.status} /></td>
                                    <td className="px-4 py-3">
                                        {row.receipt_url
                                            ? <a href={row.receipt_url} target="_blank" rel="noreferrer"
                                                className="text-xs text-blue-600 hover:underline">View</a>
                                            : <span className="text-xs text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-xs max-w-[120px] truncate"
                                        style={{ color: 'var(--text-secondary)' }} title={row.note}>
                                        {row.note || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs whitespace-nowrap"
                                        style={{ color: 'var(--text-secondary)' }}>
                                        {new Date(row.created_at).toLocaleDateString('en-IN')}
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-gray-400">
                                        No transactions yet.
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

export default AdminManagerProfilePage;
