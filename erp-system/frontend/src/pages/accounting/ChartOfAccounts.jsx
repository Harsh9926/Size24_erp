import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Edit2, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const TYPE_COLORS = { asset:'#10b981', liability:'#ef4444', equity:'#8b5cf6', revenue:'#3b82f6', expense:'#f59e0b', contra:'#6b7280' };

export default function ChartOfAccounts() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing]   = useState(null);
    const [form, setForm]         = useState({ code:'', name:'', type:'asset', sub_type:'', parent_id:'', is_group:false, gst_applicable:false, opening_dr:'0', opening_cr:'0', description:'' });
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState(null);

    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const load = async () => {
        setLoading(true);
        try {
            const p = {};
            if (typeFilter) p.type = typeFilter;
            if (search) p.search = search;
            const r = await api.get('/accounting/accounts', { params: p });
            setAccounts(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [typeFilter, search]);

    const openEdit = (acc) => {
        setEditing(acc);
        setForm({ code:acc.code, name:acc.name, type:acc.type, sub_type:acc.sub_type||'', parent_id:acc.parent_id||'', is_group:acc.is_group, gst_applicable:acc.gst_applicable, opening_dr:acc.opening_dr||'0', opening_cr:acc.opening_cr||'0', description:acc.description||'' });
        setShowForm(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/accounting/accounts/${editing.id}`, form);
                showMsg('Account updated');
            } else {
                await api.post('/accounting/accounts', form);
                showMsg('Account created');
            }
            setShowForm(false); setEditing(null); load();
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSaving(false); }
    };

    const grouped = accounts.reduce((g, a) => {
        (g[a.type] = g[a.type] || []).push(a);
        return g;
    }, {});

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                    <BookOpen className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Chart of Accounts</h1>
                    <button onClick={() => { setEditing(null); setForm({code:'',name:'',type:'asset',sub_type:'',parent_id:'',is_group:false,gst_applicable:false,opening_dr:'0',opening_cr:'0',description:''}); setShowForm(true); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                        <Plus className="h-4 w-4" /> Add Account
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-48">
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search accounts…"
                                className={iCls + ' pl-9'} style={inp} />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        </div>
                        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className={iCls + ' w-40'} style={inp}>
                            <option value="">All Types</option>
                            {['asset','liability','equity','revenue','expense','contra'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <div className="space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-10 rounded-xl animate-pulse" style={{ background:'var(--bg-surface)' }} />)}</div>
                    ) : (
                        Object.entries(grouped).map(([type, accs]) => (
                            <div key={type} className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                    <div className="w-3 h-3 rounded-full" style={{ background: TYPE_COLORS[type] || ORANGE }} />
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>{type} ({accs.length})</p>
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                            {['Code','Name','Sub-Type','Group','GST','Opening Dr','Opening Cr',''].map(h => (
                                                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accs.map(acc => (
                                            <tr key={acc.id} className="border-b hover:bg-orange-50/10 transition-colors" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:TYPE_COLORS[acc.type]||ORANGE }}>{acc.code}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>
                                                    {acc.is_system && <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 mr-1">SYS</span>}
                                                    {acc.name}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{acc.sub_type||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs">{acc.is_group ? '✓' : ''}</td>
                                                <td className="px-3 py-2.5 text-xs">{acc.gst_applicable ? '✓' : ''}</td>
                                                <td className="px-3 py-2.5 text-xs text-right">{parseFloat(acc.opening_dr||0) > 0 ? `₹${Number(acc.opening_dr).toLocaleString('en-IN')}` : '—'}</td>
                                                <td className="px-3 py-2.5 text-xs text-right">{parseFloat(acc.opening_cr||0) > 0 ? `₹${Number(acc.opening_cr).toLocaleString('en-IN')}` : '—'}</td>
                                                <td className="px-3 py-2.5">
                                                    {!acc.is_system && (
                                                        <button onClick={() => openEdit(acc)} className="p-1 rounded hover:bg-orange-50 text-orange-500">
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{editing ? 'Edit Account' : 'New Account'}</h3>
                            <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            {[['code','Account Code'],['name','Account Name']].map(([k,l]) => (
                                <div key={k} className={k==='name'?'col-span-2':''}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} disabled={editing?.is_system} />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Type</label>
                                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className={iCls} style={inp} disabled={!!editing}>
                                    {['asset','liability','equity','revenue','expense','contra'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Sub-Type</label>
                                <input value={form.sub_type} onChange={e=>setForm(f=>({...f,sub_type:e.target.value}))} className={iCls} style={inp} placeholder="e.g. cash, bank, receivable" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Opening Dr (₹)</label>
                                <input type="number" value={form.opening_dr} onChange={e=>setForm(f=>({...f,opening_dr:e.target.value}))} className={iCls} style={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Opening Cr (₹)</label>
                                <input type="number" value={form.opening_cr} onChange={e=>setForm(f=>({...f,opening_cr:e.target.value}))} className={iCls} style={inp} />
                            </div>
                            <div className="col-span-2 flex gap-4">
                                <label className="flex items-center gap-2 text-sm" style={{ color:'var(--text-primary)' }}>
                                    <input type="checkbox" checked={form.is_group} onChange={e=>setForm(f=>({...f,is_group:e.target.checked}))} />
                                    Group Account
                                </label>
                                <label className="flex items-center gap-2 text-sm" style={{ color:'var(--text-primary)' }}>
                                    <input type="checkbox" checked={form.gst_applicable} onChange={e=>setForm(f=>({...f,gst_applicable:e.target.checked}))} />
                                    GST Applicable
                                </label>
                            </div>
                            <div className="col-span-2 flex gap-3 pt-1">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>
                                    {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.type==='error'?'bg-red-600':'bg-emerald-600'} text-white`}>
                    {toast.type==='error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
