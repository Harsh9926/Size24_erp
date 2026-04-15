import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Store } from 'lucide-react';

const ManagerDashboard = () => {
    const [data, setData] = useState({ summary: {}, chartData: [], latestEntries: [], shops: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard/manager').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const cards = [
        { label: 'Total Sales', value: data.summary?.total_sales, color: 'text-emerald-600' },
        { label: 'Total Cash', value: data.summary?.total_cash, color: 'text-blue-600' },
        { label: 'Total Online', value: data.summary?.total_online, color: 'text-purple-600' },
        { label: 'Total Expense', value: data.summary?.total_expense, color: 'text-red-500' },
    ];

    if (loading) return <Layout title="Manager Dashboard"><div className="text-center py-20 text-gray-400 animate-pulse">Loading...</div></Layout>;

    return (
        <Layout title="Manager Dashboard">
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

            {/* KPI Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                {cards.map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-5 shadow-sm border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                        <p className={`text-2xl font-bold ${color}`}>₹{Number(value || 0).toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Daily Performance</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Entries */}
            <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Entries</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead style={{ background: 'var(--bg-primary)' }}>
                            <tr>{['Date', 'Shop', 'Total Sale', 'Cash', 'Online', 'Expense', 'Status'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {data.latestEntries?.map(e => (
                                <tr key={e.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">{e.shop_name}</td>
                                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{e.total_sale}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{e.cash}</td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{(+e.paytm + +e.razorpay).toFixed(0)}</td>
                                    <td className="px-4 py-3 text-sm text-red-500">₹{e.expense}</td>
                                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${e.locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{e.locked ? 'Locked' : 'Open'}</span></td>
                                </tr>
                            ))}
                            {(!data.latestEntries || data.latestEntries.length === 0) && <tr><td colSpan="7" className="text-center py-10 text-gray-400">No entries</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default ManagerDashboard;
