import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Lock, Unlock } from 'lucide-react';

const EntriesPage = () => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadEntries(); }, []);
    const loadEntries = async () => {
        try { const res = await api.get('/entries'); setEntries(res.data); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUnlock = async (id) => {
        try { await api.post(`/entries/${id}/unlock`); loadEntries(); alert('Entry unlocked for 10 minutes!'); }
        catch (e) { alert(e.response?.data?.error || 'Error'); }
    };

    const isEditable = (entry) => entry.locked && entry.edit_enabled_till && new Date() < new Date(entry.edit_enabled_till);

    if (loading) return <Layout title="Daily Entries"><div className="text-center py-20 text-gray-400 animate-pulse">Loading entries...</div></Layout>;

    return (
        <Layout title="Daily Entries">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-base font-semibold text-gray-800">All Daily Entries ({entries.length})</h3>
                    <button onClick={loadEntries} className="text-xs text-indigo-600 hover:underline font-medium">Refresh</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>{['Date', 'Shop', 'Total Sale', 'Cash', 'Paytm', 'Razorpay', 'Expense', 'Diff', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {entries.map(e => (
                                <tr key={e.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-700">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-indigo-600">{e.shop_name}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{e.total_sale}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">₹{e.cash}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">₹{e.paytm}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">₹{e.razorpay}</td>
                                    <td className="px-4 py-3 text-sm text-red-500">₹{e.expense}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={`font-semibold ${+e.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>₹{e.difference}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditable(e) ? (
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Unlocked</span>
                                        ) : (
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${e.locked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{e.locked ? 'Locked' : 'Open'}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {e.locked && !isEditable(e) && (
                                            <button onClick={() => handleUnlock(e.id)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                                                <Unlock className="h-3 w-3" /> Unlock
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && <tr><td colSpan="10" className="text-center py-12 text-gray-400">No entries found</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default EntriesPage;
