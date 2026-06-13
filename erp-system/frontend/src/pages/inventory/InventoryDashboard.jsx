import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package, ShoppingCart, TrendingUp, TrendingDown,
    AlertTriangle, IndianRupee, ArrowRight, BarChart3,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const fmt = (v) => `₹${Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const KPI = ({ label, value, icon: Icon, color, bg, onClick }) => (
    <div
        onClick={onClick}
        className={`rounded-2xl border p-5 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
            <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
        </div>
    </div>
);

export default function InventoryDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/inv/dashboard')
            .then(r => setStats(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Header */}
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,0,0.12)' }}>
                            <Package className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>Inventory Dashboard</h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>School Uniform ERP — Stock, Sales & Purchases</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <KPI label="Inventory Value"   value={fmt(stats?.inventory_value)}       icon={Package}      color="text-teal-600"    bg="bg-teal-50"    onClick={() => navigate('/inventory/stock')} />
                            <KPI label="Sales This Month"  value={fmt(stats?.sales_this_month)}      icon={TrendingUp}   color="text-emerald-600" bg="bg-emerald-50" onClick={() => navigate('/inventory/sales')} />
                            <KPI label="Purchase This Month" value={fmt(stats?.purchase_this_month)} icon={ShoppingCart}  color="text-blue-600"    bg="bg-blue-50"    onClick={() => navigate('/inventory/purchase')} />
                            <KPI label="Receivable"        value={fmt(stats?.outstanding_receivable)} icon={IndianRupee}  color="text-purple-600"  bg="bg-purple-50"  onClick={() => navigate('/inventory/sales')} />
                            <KPI label="Payable"           value={fmt(stats?.outstanding_payable)}   icon={TrendingDown} color="text-orange-600"  bg="bg-orange-50"  onClick={() => navigate('/inventory/purchase')} />
                            <KPI label="Low Stock Items"   value={stats?.low_stock_count ?? 0}        icon={AlertTriangle} color="text-red-600"    bg="bg-red-50"     onClick={() => navigate('/inventory/stock?low=true')} />
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'New Sale',       path: '/inventory/sales/new',    color: '#10b981' },
                                { label: 'New Purchase',   path: '/inventory/purchase/new', color: '#3b82f6' },
                                { label: 'Add Product',    path: '/inventory/items',        color: '#FF6B00' },
                                { label: 'Stock Summary',  path: '/inventory/stock',        color: '#8b5cf6' },
                                { label: 'Suppliers',      path: '/inventory/suppliers',    color: '#06b6d4' },
                                { label: 'Customers',      path: '/inventory/customers',    color: '#f59e0b' },
                                { label: 'Schools',        path: '/inventory/schools',      color: '#ec4899' },
                                { label: 'Stock Adjust',   path: '/inventory/stock/adjust', color: '#64748b' },
                            ].map(({ label, path, color }) => (
                                <button key={path} onClick={() => navigate(path)}
                                    className="flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm active:scale-95"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color }}>
                                    {label}
                                    <ArrowRight className="h-4 w-4 opacity-60" />
                                </button>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
