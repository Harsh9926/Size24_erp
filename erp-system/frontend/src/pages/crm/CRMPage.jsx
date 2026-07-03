import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, RefreshCw, Phone, Target, CheckSquare, CheckCircle2, AlertCircle, X, TrendingUp } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const TABS = ['Leads','Quotations','Tasks','Birthday Reminders'];
const LEAD_STATUS_COLORS = { new:'#6366f1', contacted:'#3b82f6', interested:'#f59e0b', demo_scheduled:'#8b5cf6', converted:'#10b981', lost:'#ef4444', not_interested:'#6b7280' };
const TASK_PRIORITY_COLORS = { low:'#10b981', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };

const fmt = v => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';

export default function CRMPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState('Leads');
    const [toast, setToast] = useState(null);
    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    // Leads
    const [leads, setLeads] = useState([]);
    const [leadSearch, setLeadSearch] = useState('');
    const [leadStatus, setLeadStatus] = useState('');
    const [leadLoading, setLeadLoading] = useState(false);
    const [showLeadForm, setShowLeadForm] = useState(false);
    const [leadForm, setLeadForm] = useState({ name:'', mobile:'', email:'', source:'', product_interest:'', estimated_value:'', notes:'' });
    const [dashboard, setDashboard] = useState(null);

    // Quotations
    const [quotes, setQuotes] = useState([]);
    const [quoteLoading, setQuoteLoading] = useState(false);

    // Tasks
    const [tasks, setTasks] = useState([]);
    const [taskLoading, setTaskLoading] = useState(false);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskForm, setTaskForm] = useState({ title:'', description:'', due_date:'', priority:'medium', assigned_to:'' });

    // Birthdays
    const [birthdays, setBirthdays] = useState([]);
    const [birthdayLoading, setBirthdayLoading] = useState(false);

    const loadLeads = useCallback(async () => {
        setLeadLoading(true);
        try {
            const [lR, dR] = await Promise.all([
                api.get('/crm/leads', { params:{ search:leadSearch||undefined, status:leadStatus||undefined } }),
                api.get('/crm/dashboard'),
            ]);
            setLeads(lR.data); setDashboard(dR.data);
        } catch {} finally { setLeadLoading(false); }
    }, [leadSearch, leadStatus]);

    useEffect(() => { if (tab==='Leads') loadLeads(); }, [tab, loadLeads]);
    useEffect(() => {
        if (tab==='Quotations') {
            setQuoteLoading(true);
            api.get('/crm/quotations').then(r=>setQuotes(r.data)).catch(()=>{}).finally(()=>setQuoteLoading(false));
        }
    }, [tab]);
    useEffect(() => {
        if (tab==='Tasks') {
            setTaskLoading(true);
            api.get('/crm/tasks').then(r=>setTasks(r.data)).catch(()=>{}).finally(()=>setTaskLoading(false));
        }
    }, [tab]);
    useEffect(() => {
        if (tab==='Birthday Reminders') {
            setBirthdayLoading(true);
            api.get('/crm/birthdays').then(r=>setBirthdays(r.data)).catch(()=>{}).finally(()=>setBirthdayLoading(false));
        }
    }, [tab]);

    const handleCreateLead = async () => {
        try {
            await api.post('/crm/leads', leadForm);
            showMsg('Lead created'); setShowLeadForm(false); loadLeads();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleConvertLead = async (id) => {
        try {
            await api.post(`/crm/leads/${id}/convert`);
            showMsg('Lead converted to customer'); loadLeads();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleUpdateLeadStatus = async (id, status) => {
        try {
            await api.put(`/crm/leads/${id}`, { status });
            loadLeads();
        } catch {}
    };

    const handleCreateTask = async () => {
        try {
            await api.post('/crm/tasks', taskForm);
            showMsg('Task created'); setShowTaskForm(false);
            api.get('/crm/tasks').then(r=>setTasks(r.data));
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleToggleTask = async (id, isDone) => {
        try {
            await api.put(`/crm/tasks/${id}`, { is_completed: !isDone });
            api.get('/crm/tasks').then(r=>setTasks(r.data));
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
                    <Target className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>CRM</h1>
                </header>

                {/* Dashboard cards when on Leads */}
                {tab === 'Leads' && dashboard && (
                    <div className="flex gap-3 px-4 md:px-6 py-3 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor:'var(--border-color)' }}>
                        {[['Total Leads',dashboard.pipeline?.total||0,'#6366f1'],['Converted',dashboard.pipeline?.converted||0,'#10b981'],['In Progress',dashboard.pipeline?.in_progress||0,'#f59e0b'],['Lost',dashboard.pipeline?.lost||0,'#ef4444']].map(([l,v,c]) => (
                            <div key={l} className="flex-shrink-0 rounded-xl border px-4 py-2.5" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{l}</p>
                                <p className="text-xl font-extrabold" style={{ color:c }}>{v}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-1 px-4 py-3 border-b overflow-x-auto flex-shrink-0" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab===t?'text-white':'border'}`}
                            style={tab===t?{background:ORANGE}:{borderColor:'var(--border-color)',background:'var(--bg-primary)',color:'var(--text-secondary)'}}>
                            {t}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {tab === 'Leads' && (
                        <div className="space-y-4">
                            <div className="flex gap-3 flex-wrap">
                                <div className="relative flex-1 min-w-40">
                                    <input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} placeholder="Search leads…" className={iCls+' pl-9'} style={inp} />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                </div>
                                <select value={leadStatus} onChange={e=>setLeadStatus(e.target.value)} className={iCls+' w-40'} style={inp}>
                                    <option value="">All Status</option>
                                    {Object.keys(LEAD_STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                                </select>
                                <button onClick={() => setShowLeadForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                                    <Plus className="h-4 w-4" /> Add Lead
                                </button>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Lead#','Name','Mobile','Source','Product Interest','Est. Value','Status','Actions'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {leads.map(l => (
                                            <tr key={l.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{l.lead_number}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{l.name}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{l.mobile||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{l.source||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs max-w-32 truncate" style={{ color:'var(--text-primary)' }}>{l.product_interest||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{l.estimated_value?fmt(l.estimated_value):'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <select value={l.status} onChange={e=>handleUpdateLeadStatus(l.id,e.target.value)}
                                                        className="text-[10px] font-bold px-2 py-1 rounded-full border-0 text-white cursor-pointer outline-none"
                                                        style={{ background: LEAD_STATUS_COLORS[l.status]||ORANGE }}>
                                                        {Object.keys(LEAD_STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {l.status !== 'converted' && (
                                                        <button onClick={() => handleConvertLead(l.id)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white font-bold whitespace-nowrap">Convert</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {!leadLoading && leads.length === 0 && (
                                            <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No leads found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'Quotations' && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <table className="w-full text-sm">
                                <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['Quote#','Customer','Date','Valid Until','Amount','Status'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {quotes.map(q => (
                                        <tr key={q.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{q.quote_number}</td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{q.customer_name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(q.quote_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{q.valid_until?new Date(q.valid_until).toLocaleDateString('en-IN'):'—'}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{fmt(q.total_amount)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.status==='accepted'?'bg-emerald-100 text-emerald-700':q.status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>
                                                    {q.status?.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!quoteLoading && quotes.length === 0 && (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No quotations</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'Tasks' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={() => setShowTaskForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                                    <Plus className="h-4 w-4" /> Add Task
                                </button>
                            </div>
                            <div className="space-y-2">
                                {tasks.map(t => (
                                    <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border ${t.is_completed?'opacity-60':''}`}
                                        style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <button onClick={() => handleToggleTask(t.id, t.is_completed)} className="mt-0.5 flex-shrink-0">
                                            <CheckSquare className={`h-5 w-5 ${t.is_completed?'text-emerald-500':'text-gray-300'}`} />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold ${t.is_completed?'line-through':''}`} style={{ color:'var(--text-primary)' }}>{t.title}</p>
                                            {t.description && <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>{t.description}</p>}
                                            <div className="flex gap-2 mt-1">
                                                {t.due_date && <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>Due: {new Date(t.due_date).toLocaleDateString('en-IN')}</span>}
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background:`${TASK_PRIORITY_COLORS[t.priority]}20`, color:TASK_PRIORITY_COLORS[t.priority] }}>{t.priority?.toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!taskLoading && tasks.length === 0 && (
                                    <p className="text-center py-8 text-sm" style={{ color:'var(--text-secondary)' }}>No tasks</p>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'Birthday Reminders' && (
                        <div className="space-y-3">
                            {birthdays.map((b,i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border"
                                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                        style={{ background: b.type==='customer'?ORANGE:'#8b5cf6' }}>
                                        {b.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{b.name}</p>
                                        <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
                                            {b.type === 'customer' ? 'Customer' : 'Employee'} · {b.mobile||'—'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold" style={{ color:ORANGE }}>{new Date(b.dob).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</p>
                                        <p className="text-[10px] mt-0.5" style={{ color:'var(--text-secondary)' }}>Birthday</p>
                                    </div>
                                </div>
                            ))}
                            {!birthdayLoading && birthdays.length === 0 && (
                                <p className="text-center py-8 text-sm" style={{ color:'var(--text-secondary)' }}>No upcoming birthdays</p>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Lead Form */}
            {showLeadForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Add Lead</h3>
                            <button onClick={() => setShowLeadForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {[['name','Name','text'],['mobile','Mobile','tel'],['email','Email','email'],['source','Source','text'],['product_interest','Product Interest','text'],['estimated_value','Est. Value','number']].map(([k,l,type]) => (
                                <div key={k}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input type={type} value={leadForm[k]} onChange={e=>setLeadForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                </div>
                            ))}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowLeadForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreateLead} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Create Lead</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Form */}
            {showTaskForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Add Task</h3>
                            <button onClick={() => setShowTaskForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {[['title','Title','text'],['description','Description','text'],['due_date','Due Date','date']].map(([k,l,type]) => (
                                <div key={k}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input type={type} value={taskForm[k]} onChange={e=>setTaskForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Priority</label>
                                <select value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))} className={iCls} style={inp}>
                                    {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowTaskForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreateTask} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Create Task</button>
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
