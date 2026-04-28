import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    Wallet, Store, ArrowUpRight, ArrowDownRight, RefreshCw,
    TrendingUp, Clock,
} from 'lucide-react';

const ManagerDashboard = () => {
    const [walletBalance, setWalletBalance] = useState(0);
    const [shops,         setShops]         = useState([]);
    const [selectedShop,  setSelectedShop]  = useState('');
    const [summary,       setSummary]       = useState({ received: 0, to_admin: 0, to_bank: 0, pending_count: 0 });
    const [loading,       setLoading]       = useState(true);
    const [refreshing,    setRefreshing]    = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [balRes, dashRes, txRes, myTxRes] = await Promise.all([
                api.get('/transfers/balance'),
                api.get('/dashboard/manager'),
                api.get('/transfers/manager'),
                api.get('/manager-transfers/mine'),
            ]);

            setWalletBalance(parseFloat(balRes.data.balance || 0));
            setShops(dashRes.data.shops || []);

            const received = txRes.data
                .filter(t => t.status === 'accepted')
                .reduce((s, t) => s + parseFloat(t.amount), 0);
            const to_admin = myTxRes.data
                .filter(t => t.type === 'manager_to_admin' && t.status === 'approved')
                .reduce((s, t) => s + parseFloat(t.amount), 0);
            const to_bank = myTxRes.data
                .filter(t => t.type === 'manager_to_bank' && t.status === 'approved')
                .reduce((s, t) => s + parseFloat(t.amount), 0);
            const pending_count = myTxRes.data.filter(t => t.status === 'pending').length;
            const pending_user_count = txRes.data.filter(t => t.status === 'pending').length;

            setSummary({ received, to_admin, to_bank, pending_count, pending_user_count });
        } catch (err) {
            console.error('[ManagerDashboard] fetchAll:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleRefresh = () => { setRefreshing(true); fetchAll(); };

    if (loading) return (
        <Layout title="Manager Dashboard">
            <div className="text-center py-20 text-gray-400 animate-pulse">Loading…</div>
        </Layout>
    );

    return (
        <Layout title="Manager Dashboard">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>My Wallet</h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Cash flow overview</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Shop filter */}
                    {shops.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-gray-400" />
                            <select
                                value={selectedShop}
                                onChange={e => setSelectedShop(e.target.value)}
                                className="px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-400 transition"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                <option value="">All Shops</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={handleRefresh} disabled={refreshing}
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors hover:bg-orange-50"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Main Wallet Balance Card ────────────────────────────── */}
            <div className="rounded-2xl p-8 mb-6 text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#FF6B00,#ff9a00)' }}>
                {/* decorative icon */}
                <Wallet className="absolute -top-4 -right-4 h-40 w-40 opacity-10" />

                <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                        <Wallet className="h-5 w-5 text-orange-100" />
                        <p className="text-sm font-semibold text-orange-100 uppercase tracking-wide">
                            {selectedShop
                                ? `${shops.find(s => String(s.id) === selectedShop)?.shop_name ?? 'Shop'} · Wallet`
                                : 'Total Wallet Balance'}
                        </p>
                    </div>
                    <p className="text-5xl font-extrabold tracking-tight mb-1">
                        ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-orange-100 mt-1">Cash available in hand</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {summary.pending_user_count > 0 && (
                            <Link to="/manager/cash-transfer"
                                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors">
                                <Clock className="h-3.5 w-3.5 text-yellow-200" />
                                {summary.pending_user_count} user request{summary.pending_user_count > 1 ? 's' : ''} awaiting your approval
                            </Link>
                        )}
                        {summary.pending_count > 0 && (
                            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-semibold">
                                <Clock className="h-3.5 w-3.5 text-yellow-200" />
                                {summary.pending_count} transfer{summary.pending_count > 1 ? 's' : ''} pending admin approval
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Cash Flow Breakdown ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    {
                        label: 'Received from Users',
                        value: summary.received,
                        color: 'text-emerald-600',
                        bg:    'bg-emerald-100',
                        Icon:  TrendingUp,
                        desc:  'Total accepted cash from shop users',
                    },
                    {
                        label: 'Sent to Admin',
                        value: summary.to_admin,
                        color: 'text-blue-600',
                        bg:    'bg-blue-100',
                        Icon:  ArrowUpRight,
                        desc:  'Approved transfers to admin',
                    },
                    {
                        label: 'Deposited to Bank',
                        value: summary.to_bank,
                        color: 'text-purple-600',
                        bg:    'bg-purple-100',
                        Icon:  ArrowDownRight,
                        desc:  'Approved bank deposits',
                    },
                ].map(({ label, value, color, bg, Icon, desc }) => (
                    <div key={label} className="rounded-xl p-5 shadow-sm border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: 'var(--text-secondary)' }}>{label}</p>
                            <div className={`p-1.5 rounded-lg ${bg}`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${color}`}>
                            ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                    </div>
                ))}
            </div>

            {/* ── Quick action CTA ────────────────────────────────────── */}
            <div className="rounded-xl p-5 border flex items-center justify-between gap-4"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Ready to transfer cash?
                    </p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Send cash to admin or deposit directly to bank.
                    </p>
                </div>
                <Link to="/manager/cash-transfer"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 whitespace-nowrap flex-shrink-0"
                    style={{ background: '#FF6B00' }}>
                    Cash Transfer →
                </Link>
            </div>
        </Layout>
    );
};

export default ManagerDashboard;
