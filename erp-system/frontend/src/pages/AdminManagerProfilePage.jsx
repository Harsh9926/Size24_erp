import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Wallet, TrendingUp, ArrowUpRight, Building2,
    ArrowLeft, RefreshCw, CheckCircle2, ArrowDownCircle, ArrowUpCircle,
    BookOpen, Table2, Download,
} from 'lucide-react';

/* ── Flow type badge ─────────────────────────────────────────────── */
const FlowBadge = ({ type }) => {
    const cfg = {
        user_to_manager:  { cls: 'bg-emerald-100 text-emerald-700', label: 'User → Manager'  },
        admin_to_manager: { cls: 'bg-teal-100    text-teal-700',    label: 'Admin → Manager' },
        manager_to_admin: { cls: 'bg-blue-100    text-blue-700',    label: 'Manager → Admin' },
        manager_to_bank:  { cls: 'bg-purple-100  text-purple-700',  label: 'Manager → Bank'  },
        manager_expense:  { cls: 'bg-red-100     text-red-700',     label: 'Expense'          },
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

/* ── Passbook row helper ─────────────────────────────────────────── */
const isCredited = (row) => ['user_to_manager', 'admin_to_manager'].includes(row.flow_type);
const isSettled  = (row) => ['accepted', 'approved'].includes(row.status);

/* ── Page ─────────────────────────────────────────────────────────── */
const AdminManagerProfilePage = () => {
    const { id }       = useParams();
    const navigate     = useNavigate();
    const [data,      setData]      = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [view,      setView]      = useState('passbook'); // 'passbook' | 'table'

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/manager-transfers/summary/${id}`);
            setData(res.data);
        } catch {}
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* Build passbook rows with running balance — must be before early returns */
    const passbookRows = useMemo(() => {
        const rows = data?.history || [];
        // Calculate running balance oldest → newest
        const sorted = [...rows].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        let balance = 0;
        const withBalance = sorted.map((row) => {
            const credit = isCredited(row);
            const settled = isSettled(row);
            if (settled) balance += credit ? +row.amount : -row.amount;
            return { ...row, credit, settled, runningBalance: balance };
        });
        // Display newest first
        return withBalance.reverse();
    }, [data]);

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
            color: summary.wallet_balance >= 0 ? 'text-emerald-600' : 'text-red-600',
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
            label: 'Admin Gave',
            value: summary.received_from_admin,
            color: 'text-teal-600',
            bg:    'bg-teal-100',
            Icon:  ArrowDownCircle,
            hint:  'Admin top-ups received',
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
            label: 'Expenses',
            value: summary.expenses_logged,
            color: 'text-red-500',
            bg:    'bg-red-100',
            Icon:  ArrowUpCircle,
            hint:  'Approved expenses',
        },
        {
            label: 'Remaining Cash',
            value: summary.wallet_balance,
            color: summary.wallet_balance >= 0 ? 'text-emerald-600' : 'text-red-600',
            bg:    'bg-gray-100',
            Icon:  CheckCircle2,
            hint:  'Received + Admin Gave − Given to Admin − Bank − Expenses',
        },
    ];

    const downloadCSV = () => {
        const rows = view === 'passbook' ? passbookRows : history;
        let csvRows;

        if (view === 'passbook') {
            csvRows = [
                ['Date', 'Time', 'Type', 'From → To', 'Note', 'Status', 'Credit (+)', 'Debit (−)', 'Balance'],
                ...rows.map(row => {
                    const amt = parseFloat(row.amount);
                    const bal = row.runningBalance;
                    const date = new Date(row.created_at);
                    return [
                        date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                        date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                        row.flow_type,
                        row.from_name && row.to_name ? `${row.from_name} → ${row.to_name}` : row.from_name || row.to_name || '',
                        row.note || '',
                        row.status,
                        row.credit && row.settled ? amt.toFixed(2) : '',
                        !row.credit && row.settled ? amt.toFixed(2) : '',
                        row.settled ? bal.toFixed(2) : '',
                    ];
                }),
            ];
        } else {
            csvRows = [
                ['Type', 'Amount', 'From', 'To', 'Status', 'Note', 'Date'],
                ...rows.map(row => [
                    row.flow_type,
                    (isCredited(row) ? '+' : '-') + parseFloat(row.amount).toFixed(2),
                    row.from_name || '',
                    row.to_name || '',
                    row.status,
                    row.note || '',
                    new Date(row.created_at).toLocaleDateString('en-IN'),
                ]),
            ];
        }

        const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${manager.name}_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
                <strong>Wallet formula:</strong> Received from Users + Admin Gave − Given to Admin − Deposited to Bank − Expenses = Remaining Cash
            </div>

            {/* ── Transaction History ──────────────────────────────── */}
            <div className="rounded-xl border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

                {/* Header + view toggle */}
                <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Transaction History
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            Full cash trail: User → Manager → Admin / Bank
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg p-1 border"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <button onClick={() => setView('passbook')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'passbook' ? 'text-white shadow' : ''}`}
                                style={view === 'passbook' ? { background: '#FF6B00' } : { color: 'var(--text-secondary)' }}>
                                <BookOpen className="h-3.5 w-3.5" />Passbook
                            </button>
                            <button onClick={() => setView('table')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'table' ? 'text-white shadow' : ''}`}
                                style={view === 'table' ? { background: '#FF6B00' } : { color: 'var(--text-secondary)' }}>
                                <Table2 className="h-3.5 w-3.5" />Table
                            </button>
                        </div>
                        <button onClick={downloadCSV}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors hover:bg-orange-50"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                            title="Download CSV">
                            <Download className="h-3.5 w-3.5" />CSV
                        </button>
                    </div>
                </div>

                {/* ── PASSBOOK VIEW ─────────────────────────────────── */}
                {view === 'passbook' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead style={{ background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr>
                                    {['Date', 'Description', 'Ref / Note', 'Credit (+)', 'Debit (−)', 'Balance'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)', background: 'var(--bg-primary)', boxShadow: '0 1px 0 var(--border-color)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {passbookRows.map((row, i) => {
                                    const amt = parseFloat(row.amount);
                                    const bal = row.runningBalance;
                                    const fmtAmt = `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                    const fmtBal = `₹${Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                    return (
                                        <tr key={i}
                                            className={`transition-colors ${!row.settled ? 'opacity-60' : ''}`}
                                            style={{ borderTop: '1px solid var(--border-color)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-primary)' }}>

                                            {/* Date */}
                                            <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                                <div>{new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                <div className="text-[10px] opacity-60">{new Date(row.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>

                                            {/* Description */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {row.credit
                                                        ? <ArrowDownCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                        : <ArrowUpCircle   className="h-4 w-4 text-red-400    flex-shrink-0" />
                                                    }
                                                    <div>
                                                        <FlowBadge type={row.flow_type} />
                                                        {!row.settled && (
                                                            <span className="ml-1.5 text-[10px] font-bold text-amber-500 uppercase">pending</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs mt-1 ml-6" style={{ color: 'var(--text-secondary)' }}>
                                                    {row.from_name && row.to_name ? `${row.from_name} → ${row.to_name}` : row.from_name || row.to_name || ''}
                                                </div>
                                            </td>

                                            {/* Note / Receipt */}
                                            <td className="px-4 py-3 text-xs max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                                                {row.note && <div className="truncate" title={row.note}>{row.note}</div>}
                                                {row.receipt_url && (
                                                    <a href={row.receipt_url} target="_blank" rel="noreferrer"
                                                        className="text-blue-500 hover:underline">Receipt</a>
                                                )}
                                                {!row.note && !row.receipt_url && '—'}
                                            </td>

                                            {/* Credit */}
                                            <td className="px-4 py-3 text-right" style={{ borderLeft: '2px solid var(--border-color)' }}>
                                                {row.credit && row.settled ? (
                                                    <span className="font-bold text-emerald-600 border-b-2 border-emerald-400 pb-0.5">+{fmtAmt}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>

                                            {/* Debit */}
                                            <td className="px-4 py-3 text-right" style={{ borderLeft: '2px solid var(--border-color)' }}>
                                                {!row.credit && row.settled ? (
                                                    <span className="font-bold text-red-500 border-b-2 border-red-400 pb-0.5">−{fmtAmt}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>

                                            {/* Running Balance */}
                                            <td className="px-4 py-3 text-right">
                                                {row.settled ? (
                                                    <span className={`font-extrabold text-sm ${bal >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                                        {fmtBal}
                                                        <span className="text-[10px] font-semibold ml-0.5">{bal >= 0 ? 'Cr' : 'Dr'}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {passbookRows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-gray-400">
                                            No transactions yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── TABLE VIEW ───────────────────────────────────── */}
                {view === 'table' && (
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
                                        <td className={`px-4 py-3 font-bold ${isCredited(row) ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isCredited(row) ? '+' : '−'}₹{parseFloat(row.amount).toLocaleString('en-IN')}
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
                )}
            </div>
        </Layout>
    );
};

export default AdminManagerProfilePage;
