import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, X, Save, RefreshCw, Truck } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const EMPTY = { name:'', gst_number:'', mobile:'', email:'', address:'', credit_days:'0', credit_limit:'0', opening_balance:'0' };

export default function SuppliersPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [suppliers, setSuppliers]     = useState([]);
    const [search, setSearch]           = useState('');
    const [loading, setLoading]         = useState(true);
    const [showModal, setShowModal]     = useState(false);
    const [selected, setSelected]       = useState(null);
    const [form, setForm]               = useState(EMPTY);
    const [saving, setSaving]           = useState(false);
    const [error, setError]             = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get(`/inv/parties/suppliers${search ? `?search=${search}` : ''}`);
            setSuppliers(r.data);
        } catch {} finally { setLoading(false); }
    }, [search]);

    useEffect(() => { load(); }, [load]);

    const openEdit = (s) => {
        setSelected(s); setForm({ name:s.name, gst_number:s.gst_number||'', mobile:s.mobile||'', email:s.email||'', address:s.address||'', credit_days:s.credit_days||'0', credit_limit:s.credit_limit||'0', opening_balance:s.opening_balance||'0' });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.name) return setError('Name required');
        setSaving(true); setError('');
        try {
            if (selected?.id) await api.put(`/inv/parties/suppliers/${selected.id}`, form);
            else               await api.post('/inv/parties/suppliers', form);
            setShowModal(false); setSelected(null); setForm(EMPTY); load();
        } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const f = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}));

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1"><Truck className="h-5 w-5" style={{ color: '#FF6B00' }} /><h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Suppliers</h1></div>
                    <button onClick={() => { setSelected(null); setForm(EMPTY); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B00' }}><Plus className="h-4 w-4" /> Add Supplier</button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…" className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>

                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Supplier','GST No.','Mobile','Credit Days','Total Purchase','Outstanding','Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? Array(4).fill(0).map((_,i)=><tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></td></tr>)
                                    : suppliers.length===0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No suppliers yet.</td></tr>
                                    : suppliers.map(s => (
                                        <tr key={s.id} className="hover:bg-orange-50/20 transition-colors">
                                            <td className="px-4 py-3 font-medium" style={{ color:'var(--text-primary)' }}>{s.name}</td>
                                            <td className="px-4 py-3 text-xs font-mono" style={{ color:'var(--text-secondary)' }}>{s.gst_number||'—'}</td>
                                            <td className="px-4 py-3 text-xs" style={{ color:'var(--text-secondary)' }}>{s.mobile||'—'}</td>
                                            <td className="px-4 py-3 text-center text-xs" style={{ color:'var(--text-secondary)' }}>{s.credit_days} days</td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color:'var(--text-primary)' }}>₹{Number(s.total_purchase).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: parseFloat(s.outstanding)>0?'#ef4444':'var(--text-secondary)' }}>₹{Number(s.outstanding).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3"><button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color:'var(--text-secondary)' }}><Edit2 className="h-4 w-4" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{selected?.id?'Edit Supplier':'Add Supplier'}</h3>
                            <button onClick={() => { setShowModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>Supplier Name *</label><input className={iCls} style={inp} value={form.name} onChange={f('name')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>GST Number</label><input className={iCls} style={inp} value={form.gst_number} onChange={f('gst_number')} placeholder="22AAAAA0000A1Z5" /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Mobile</label><input className={iCls} style={inp} value={form.mobile} onChange={f('mobile')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Email</label><input className={iCls} style={inp} value={form.email} onChange={f('email')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Credit Days</label><input type="number" className={iCls} style={inp} value={form.credit_days} onChange={f('credit_days')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Credit Limit (₹)</label><input type="number" className={iCls} style={inp} value={form.credit_limit} onChange={f('credit_limit')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Opening Balance (₹)</label><input type="number" className={iCls} style={inp} value={form.opening_balance} onChange={f('opening_balance')} /></div>
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>Address</label><textarea className={iCls} style={inp} rows={2} value={form.address} onChange={f('address')} /></div>
                            </div>
                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            <div className="flex gap-3">
                                <button onClick={() => { setShowModal(false); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={save} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background:'#FF6B00' }}>
                                    {saving?<><RefreshCw className="h-4 w-4 animate-spin"/>Saving…</>:<><Save className="h-4 w-4"/>Save</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
