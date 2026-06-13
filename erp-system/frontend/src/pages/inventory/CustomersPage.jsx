import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, X, Save, RefreshCw, Users } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const EMPTY = { name:'', mobile:'', gst_number:'', address:'', school_id:'', opening_balance:'0' };

export default function CustomersPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [customers, setCustomers]     = useState([]);
    const [schools, setSchools]         = useState([]);
    const [search, setSearch]           = useState('');
    const [schoolFilter, setSchoolFilter] = useState('');
    const [loading, setLoading]         = useState(true);
    const [showModal, setShowModal]     = useState(false);
    const [selected, setSelected]       = useState(null);
    const [form, setForm]               = useState(EMPTY);
    const [saving, setSaving]           = useState(false);
    const [error, setError]             = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (search)       p.set('search', search);
            if (schoolFilter) p.set('school_id', schoolFilter);
            const [c, s] = await Promise.all([api.get(`/inv/parties/customers?${p}`), api.get('/inv/schools')]);
            setCustomers(c.data); setSchools(s.data);
        } catch {} finally { setLoading(false); }
    }, [search, schoolFilter]);

    useEffect(() => { load(); }, [load]);

    const openEdit = (c) => {
        setSelected(c);
        setForm({ name:c.name, mobile:c.mobile||'', gst_number:c.gst_number||'', address:c.address||'', school_id:c.school_id||'', opening_balance:c.opening_balance||'0' });
        setShowModal(true);
    };

    const save = async () => {
        if (!form.name) return setError('Name required');
        setSaving(true); setError('');
        try {
            if (selected?.id) await api.put(`/inv/parties/customers/${selected.id}`, form);
            else               await api.post('/inv/parties/customers', form);
            setShowModal(false); setSelected(null); setForm(EMPTY); load();
        } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const ff = (k) => (e) => setForm(p=>({...p,[k]:e.target.value}));

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1"><Users className="h-5 w-5" style={{ color: '#FF6B00' }} /><h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Customers</h1></div>
                    <button onClick={() => { setSelected(null); setForm(EMPTY); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B00' }}><Plus className="h-4 w-4" /> Add Customer</button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Schools</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Customer','School','Mobile','Total Sales','Outstanding','Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? Array(4).fill(0).map((_,i)=><tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background:'var(--bg-primary)' }} /></td></tr>)
                                    : customers.length===0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No customers yet.</td></tr>
                                    : customers.map(c => (
                                        <tr key={c.id} className="hover:bg-orange-50/20 transition-colors">
                                            <td className="px-4 py-3 font-medium" style={{ color:'var(--text-primary)' }}>{c.name}</td>
                                            <td className="px-4 py-3 text-xs" style={{ color:'var(--text-secondary)' }}>{c.school_name||'—'}</td>
                                            <td className="px-4 py-3 text-xs" style={{ color:'var(--text-secondary)' }}>{c.mobile||'—'}</td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold" style={{ color:'var(--text-primary)' }}>₹{Number(c.total_sales).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: parseFloat(c.outstanding)>0?'#ef4444':'var(--text-secondary)' }}>₹{Number(c.outstanding).toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3"><button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color:'var(--text-secondary)' }}><Edit2 className="h-4 w-4" /></button></td>
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
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{selected?.id?'Edit Customer':'Add Customer'}</h3>
                            <button onClick={() => { setShowModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>Customer Name *</label><input className={iCls} style={inp} value={form.name} onChange={ff('name')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Mobile</label><input className={iCls} style={inp} value={form.mobile} onChange={ff('mobile')} /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>GST Number</label><input className={iCls} style={inp} value={form.gst_number} onChange={ff('gst_number')} /></div>
                                <div className="col-span-2">
                                    <label className={lCls} style={{ color:'var(--text-secondary)' }}>School (Link)</label>
                                    <select className={iCls} style={inp} value={form.school_id} onChange={ff('school_id')}>
                                        <option value="">-- No School --</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Opening Balance</label><input type="number" className={iCls} style={inp} value={form.opening_balance} onChange={ff('opening_balance')} /></div>
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>Address</label><textarea className={iCls} style={inp} rows={2} value={form.address} onChange={ff('address')} /></div>
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
