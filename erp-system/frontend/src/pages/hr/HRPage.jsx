import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, RefreshCw, Clock, DollarSign, FileText, Layers, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const TABS = ['Employees','Attendance','Salary','Leaves','Tailor Work'];
const STATUS_COLORS = { present:'#10b981', absent:'#ef4444', half_day:'#f59e0b', paid_leave:'#8b5cf6', unpaid_leave:'#a855f7', week_off:'#6b7280', holiday:'#6366f1' };
const EMP_TYPE_COLORS = { full_time:'#10b981', part_time:'#f59e0b', contract:'#3b82f6', tailor:'#8b5cf6', daily_wage:'#6b7280' };

export default function HRPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab]       = useState('Employees');
    const [toast, setToast]   = useState(null);
    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    // Employees
    const [employees, setEmployees] = useState([]);
    const [empSearch, setEmpSearch] = useState('');
    const [empLoading, setEmpLoading] = useState(false);
    // Attendance
    const [attDate, setAttDate] = useState(new Date().toISOString().slice(0,10));
    const [attRecords, setAttRecords] = useState([]);
    const [attLoading, setAttLoading] = useState(false);
    const [bulkAtt, setBulkAtt] = useState({});

    // Salary
    const [salMonth, setSalMonth] = useState(new Date().toISOString().slice(0,7));
    const [slips, setSlips] = useState([]);
    const [slipLoading, setSlipLoading] = useState(false);

    // Leaves
    const [leaves, setLeaves]   = useState([]);
    const [leaveLoading, setLeaveLoading] = useState(false);

    // Tailor
    const [tailorWork, setTailorWork] = useState([]);
    const [tailorLoading, setTailorLoading] = useState(false);
    const [showTailorForm, setShowTailorForm] = useState(false);
    const [tailorForm, setTailorForm] = useState({ employee_id:'', work_date:'', item_desc:'', qty:'1', rate_per_piece:'', notes:'' });

    const loadEmployees = useCallback(async () => {
        setEmpLoading(true);
        try {
            const r = await api.get('/attendance/employees', { params:{ search: empSearch || undefined } });
            const mapped = r.data.map(e => ({
                id: e.user_id, emp_code: e.mobile, name: e.name, mobile: e.mobile,
                department: e.shop_name, designation: e.role, employment_type: e.role,
                basic_salary: e.monthly_salary, pf_applicable: false, esi_applicable: false,
                is_active: e.registration_status !== 'inactive',
            }));
            setEmployees(mapped);
        } catch {} finally { setEmpLoading(false); }
    }, [empSearch]);

    useEffect(() => { if (tab === 'Employees') loadEmployees(); }, [tab, loadEmployees]);

    useEffect(() => {
        if (tab === 'Attendance') {
            setAttLoading(true);
            Promise.all([
                api.get('/attendance/employees'),
                api.get('/attendance/table', { params:{ date: attDate } }),
            ]).then(([empR, attR]) => {
                const attMap = Object.fromEntries(attR.data.map(a => [a.user_id, a.attendance_status]));
                const init = {};
                const recs = empR.data.map(e => {
                    init[e.user_id] = attMap[e.user_id] || '';
                    return { id: e.user_id, emp_code: e.mobile, name: e.name, department: e.shop_name, att_status: attMap[e.user_id] || '' };
                });
                setBulkAtt(init);
                setAttRecords(recs);
            }).catch(()=>{}).finally(() => setAttLoading(false));
        }
    }, [tab, attDate]);

    useEffect(() => {
        if (tab === 'Salary') {
            setSlipLoading(true);
            api.get('/attendance/payroll', { params:{ month: salMonth } }).then(r => {
                const mapped = (r.data.report || []).map(p => ({
                    id: p.user_id, emp_name: p.name, emp_code: p.mobile, slip_month: salMonth + '-01',
                    present_days: p.present, working_days: p.days_in_month,
                    basic: p.monthly_salary, hra: 0, da: 0, gross: p.gross_salary,
                    pf_deduct: 0, esi_deduct: 0, advance_deduct: 0, net_pay: p.net_salary,
                    status: 'draft',
                }));
                setSlips(mapped);
            }).catch(()=>{}).finally(()=>setSlipLoading(false));
        }
    }, [tab, salMonth]);

    useEffect(() => {
        if (tab === 'Leaves') {
            setLeaveLoading(true);
            api.get('/hr/leaves').then(r => setLeaves(r.data)).catch(()=>{}).finally(()=>setLeaveLoading(false));
        }
    }, [tab]);

    useEffect(() => {
        if (tab === 'Tailor Work') {
            setTailorLoading(true);
            api.get('/hr/tailor-work').then(r => setTailorWork(r.data)).catch(()=>{}).finally(()=>setTailorLoading(false));
        }
    }, [tab]);

    const handleMarkAttendance = async () => {
        const records = Object.entries(bulkAtt).filter(([,s])=>s);
        if (!records.length) { showMsg('Select status for at least one employee','error'); return; }
        try {
            await Promise.all(records.map(([uid,status]) => api.put('/attendance/day-status', { user_id: parseInt(uid), date: attDate, status })));
            showMsg(`Attendance marked for ${records.length} employees`);
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleGenSalary = async () => {
        try {
            const r = await api.get('/attendance/payroll', { params:{ month: salMonth } });
            const mapped = (r.data.report || []).map(p => ({
                id: p.user_id, emp_name: p.name, emp_code: p.mobile, slip_month: salMonth + '-01',
                present_days: p.present, working_days: p.days_in_month,
                basic: p.monthly_salary, hra: 0, da: 0, gross: p.gross_salary,
                pf_deduct: 0, esi_deduct: 0, advance_deduct: 0, net_pay: p.net_salary,
                status: 'draft',
            }));
            setSlips(mapped);
            showMsg(`Loaded payroll for ${mapped.length} employees`);
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleApproveLeave = async (id, status) => {
        try {
            await api.put(`/hr/leaves/${id}/approve`, { status });
            showMsg(`Leave ${status}`);
            api.get('/hr/leaves').then(r => setLeaves(r.data));
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleAddTailorWork = async () => {
        try {
            await api.post('/hr/tailor-work', tailorForm);
            showMsg('Work entry added'); setShowTailorForm(false);
            api.get('/hr/tailor-work').then(r => setTailorWork(r.data));
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const tailors = employees.filter(e => e.employment_type === 'tailor' || e.employment_type === 'contract');

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
                    <Users className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>HR & Payroll</h1>
                </header>

                {/* Tabs */}
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
                    {/* EMPLOYEES */}
                    {tab === 'Employees' && (
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="Search employees…" className={iCls+' pl-9'} style={inp} />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                </div>
                                <button onClick={loadEmployees} className="p-2 border rounded-lg" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                                    <RefreshCw className={`h-4 w-4 ${empLoading?'animate-spin':''}`} style={{ color:'var(--text-secondary)' }} />
                                </button>
                            </div>
                            <p className="text-xs" style={{ color:'var(--text-secondary)' }}>Employees are added via Users → Attendance Registration/Assignments.</p>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Code','Name','Department','Designation','Type','Salary','PF','ESI','Status'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {employees.map(e => (
                                            <tr key={e.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{e.emp_code}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>
                                                    {e.name}
                                                    {e.mobile && <p className="text-[10px] font-normal" style={{ color:'var(--text-secondary)' }}>{e.mobile}</p>}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{e.department||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{e.designation||'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white capitalize"
                                                        style={{ background: EMP_TYPE_COLORS[e.employment_type]||ORANGE }}>
                                                        {e.employment_type?.replace('_',' ')}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color:'var(--text-primary)' }}>{fmt(e.basic_salary)}</td>
                                                <td className="px-3 py-2.5 text-xs">{e.pf_applicable?'✓':'—'}</td>
                                                <td className="px-3 py-2.5 text-xs">{e.esi_applicable?'✓':'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.is_active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                                                        {e.is_active?'Active':'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {!empLoading && employees.length === 0 && (
                                            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No employees found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ATTENDANCE */}
                    {tab === 'Attendance' && (
                        <div className="space-y-4">
                            <div className="flex gap-3 items-center">
                                <input type="date" value={attDate} onChange={e=>setAttDate(e.target.value)} className={iCls+' w-40'} style={inp} />
                                <button onClick={handleMarkAttendance} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:'#10b981' }}>
                                    <CheckCircle2 className="h-4 w-4" /> Save Attendance
                                </button>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Employee','Department','Status'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {attRecords.map(e => (
                                            <tr key={e.id} className="border-b" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5">
                                                    <p className="text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{e.name}</p>
                                                    <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{e.emp_code}</p>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{e.department||'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {Object.keys(STATUS_COLORS).map(s => (
                                                            <button key={s} onClick={() => setBulkAtt(prev => ({...prev,[e.id]:s}))}
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${bulkAtt[e.id]===s?'text-white border-transparent':'border-transparent'}`}
                                                                style={bulkAtt[e.id]===s?{background:STATUS_COLORS[s]}:{background:'var(--bg-primary)',color:'var(--text-secondary)',borderColor:'var(--border-color)'}}>
                                                                {s.replace('_',' ')}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* SALARY */}
                    {tab === 'Salary' && (
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <input type="month" value={salMonth} onChange={e=>setSalMonth(e.target.value)} className={iCls+' w-40'} style={inp} />
                                <button onClick={handleGenSalary} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                                    <FileText className="h-4 w-4" /> Generate Salaries
                                </button>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Employee','Month','Days','Basic','HRA+DA','Gross','Deductions','Net Pay','Status'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {slips.map(s => (
                                            <tr key={s.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{s.emp_name}<p className="text-[10px] font-normal text-gray-400">{s.emp_code}</p></td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(s.slip_month).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</td>
                                                <td className="px-3 py-2.5 text-xs">{s.present_days}/{s.working_days}</td>
                                                <td className="px-3 py-2.5 text-xs">{fmt(s.basic)}</td>
                                                <td className="px-3 py-2.5 text-xs">{fmt(parseFloat(s.hra)+parseFloat(s.da))}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold">{fmt(s.gross)}</td>
                                                <td className="px-3 py-2.5 text-xs text-red-500">{fmt(parseFloat(s.pf_deduct)+parseFloat(s.esi_deduct)+parseFloat(s.advance_deduct||0))}</td>
                                                <td className="px-3 py-2.5 text-sm font-extrabold" style={{ color:ORANGE }}>{fmt(s.net_pay)}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status==='paid'?'bg-emerald-100 text-emerald-700':s.status==='approved'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-500'}`}>
                                                        {s.status?.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {!slipLoading && slips.length === 0 && (
                                            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No salary slips for this month. Click Generate.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* LEAVES */}
                    {tab === 'Leaves' && (
                        <div className="space-y-4">
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Employee','Leave Type','From','To','Days','Reason','Status','Action'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{l.emp_name}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{l.leave_type_name||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(l.from_date).toLocaleDateString('en-IN')}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(l.to_date).toLocaleDateString('en-IN')}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold">{l.days}</td>
                                                <td className="px-3 py-2.5 text-xs max-w-32 truncate" style={{ color:'var(--text-secondary)' }}>{l.reason||'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.status==='approved'?'bg-emerald-100 text-emerald-700':l.status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>
                                                        {l.status?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {l.status === 'pending' && (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleApproveLeave(l.id,'approved')} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white font-bold">Approve</button>
                                                            <button onClick={() => handleApproveLeave(l.id,'rejected')} className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white font-bold">Reject</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {!leaveLoading && leaves.length === 0 && (
                                            <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No leave applications</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAILOR WORK */}
                    {tab === 'Tailor Work' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={() => setShowTailorForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                                    <Plus className="h-4 w-4" /> Add Work Entry
                                </button>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Tailor','Date','Order Ref','Item','Qty','Rate','Amount','Status','Paid Date'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {tailorWork.map(w => (
                                            <tr key={w.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{w.emp_name}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(w.work_date).toLocaleDateString('en-IN')}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{w.order_ref||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs max-w-40 truncate" style={{ color:'var(--text-primary)' }}>{w.item_desc}</td>
                                                <td className="px-3 py-2.5 text-xs">{w.qty}</td>
                                                <td className="px-3 py-2.5 text-xs">{fmt(w.rate_per_piece)}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{fmt(w.amount)}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.status==='paid'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>
                                                        {w.status?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{w.paid_date?new Date(w.paid_date).toLocaleDateString('en-IN'):'—'}</td>
                                            </tr>
                                        ))}
                                        {!tailorLoading && tailorWork.length === 0 && (
                                            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No tailor work entries</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Tailor Work Form */}
            {showTailorForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Add Tailor Work</h3>
                            <button onClick={() => setShowTailorForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Tailor</label>
                                <select value={tailorForm.employee_id} onChange={e=>setTailorForm(f=>({...f,employee_id:e.target.value}))} className={iCls} style={inp}>
                                    <option value="">-- Select Tailor --</option>
                                    {tailors.map(t => <option key={t.id} value={t.id}>{t.name} ({t.emp_code})</option>)}
                                </select>
                            </div>
                            {[['work_date','Work Date','date'],['order_ref','Order Ref','text'],['item_desc','Item Description','text'],['qty','Qty','number'],['rate_per_piece','Rate / Piece','number']].map(([k,l,type]) => (
                                <div key={k}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input type={type} value={tailorForm[k]} onChange={e=>setTailorForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                </div>
                            ))}
                            <div className="flex gap-3">
                                <button onClick={() => setShowTailorForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleAddTailorWork} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Save</button>
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
