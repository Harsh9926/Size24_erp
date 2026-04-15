import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Plus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

const CashFlowPage = () => {
    const [cashFlows, setCashFlows] = useState([]);
    const [summary, setSummary] = useState({});
    const [shops, setShops] = useState([]);
    const [form, setForm] = useState({ shop_id: '', amount: '', type: 'deposit', done_by: '', note: '', date: new Date().toISOString().split('T')[0] });
    const [msg, setMsg] = useState('');

    useEffect(() => { loadAll(); }, []);
    const loadAll = async () => {
        const [cf, sh] = await Promise.all([api.get('/cashflow'), api.get('/shops')]);
        setCashFlows(cf.data.data);
        setSummary(cf.data.summary);
        setShops(sh.data);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/cashflow', form); loadAll(); setMsg('Cash flow entry added!'); setForm({ shop_id: '', amount: '', type: 'deposit', done_by: '', note: '', date: new Date().toISOString().split('T')[0] }); }
        catch (err) { setMsg(err.response?.data?.error || 'Error'); }
    };

    return (
        <Layout title="Cash Flow">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Deposit</p>
                    <p className="text-2xl font-bold text-green-600">₹{Number(summary.totalDeposit || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Expense</p>
                    <p className="text-2xl font-bold text-red-600">₹{Number(summary.totalExpense || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Balance</p>
                    <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>₹{Number(summary.balance || 0).toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add Form */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-500" /> New Cash Entry</h3>
                    {msg && <p className="text-xs text-indigo-600 mb-3">{msg}</p>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={labelCls}>Shop</label>
                            <select className={inputCls} value={form.shop_id} onChange={e => setForm({ ...form, shop_id: e.target.value })} required>
                                <option value="">-- Select Shop --</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Type</label>
                            <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                <option value="deposit">Deposit</option>
                                <option value="expense">Expense</option>
                            </select>
                        </div>
                        <div><label className={labelCls}>Amount</label><input type="number" className={inputCls} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="₹0.00" required /></div>
                        <div><label className={labelCls}>Done By</label><input className={inputCls} value={form.done_by} onChange={e => setForm({ ...form, done_by: e.target.value })} placeholder="Name" /></div>
                        <div><label className={labelCls}>Note</label><input className={inputCls} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Optional note" /></div>
                        <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Add Entry</button>
                    </form>
                </div>

                {/* Cash Flow List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-base font-semibold text-gray-800">Cash Flow Records</h3></div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>{['Date', 'Shop', 'Type', 'Amount', 'Done By', 'Note'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {cashFlows?.map(cf => (
                                    <tr key={cf.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-3 text-sm text-gray-700">{new Date(cf.date).toLocaleDateString('en-IN')}</td>
                                        <td className="px-5 py-3 text-sm font-medium text-indigo-600">{cf.shop_name}</td>
                                        <td className="px-5 py-3">
                                            <span className={`flex items-center gap-1 text-xs font-semibold ${cf.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                                {cf.type === 'deposit' ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                                                {cf.type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900">₹{cf.amount}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{cf.done_by || '—'}</td>
                                        <td className="px-5 py-3 text-sm text-gray-500">{cf.note || '—'}</td>
                                    </tr>
                                ))}
                                {(!cashFlows || cashFlows.length === 0) && <tr><td colSpan="6" className="text-center py-10 text-gray-400">No cash flow records</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default CashFlowPage;
