import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Eye, RotateCcw, X, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const ENTRY_TYPE_LABELS = {
    journal:'Manual', payment:'Payment', receipt:'Receipt', contra:'Contra',
    sales_auto:'Sales', purchase_auto:'Purchase', expense_auto:'Expense', inventory_auto:'Inventory',
};

export default function JournalEntries() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [entries, setEntries]   = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [from, setFrom]         = useState(new Date().toISOString().slice(0,7)+'-01');
    const [to, setTo]             = useState(new Date().toISOString().slice(0,10));
    const [typeFilter, setType]   = useState('');
    const [showForm, setShowForm] = useState(false);
    const [viewEntry, setView]    = useState(null);
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState(null);
    const [lines, setLines]       = useState([{ account_id:'', dr_amount:'', cr_amount:'', narration:'' }]);
    const [jeForm, setJE]         = useState({ entry_date: new Date().toISOString().slice(0,10), narration:'' });

    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const load = async () => {
        setLoading(true);
        try {
            const [jR, aR] = await Promise.all([
                api.get('/accounting/journal', { params:{ from, to, entry_type: typeFilter || undefined } }),
                api.get('/accounting/accounts', { params:{ } }),
            ]);
            setEntries(jR.data); setAccounts(aR.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [from, to, typeFilter]);

    const totalDr = lines.reduce((s,l) => s + parseFloat(l.dr_amount||0), 0);
    const totalCr = lines.reduce((s,l) => s + parseFloat(l.cr_amount||0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.01;

    const addLine = () => setLines(l => [...l, { account_id:'', dr_amount:'', cr_amount:'', narration:'' }]);
    const removeLine = (i) => setLines(l => l.filter((_,idx) => idx!==i));
    const updLine = (i, k, v) => setLines(l => l.map((line,idx) => idx===i ? {...line,[k]:v} : line));

    const handleSave = async () => {
        if (!balanced) { showMsg('Entry must balance (Dr = Cr)', 'error'); return; }
        if (lines.some(l => !l.account_id)) { showMsg('All lines need an account', 'error'); return; }
        setSaving(true);
        try {
            await api.post('/accounting/journal', { ...jeForm, lines });
            setShowForm(false);
            setLines([{ account_id:'', dr_amount:'', cr_amount:'', narration:'' }]);
            setJE({ entry_date: new Date().toISOString().slice(0,10), narration:'' });
            showMsg('Journal entry posted');
            load();
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSaving(false); }
    };

    const handleReverse = async (id) => {
        if (!confirm('Reverse this entry?')) return;
        try {
            await api.post(`/accounting/journal/${id}/reverse`);
            showMsg('Entry reversed'); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const openView = async (id) => {
        try {
            const r = await api.get(`/accounting/journal/${id}`);
            setView(r.data);
        } catch {}
    };

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
                    <FileText className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Journal Entries</h1>
                    <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                        <Plus className="h-4 w-4" /> New Entry
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls+' w-36'} style={inp} />
                        <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className={iCls+' w-36'} style={inp} />
                        <select value={typeFilter} onChange={e=>setType(e.target.value)} className={iCls+' w-40'} style={inp}>
                            <option value="">All Types</option>
                            {Object.entries(ENTRY_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>

                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Date','Entry No','Type','Narration','Debit','Credit','By','Actions'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto" style={{ color:'var(--text-secondary)' }} /></td></tr>
                                    ) : entries.map(e => (
                                        <tr key={e.id} className={`border-b hover:bg-orange-50/10 transition-colors ${e.is_reversed?'opacity-50':''}`} style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{new Date(e.entry_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{e.entry_number}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{ENTRY_TYPE_LABELS[e.entry_type]||e.entry_type}</span>
                                                {e.is_reversed && <span className="text-[10px] font-bold ml-1 px-1 py-0.5 rounded bg-red-100 text-red-500">REV</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs max-w-48 truncate" style={{ color:'var(--text-primary)' }}>{e.narration}</td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-right"></td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-right"></td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{e.created_by_name}</td>
                                            <td className="px-3 py-2.5 flex gap-1">
                                                <button onClick={() => openView(e.id)} className="p-1 rounded hover:bg-blue-50 text-blue-500"><Eye className="h-3.5 w-3.5" /></button>
                                                {!e.is_reversed && e.entry_type === 'journal' && (
                                                    <button onClick={() => handleReverse(e.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><RotateCcw className="h-3.5 w-3.5" /></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && entries.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No entries found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* New Entry Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>New Journal Entry</h3>
                            <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Date</label>
                                    <input type="date" value={jeForm.entry_date} onChange={e=>setJE(f=>({...f,entry_date:e.target.value}))} className={iCls} style={inp} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Narration</label>
                                    <input value={jeForm.narration} onChange={e=>setJE(f=>({...f,narration:e.target.value}))} className={iCls} style={inp} placeholder="Being…" />
                                </div>
                            </div>
                            <table className="w-full text-sm border rounded-xl overflow-hidden" style={{ borderColor:'var(--border-color)' }}>
                                <thead>
                                    <tr style={{ background:'var(--bg-primary)' }}>
                                        {['Account','Debit (₹)','Credit (₹)','Narration',''].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((line, i) => (
                                        <tr key={i} className="border-t" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-2 py-1.5">
                                                <select value={line.account_id} onChange={e=>updLine(i,'account_id',e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs outline-none" style={inp}>
                                                    <option value="">-- Select Account --</option>
                                                    {accounts.filter(a=>!a.is_group).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5 w-28">
                                                <input type="number" value={line.dr_amount} onChange={e=>updLine(i,'dr_amount',e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs text-right outline-none" style={inp} placeholder="0.00" />
                                            </td>
                                            <td className="px-2 py-1.5 w-28">
                                                <input type="number" value={line.cr_amount} onChange={e=>updLine(i,'cr_amount',e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs text-right outline-none" style={inp} placeholder="0.00" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <input value={line.narration} onChange={e=>updLine(i,'narration',e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-xs outline-none" style={inp} />
                                            </td>
                                            <td className="px-2 py-1.5 w-8">
                                                {lines.length > 2 && <button onClick={() => removeLine(i)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="h-3 w-3" /></button>}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="border-t font-bold" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                        <td className="px-3 py-2 text-xs" style={{ color:'var(--text-secondary)' }}>Total</td>
                                        <td className="px-3 py-2 text-xs text-right" style={{ color: balanced ? '#10b981' : '#ef4444' }}>{fmt(totalDr)}</td>
                                        <td className="px-3 py-2 text-xs text-right" style={{ color: balanced ? '#10b981' : '#ef4444' }}>{fmt(totalCr)}</td>
                                        <td colSpan={2} className="px-3 py-2 text-xs" style={{ color: balanced ? '#10b981' : '#ef4444' }}>
                                            {balanced ? '✓ Balanced' : `Diff: ${fmt(Math.abs(totalDr - totalCr))}`}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="flex gap-3">
                                <button onClick={addLine} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border" style={{ borderColor:'var(--border-color)', color:ORANGE, background:'var(--bg-primary)' }}>
                                    <Plus className="h-4 w-4" /> Add Line
                                </button>
                                <div className="flex-1" />
                                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving || !balanced} className="px-6 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-60" style={{ background:ORANGE }}>
                                    {saving ? 'Posting…' : 'Post Entry'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Entry Modal */}
            {viewEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{viewEntry.entry_number}</h3>
                            <button onClick={() => setView(null)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span style={{ color:'var(--text-secondary)' }}>Date: </span><span className="font-semibold" style={{ color:'var(--text-primary)' }}>{new Date(viewEntry.entry_date).toLocaleDateString('en-IN')}</span></div>
                                <div><span style={{ color:'var(--text-secondary)' }}>Type: </span><span className="font-semibold" style={{ color:'var(--text-primary)' }}>{ENTRY_TYPE_LABELS[viewEntry.entry_type]||viewEntry.entry_type}</span></div>
                                <div className="col-span-2"><span style={{ color:'var(--text-secondary)' }}>Narration: </span><span className="font-semibold" style={{ color:'var(--text-primary)' }}>{viewEntry.narration}</span></div>
                            </div>
                            <table className="w-full text-sm border rounded-xl overflow-hidden" style={{ borderColor:'var(--border-color)' }}>
                                <thead>
                                    <tr style={{ background:'var(--bg-primary)' }}>
                                        {['Account','Debit','Credit'].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase" style={{ color:'var(--text-secondary)' }}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewEntry.lines?.map((l,i) => (
                                        <tr key={i} className="border-t" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2 text-xs" style={{ color:'var(--text-primary)' }}>{l.account_code} — {l.account_name}</td>
                                            <td className="px-3 py-2 text-xs text-right font-bold text-emerald-600">{parseFloat(l.dr_amount)>0?fmt(l.dr_amount):'—'}</td>
                                            <td className="px-3 py-2 text-xs text-right font-bold text-red-500">{parseFloat(l.cr_amount)>0?fmt(l.cr_amount):'—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
