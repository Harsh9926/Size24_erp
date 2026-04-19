import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    Store, Wallet, ArrowRightLeft, CheckCircle2, XCircle,
    Loader2, Clock, ShieldCheck, ShieldX, RefreshCw,
} from 'lucide-react';

/* ── Status badge ───────────────────────────────────────────────── */
const TransferBadge = ({ status }) => {
    const cfg = {
        pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock,       label: 'Pending'  },
        accepted: { cls: 'bg-green-100 text-green-700 border-green-200', Icon: ShieldCheck, label: 'Accepted' },
        rejected: { cls: 'bg-red-100   text-red-700   border-red-200',   Icon: ShieldX,     label: 'Rejected' },
    }[status] || { cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Clock, label: status };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${cfg.cls}`}>
            <cfg.Icon className="h-3 w-3" />{cfg.label}
        </span>
    );
};

const ManagerDashboard = () => {
    const [data,      setData]      = useState({ summary: {}, chartData: [], latestEntries: [], shops: [] });
    const [loading,   setLoading]   = useState(true);
    const [transfers, setTransfers] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [txAction,  setTxAction]  = useState(null); // id being acted on
    const [walletBalance, setWalletBalance] = useState(0);
    const [toast,     setToast]     = useState(null);

    /* ── Fetch dashboard ────────────────���───────────────────────── */
    useEffect(() => {
        api.get('/dashboard/manager')
            .then(r => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
        fetchBalance();
        fetchTransfers();
    }, []);

    /* ── Auto-dismiss toast ─────────────────────────────────────── */
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(t);
    }, [toast]);

    const fetchBalance = async () => {
        try {
            const res = await api.get('/transfers/balance');
            setWalletBalance(res.data.balance);
        } catch {}
    };

    const fetchTransfers = useCallback(async () => {
        setTxLoading(true);
        try {
            const res = await api.get('/transfers/manager');
            setTransfers(res.data);
        } catch (err) {
            console.error('[ManagerDashboard] fetchTransfers error:', err);
        } finally {
            setTxLoading(false);
        }
    }, []);

    const handleAccept = async (id) => {
        setTxAction(id);
        try {
            await api.put(`/transfers/${id}/accept`);
            setToast({ type: 'success', text: 'Transfer accepted. Balance updated.' });
            fetchTransfers();
            fetchBalance();
        } catch (err) {
            setToast({ type: 'error', text: err.response?.data?.error || 'Accept failed.' });
        } finally {
            setTxAction(null);
        }
    };

    const handleReject = async (id) => {
        setTxAction(id);
        try {
            await api.put(`/transfers/${id}/reject`);
            setToast({ type: 'success', text: 'Transfer rejected.' });
            fetchTransfers();
        } catch (err) {
            setToast({ type: 'error', text: err.response?.data?.error || 'Reject failed.' });
        } finally {
            setTxAction(null);
        }
    };

    const pendingTransfers = transfers.filter(t => t.status === 'pending');

    const cards = [
        { label: 'Total Sales',  value: data.summary?.total_sales,  color: 'text-emerald-600' },
        { label: 'Total Cash',   value: data.summary?.total_cash,   color: 'text-blue-600'    },
        { label: 'Total Online', value: data.summary?.total_online, color: 'text-purple-600'  },
    ];

    if (loading) return (
        <Layout title="Manager Dashboard">
            <div className="text-center py-20 text-gray-400 animate-pulse">Loading...</div>
        </Layout>
    );

    return (
        <Layout title="Manager Dashboard">
            {/* Toast */}
            {toast && (
                <div className={`mb-4 flex items-center gap-3 px-5 py-3.5 rounded-xl border text-sm font-medium ${
                    toast.type === 'success'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.type === 'success'
                        ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        : <XCircle      className="h-5 w-5 text-red-600   flex-shrink-0" />}
                    <span className="flex-1">{toast.text}</span>
                </div>
            )}

            {/* Assigned shops */}
            {data.shops?.length > 0 && (
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                    <span className="text-sm font-semibold text-gray-600">Assigned Shops:</span>
                    {data.shops.map(s => (
                        <span key={s.id} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                            <Store className="h-3 w-3" /> {s.shop_name}
                        </span>
                    ))}
                </div>
            )}

            {/* KPI Cards + Wallet */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {cards.map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-5 shadow-sm border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        <p className={`text-2xl font-bold ${color}`}>₹{Number(value || 0).toLocaleString('en-IN')}</p>
                    </div>
                ))}
                {/* Wallet Balance */}
                <div className="rounded-xl p-5 shadow-sm"
                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderColor: 'transparent' }}>
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-indigo-200 uppercase">Wallet Balance</p>
                        <Wallet className="h-4 w-4 text-indigo-300" />
                    </div>
                    <p className="text-2xl font-extrabold text-white">
                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    {pendingTransfers.length > 0 && (
                        <p className="text-xs text-indigo-300 mt-1 font-medium">
                            {pendingTransfers.length} transfer{pendingTransfers.length > 1 ? 's' : ''} awaiting review
                        </p>
                    )}
                </div>
            </div>

            {/* ── Pending Transfers Panel ──────────────────────────── */}
            <div className="rounded-xl border shadow-sm mb-6 overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Cash Transfers
                        </h3>
                        {pendingTransfers.length > 0 && (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                                {pendingTransfers.length}
                            </span>
                        )}
                    </div>
                    <button onClick={fetchTransfers} disabled={txLoading}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium">
                        <RefreshCw className={`h-3.5 w-3.5 ${txLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>
                                {['From', 'Amount', 'Note', 'Date', 'Status', 'Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.map(t => {
                                const isActing = txAction === t.id;
                                return (
                                    <tr key={t.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {t.from_name || '—'}
                                            <p className="text-xs text-gray-400">{t.from_mobile}</p>
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
                                            <TransferBadge status={t.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleAccept(t.id)}
                                                        disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-all"
                                                        style={{ background: isActing ? '#9ca3af' : 'linear-gradient(135deg,#059669,#10b981)' }}>
                                                        {isActing
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <CheckCircle2 className="h-3 w-3" />}
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(t.id)}
                                                        disabled={isActing}
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-red-300 text-red-600 hover:bg-red-50 transition-all">
                                                        {isActing
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <XCircle  className="h-3 w-3" />}
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {transfers.length === 0 && !txLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-400">
                                        No transfers yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-xl shadow-sm border p-6 mb-6"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Performance</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="sales"  name="Sales"  fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cash"   name="Cash"   fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="online" name="Online" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Entries */}
            <div className="rounded-xl shadow-sm border overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Entries (Approved)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>{['Date', 'Shop', 'Total Sale', 'Cash', 'Online'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {data.latestEntries?.map(e => (
                                <tr key={e.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">{e.shop_name}</td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{Number(e.total_sale).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(e.cash).toLocaleString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number((+e.online || 0) + (+e.razorpay || 0)).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                            {(!data.latestEntries || data.latestEntries.length === 0) && (
                                <tr><td colSpan="5" className="text-center py-10 text-gray-400">No entries</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default ManagerDashboard;
