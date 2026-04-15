import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { TrendingUp, IndianRupee, CreditCard, Wallet, Lock, Clock } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
    const [data, setData] = useState({ summary: {}, chartData: [], latestEntries: [], pendingUsersCount: 0 });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('monthly');
    const [shops, setShops] = useState([]);
    const [cities, setCities] = useState([]);
    const [filters, setFilters] = useState({ city_id: '', shop_id: '' });

    useEffect(() => {
        api.get('/locations/states').then(() => { }).catch(() => { });
        api.get('/shops').then(r => setShops(r.data)).catch(() => { });
        fetchData();
    }, []);

    useEffect(() => { fetchData(); }, [period, filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ period, ...filters }).toString();
            const res = await api.get(`/dashboard/admin?${params}`);
            setData(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUnlock = async (id) => {
        try { await api.post(`/entries/${id}/unlock`); fetchData(); alert('Unlocked for 10 min'); }
        catch (e) { alert(e.response?.data?.error || 'Error'); }
    };

    const cards = [
        { label: 'Total Sales', value: data.summary?.total_sales, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Total Cash', value: data.summary?.total_cash, icon: IndianRupee, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Total Online', value: data.summary?.total_online, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Total Expense', value: data.summary?.total_expense, icon: Wallet, color: 'text-red-600', bg: 'bg-red-50' },
    ];

    return (
        <Layout title="SIZE24 Dashboard">
            {/* Pending Banner */}
            {data.pendingUsersCount > 0 && (
                <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-5 py-3 rounded-xl">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm font-medium">
                        <span className="font-bold">{data.pendingUsersCount}</span> user{data.pendingUsersCount !== 1 ? 's' : ''} pending approval.{' '}
                        <a href="/admin/users" className="underline font-semibold">Review →</a>
                    </p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {cards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="rounded-xl p-5 shadow-sm border transition-shadow hover:shadow-md" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>₹{Number(value || 0).toLocaleString('en-IN')}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${bg}`}><Icon className={`h-6 w-6 ${color}`} /></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart Filters */}
            <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sales Analytics</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {['daily', 'weekly', 'monthly'].map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize`}
                                style={{ backgroundColor: period === p ? '#FF6B00' : '#f3f4f6', color: period === p ? 'white' : '#4b5563' }}>
                                {p}
                            </button>
                        ))}
                        <select className="px-3 py-1.5 text-xs border rounded-lg bg-white text-gray-600 outline-none" value={filters.shop_id} onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}>
                            <option value="">All Shops</option>
                            {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                        </select>
                    </div>
                </div>
                {loading ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 animate-pulse">Loading chart...</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                            <Legend />
                            <Bar dataKey="sales" name="Sales" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="cash" name="Cash" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="online" name="Online" fill="#1E1E2F" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Recent Entries Table */}
            <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Daily Entries</h3>
                    <button onClick={fetchData} className="text-xs text-indigo-600 hover:underline font-medium">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--border-color)' }}>
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>{['Date', 'Shop', 'City', 'Total Sale', 'Cash', 'Online', 'Expense', 'Status', 'Action'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {data.latestEntries?.map(entry => (
                                <tr key={entry.id} className="transition-colors hover:opacity-90" style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">{entry.shop_name}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.city_name}</td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{Number(entry.total_sale).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{Number(entry.cash).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{(+entry.paytm + +entry.razorpay).toFixed(0)}</td>
                                    <td className="px-4 py-3 text-sm text-red-500">₹{Number(entry.expense).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${entry.locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {entry.locked ? 'Locked' : 'Open'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {entry.locked && (
                                            <button onClick={() => handleUnlock(entry.id)}
                                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                <Lock className="h-3 w-3" /> Unlock
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!data.latestEntries || data.latestEntries.length === 0) && (
                                <tr><td colSpan="9" className="text-center py-12 text-gray-400">No entries yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AdminDashboard;
