import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
    Package, AlertTriangle, TrendingDown, Layers,
    Scissors, List, BarChart2, ChevronRight,
} from 'lucide-react';

const StatCard = ({ label, value, sub, icon: Icon, color, onClick }) => (
    <div
        onClick={onClick}
        className={`rounded-2xl p-5 flex items-start gap-4 shadow-sm border transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
    >
        <div className="p-3 rounded-xl" style={{ background: `${color}20` }}>
            <Icon className="h-6 w-6" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
        {onClick && <ChevronRight className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />}
    </div>
);

const QuickLink = ({ label, to, icon: Icon, color }) => {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(to)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-all hover:shadow-md"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
        >
            <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <ChevronRight className="h-4 w-4 ml-auto" style={{ color: 'var(--text-secondary)' }} />
        </button>
    );
};

export default function ManufacturingDashboard() {
    const navigate  = useNavigate();
    const [stats, setStats]     = useState(null);
    const [lowStock, setLowStock] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/mfg/raw-materials/dashboard')
            .then(r => {
                setStats(r.data.stats);
                setLowStock(r.data.low_stock || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const fmt = (v) => v != null ? Number(v).toLocaleString('en-IN') : '—';
    const fmtCur = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

    return (
        <Layout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Manufacturing</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Raw Materials · BOM · Size Matrix · Product Master
                    </p>
                </div>

                {/* Stat Cards */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Materials"
                            value={fmt(stats?.total_materials)}
                            icon={Package}
                            color="#FF6B00"
                            onClick={() => navigate('/manufacturing/raw-materials')}
                        />
                        <StatCard
                            label="Stock Value"
                            value={fmtCur(stats?.total_stock_value)}
                            sub="at current cost"
                            icon={BarChart2}
                            color="#10b981"
                        />
                        <StatCard
                            label="Low Stock Alerts"
                            value={fmt(stats?.low_stock_count)}
                            sub="below reorder level"
                            icon={AlertTriangle}
                            color="#ef4444"
                            onClick={() => navigate('/manufacturing/raw-materials?low_stock=true')}
                        />
                        <StatCard
                            label="Fabric Lots"
                            value="View"
                            sub="manage fabric rolls"
                            icon={Layers}
                            color="#8b5cf6"
                            onClick={() => navigate('/manufacturing/fabric-lots')}
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Quick Links */}
                    <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Links</h2>
                        <div className="space-y-2">
                            <QuickLink label="Raw Materials"    to="/manufacturing/raw-materials"  icon={Package}  color="#FF6B00" />
                            <QuickLink label="Fabric Lots"      to="/manufacturing/fabric-lots"    icon={Layers}   color="#8b5cf6" />
                            <QuickLink label="Bill of Materials" to="/manufacturing/bom"           icon={List}     color="#0ea5e9" />
                            <QuickLink label="Size Matrix"      to="/manufacturing/size-matrix"    icon={Scissors} color="#10b981" />
                            <QuickLink label="Product Master"   to="/manufacturing/product-master" icon={Package}  color="#f59e0b" />
                        </div>
                    </div>

                    {/* Low Stock Alert */}
                    <div className="md:col-span-2 rounded-2xl p-5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                Low Stock Alerts
                            </h2>
                            <button
                                onClick={() => navigate('/manufacturing/raw-materials?low_stock=true')}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                                style={{ background: '#FF6B001a', color: '#FF6B00' }}
                            >
                                View All
                            </button>
                        </div>
                        {loading ? (
                            <div className="space-y-2">
                                {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-primary)' }} />)}
                            </div>
                        ) : lowStock.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                                <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">All materials are adequately stocked</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lowStock.map(m => (
                                    <div key={m.id}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                                        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
                                    >
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.type_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-red-500">
                                                {Number(m.current_stock).toFixed(2)} {m.unit}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                Reorder: {Number(m.reorder_level).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
