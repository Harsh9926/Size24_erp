import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Plus, Trash2, Pencil, RefreshCw, X, Filter, Calendar, IndianRupee } from 'lucide-react';

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const CATEGORIES = ['General', 'Rent', 'Electricity', 'Staff', 'Transport', 'Maintenance', 'Marketing', 'Other'];

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 bg-white';

const catColor = {
    General:     'bg-gray-100 text-gray-700',
    Rent:        'bg-purple-100 text-purple-700',
    Electricity: 'bg-yellow-100 text-yellow-700',
    Staff:       'bg-blue-100 text-blue-700',
    Transport:   'bg-cyan-100 text-cyan-700',
    Maintenance: 'bg-orange-100 text-orange-700',
    Marketing:   'bg-pink-100 text-pink-700',
    Other:       'bg-slate-100 text-slate-700',
};

const ExpensesPage = () => {
    const [expenses,   setExpenses]   = useState([]);
    const [shops,      setShops]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [filters,    setFilters]    = useState({ shop_id: '', from_date: '', to_date: '', category: '' });
    const [showForm,   setShowForm]   = useState(false);
    const [form,       setForm]       = useState({ shop_id: '', date: new Date().toISOString().split('T')[0], amount: '', category: 'General', note: '' });
    const [editId,     setEditId]     = useState(null);
    const [saving,     setSaving]     = useState(false);
    const [error,      setError]      = useState('');

    const loadExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
            const res = await api.get(`/expenses?${params}`);
            setExpenses(res.data);
        } catch { setExpenses([]); }
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => {});
        loadExpenses();
    }, []);

    useEffect(() => { loadExpenses(); }, [filters]);

    const totalAmount = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const openAdd = () => {
        setEditId(null);
        setForm({ shop_id: '', date: new Date().toISOString().split('T')[0], amount: '', category: 'General', note: '' });
        setError('');
        setShowForm(true);
    };

    const openEdit = (exp) => {
        setEditId(exp.id);
        setForm({ shop_id: exp.shop_id, date: exp.date?.split('T')[0] || '', amount: exp.amount, category: exp.category, note: exp.note || '' });
        setError('');
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.shop_id || !form.amount) { setError('Shop and amount are required.'); return; }
        setSaving(true); setError('');
        try {
            if (editId) {
                await api.put(`/expenses/${editId}`, form);
            } else {
                await api.post('/expenses', form);
            }
            setShowForm(false);
            loadExpenses();
        } catch (err) {
            setError(err.response?.data?.error || 'Save failed.');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await api.delete(`/expenses/${id}`);
            setExpenses(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed.');
        }
    };

    return (
        <Layout title="Expense Tracking">

            {/* ── Header bar ──────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-800">Expenses</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Track shop-wise expenses — rent, electricity, staff & more</p>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors">
                    <Plus className="h-4 w-4" /> Add Expense
                </button>
            </div>

            {/* ── Filters ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 mb-5 flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Shop
                    </label>
                    <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                        value={filters.shop_id} onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}>
                        <option value="">All Shops</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> From
                    </label>
                    <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                        value={filters.from_date} onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> To
                    </label>
                    <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                        value={filters.to_date} onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
                    <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                        value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
                        <option value="">All</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <button onClick={loadExpenses} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {(filters.shop_id || filters.from_date || filters.to_date || filters.category) && (
                    <button onClick={() => setFilters({ shop_id: '', from_date: '', to_date: '', category: '' })}
                        className="text-xs text-indigo-600 hover:underline font-medium px-2 py-2">
                        Clear Filters
                    </button>
                )}
            </div>

            {/* ── Summary card ────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Expenses</p>
                    <p className="text-2xl font-extrabold text-red-600 mt-1">{fmt(totalAmount)}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Records</p>
                    <p className="text-2xl font-extrabold text-gray-800 mt-1">{expenses.length}</p>
                </div>
                {expenses.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Category</p>
                        <p className="text-base font-extrabold text-indigo-600 mt-1">
                            {Object.entries(expenses.reduce((acc, e) => {
                                acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0);
                                return acc;
                            }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
                        </p>
                    </div>
                )}
            </div>

            {/* ── Table ───────────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Date', 'Shop', 'Category', 'Amount', 'Note', 'Added By', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr><td colSpan="7" className="text-center py-12 text-gray-400 animate-pulse text-sm">Loading expenses…</td></tr>
                            )}
                            {!loading && expenses.length === 0 && (
                                <tr><td colSpan="7" className="text-center py-12 text-gray-400 text-sm">No expenses found. Click "Add Expense" to add one.</td></tr>
                            )}
                            {!loading && expenses.map(exp => (
                                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(exp.date)}</td>
                                    <td className="px-4 py-3 font-medium text-indigo-600 whitespace-nowrap">{exp.shop_name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${catColor[exp.category] || catColor.Other}`}>
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-red-600 whitespace-nowrap">{fmt(exp.amount)}</td>
                                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{exp.note || '—'}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{exp.added_by_name || '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => openEdit(exp)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(exp.id)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Add/Edit Modal ───────────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                    <IndianRupee className="h-4 w-4 text-red-500" />
                                    {editId ? 'Edit Expense' : 'Add Expense'}
                                </h2>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Shop *</label>
                                <select className={inputCls} value={form.shop_id} required
                                    onChange={e => setForm(f => ({ ...f, shop_id: e.target.value }))}>
                                    <option value="">— Select shop —</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Date *</label>
                                <input type="date" className={inputCls} value={form.date} required
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (₹) *</label>
                                <input type="number" min="1" step="0.01" className={inputCls} value={form.amount} required
                                    placeholder="0.00"
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Category</label>
                                <select className={inputCls} value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Note</label>
                                <input type="text" className={inputCls} value={form.note}
                                    placeholder="Optional description…"
                                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                            </div>

                            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50">
                                    {saving ? 'Saving…' : (editId ? 'Save Changes' : 'Add Expense')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default ExpensesPage;
