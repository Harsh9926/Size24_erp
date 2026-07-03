import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, Play, Square, Plus, Minus, RefreshCw,
    Clock, TrendingUp, BarChart3, CheckCircle2, AlertCircle,
    Printer, X, ChevronDown,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const fmt  = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';
const today = () => new Date().toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
const ORANGE = '#FF6B00';

const PAY_COLORS = { cash:'#10b981', upi:'#8b5cf6', card:'#3b82f6', bank:'#6366f1', wallet:'#f59e0b', split:'#FF6B00' };

function StatCard({ icon: Icon, label, value, color = ORANGE, sub }) {
    return (
        <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
            <div className="rounded-xl p-2.5" style={{ background:`${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{label}</p>
                <p className="text-xl font-extrabold mt-0.5" style={{ color:'var(--text-primary)' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>{sub}</p>}
            </div>
        </div>
    );
}

export default function CashCounterPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [session, setSession]         = useState(null);
    const [sessions, setSessions]       = useState([]);
    const [warehouses, setWarehouses]   = useState([]);
    const [loading, setLoading]         = useState(true);
    const [report, setReport]           = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);

    // Open shift form
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [openForm, setOpenForm]         = useState({ opening_cash: '', warehouse_id: '', notes: '' });

    // Close shift form
    const [showCloseForm, setShowCloseForm] = useState(false);
    const [closeForm, setCloseForm]         = useState({ physical_cash: '', notes: '' });

    // Cash movement form
    const [showMovement, setShowMovement] = useState(false);
    const [movType, setMovType]           = useState('cash_in');
    const [movForm, setMovForm]           = useState({ amount: '', reason: '' });

    const [saving, setSaving] = useState(false);
    const [toast, setToast]   = useState(null);

    const showMsg = (msg, type='success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [sess, allSess, wh] = await Promise.all([
                api.get('/pos2/sessions/current'),
                api.get('/pos2/sessions'),
                api.get('/pos2/warehouses'),
            ]);
            setSession(sess.data);
            setSessions(allSess.data);
            setWarehouses(wh.data);
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const loadReport = async (sessId) => {
        try {
            const r = await api.get(`/pos2/sessions/${sessId}/report`);
            setReport(r.data);
            setSelectedSession(sessId);
        } catch {}
    };

    const handleOpenShift = async () => {
        setSaving(true);
        try {
            await api.post('/pos2/sessions/open', openForm);
            setShowOpenForm(false);
            setOpenForm({ opening_cash: '', warehouse_id: '', notes: '' });
            showMsg('Shift opened successfully');
            load();
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSaving(false); }
    };

    const handleCloseShift = async () => {
        if (!session) return;
        setSaving(true);
        try {
            const r = await api.post(`/pos2/sessions/${session.id}/close`, closeForm);
            setShowCloseForm(false);
            showMsg(`Shift closed. Difference: ${fmt(r.data.difference)}`);
            load();
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSaving(false); }
    };

    const handleMovement = async () => {
        if (!session || !movForm.amount) return;
        setSaving(true);
        try {
            await api.post('/pos2/sessions/movement', {
                session_id: session.id,
                type: movType,
                amount: movForm.amount,
                reason: movForm.reason,
            });
            setShowMovement(false);
            setMovForm({ amount: '', reason: '' });
            showMsg(`${movType === 'cash_in' ? 'Cash In' : 'Cash Out'} recorded`);
            load();
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSaving(false); }
    };

    const printReport = () => {
        if (!report) return;
        const win = window.open('', '_blank');
        const s = report.session;
        win.document.write(`
            <html><head><title>Shift Report</title>
            <style>body{font-family:monospace;padding:20px;font-size:12px}
            h2{font-size:16px}table{width:100%;border-collapse:collapse}
            td,th{padding:4px 8px;border-bottom:1px solid #ddd;text-align:left}
            .right{text-align:right}.total{font-weight:bold;font-size:14px}
            </style></head><body>
            <h2>SHIFT REPORT — ${s.id}</h2>
            <p>Opened: ${new Date(s.opened_at).toLocaleString('en-IN')}</p>
            <p>Closed: ${s.closed_at ? new Date(s.closed_at).toLocaleString('en-IN') : 'Still Open'}</p>
            <p>By: ${s.opened_by_name || '-'}</p>
            <hr/>
            <table>
                <tr><th>Item</th><th class="right">Amount</th></tr>
                <tr><td>Opening Cash</td><td class="right">${fmt(s.opening_cash)}</td></tr>
                ${(report.cash_movements||[]).filter(m=>m.type==='cash_in').map(m=>`<tr><td>Cash In: ${m.reason||''}</td><td class="right">${fmt(m.amount)}</td></tr>`).join('')}
                ${(report.cash_movements||[]).filter(m=>m.type==='cash_out').map(m=>`<tr><td>Cash Out: ${m.reason||''}</td><td class="right">- ${fmt(m.amount)}</td></tr>`).join('')}
                <tr><td>Expected Cash</td><td class="right">${fmt(s.expected_cash)}</td></tr>
                <tr><td>Physical Cash</td><td class="right">${fmt(s.physical_cash)}</td></tr>
                <tr class="total"><td>Difference</td><td class="right" style="color:${parseFloat(s.difference||0)>=0?'green':'red'}">${fmt(s.difference)}</td></tr>
            </table>
            <hr/>
            <h3>Payment Breakdown</h3>
            <table>
                ${(report.payment_breakdown||[]).map(p=>`<tr><td>${p.payment_mode?.toUpperCase()}</td><td class="right">${fmt(p.total)}</td></tr>`).join('')}
            </table>
            <hr/>
            <p class="total">Total Sales: ${fmt(s.total_sales)}</p>
            <p>Total Orders: ${s.total_orders}</p>
            </body></html>
        `);
        win.document.close();
        win.print();
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Header */}
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1">
                        <DollarSign className="h-5 w-5" style={{ color:ORANGE }} />
                        <h1 className="text-base font-bold" style={{ color:'var(--text-primary)' }}>Cash Counter</h1>
                    </div>
                    <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`} style={{ color:'var(--text-secondary)' }} />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {/* Current Session Status */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" style={{ color:ORANGE }} />
                                <span className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Current Shift</span>
                                <span className="text-xs" style={{ color:'var(--text-secondary)' }}>{today()}</span>
                            </div>
                            <div className="flex gap-2">
                                {session ? (
                                    <>
                                        <button onClick={() => { setMovType('cash_in'); setShowMovement(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                            <Plus className="h-3.5 w-3.5" /> Cash In
                                        </button>
                                        <button onClick={() => { setMovType('cash_out'); setShowMovement(true); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200">
                                            <Minus className="h-3.5 w-3.5" /> Cash Out
                                        </button>
                                        <button onClick={() => setShowCloseForm(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                            style={{ background:'#ef4444' }}>
                                            <Square className="h-3.5 w-3.5" /> End Shift
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => setShowOpenForm(true)}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white"
                                        style={{ background:ORANGE }}>
                                        <Play className="h-4 w-4" /> Start Shift
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-6"><div className="h-20 rounded-xl animate-pulse" style={{ background:'var(--bg-primary)' }} /></div>
                        ) : session ? (
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-sm font-bold text-emerald-600">Shift Active</span>
                                    <span className="text-xs" style={{ color:'var(--text-secondary)' }}>
                                        Started: {new Date(session.opened_at).toLocaleTimeString('en-IN')}
                                    </span>
                                    {session.warehouse_name && (
                                        <span className="text-xs px-2 py-0.5 rounded" style={{ background:'rgba(255,107,0,0.1)',color:ORANGE }}>
                                            {session.warehouse_name}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <StatCard icon={DollarSign} label="Opening Cash" value={fmt(session.opening_cash)} color="#10b981" />
                                    <StatCard icon={TrendingUp}  label="Today's Sales" value={fmt(session.total_sales || 0)} color={ORANGE} sub={`${session.total_orders||0} orders`} />
                                    <StatCard icon={BarChart3}   label="Session ID" value={`#${session.id}`} color="#8b5cf6" sub={`By ${session.opened_by_name||'—'}`} />
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color:'var(--text-secondary)' }} />
                                <p className="text-sm font-semibold" style={{ color:'var(--text-secondary)' }}>No active shift</p>
                                <p className="text-xs mt-1" style={{ color:'var(--text-secondary)' }}>Start a shift to begin billing</p>
                            </div>
                        )}
                    </div>

                    {/* Previous Sessions */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Shift History</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['#','Opened By','Start','End','Opening','Sales','Expected','Physical','Diff','Status',''].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map(s => (
                                        <tr key={s.id} className="border-b hover:bg-orange-50/10 transition-colors" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>#{s.id}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-primary)' }}>{s.opened_by_name || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>
                                                {new Date(s.opened_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>
                                                {s.closed_at ? new Date(s.closed_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-right">{fmt(s.opening_cash)}</td>
                                            <td className="px-3 py-2.5 text-xs text-right font-semibold" style={{ color:ORANGE }}>{fmt(s.total_sales)}</td>
                                            <td className="px-3 py-2.5 text-xs text-right">{s.expected_cash ? fmt(s.expected_cash) : '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-right">{s.physical_cash ? fmt(s.physical_cash) : '—'}</td>
                                            <td className="px-3 py-2.5 text-xs text-right font-bold"
                                                style={{ color: s.difference > 0 ? '#10b981' : s.difference < 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                                                {s.difference != null ? fmt(s.difference) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status==='open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {s.status?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <button onClick={() => loadReport(s.id)}
                                                    className="text-xs px-2 py-1 rounded-lg font-semibold border"
                                                    style={{ borderColor:'var(--border-color)', color:ORANGE, background:'var(--bg-primary)' }}>
                                                    Report
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sessions.length === 0 && (
                                        <tr><td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No shift history</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Session Report */}
                    {report && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Shift Report #{report.session.id}</p>
                                <button onClick={printReport} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background:ORANGE }}>
                                    <Printer className="h-3.5 w-3.5" /> Print
                                </button>
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Cash summary */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color:'var(--text-secondary)' }}>Cash Reconciliation</p>
                                    <div className="space-y-2">
                                        {[
                                            ['Opening Cash', fmt(report.session.opening_cash), '#10b981'],
                                            ...(report.cash_movements||[]).filter(m=>m.type==='cash_in').map(m => [`Cash In: ${m.reason||''}`, fmt(m.amount), '#10b981']),
                                            ...(report.cash_movements||[]).filter(m=>m.type==='cash_out').map(m => [`Cash Out: ${m.reason||''}`, `- ${fmt(m.amount)}`, '#ef4444']),
                                            ['Expected Cash', fmt(report.session.expected_cash), '#FF6B00'],
                                            ['Physical Cash', fmt(report.session.physical_cash), '#6366f1'],
                                            ['Difference',    fmt(report.session.difference),    parseFloat(report.session.difference||0) >= 0 ? '#10b981' : '#ef4444'],
                                        ].map(([label, val, color]) => (
                                            <div key={label} className="flex justify-between items-center py-1 border-b" style={{ borderColor:'var(--border-color)' }}>
                                                <span className="text-xs" style={{ color:'var(--text-secondary)' }}>{label}</span>
                                                <span className="text-sm font-bold" style={{ color }}>{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Payment breakdown */}
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color:'var(--text-secondary)' }}>Payment Breakdown</p>
                                    <div className="space-y-2">
                                        {(report.payment_breakdown||[]).map(pm => (
                                            <div key={pm.payment_mode} className="flex justify-between items-center py-1 border-b" style={{ borderColor:'var(--border-color)' }}>
                                                <span className="text-xs capitalize" style={{ color:'var(--text-primary)' }}>{pm.payment_mode} ({pm.txns} txns)</span>
                                                <span className="text-sm font-bold" style={{ color: PAY_COLORS[pm.payment_mode] || ORANGE }}>{fmt(pm.total)}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>Total Sales</span>
                                            <span className="text-lg font-extrabold" style={{ color:ORANGE }}>{fmt(report.session.total_sales)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Open Shift Modal */}
            {showOpenForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
                                <Play className="h-4 w-4 text-emerald-500" /> Start Shift
                            </h3>
                            <button onClick={() => setShowOpenForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Opening Cash (₹)</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={openForm.opening_cash} onChange={e => setOpenForm(f=>({...f,opening_cash:e.target.value}))} placeholder="0.00" autoFocus />
                            </div>
                            {warehouses.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Warehouse</label>
                                    <select className={iCls} style={inp} value={openForm.warehouse_id} onChange={e => setOpenForm(f=>({...f,warehouse_id:e.target.value}))}>
                                        <option value="">All Warehouses</option>
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Notes</label>
                                <input className={iCls} style={inp} value={openForm.notes} onChange={e => setOpenForm(f=>({...f,notes:e.target.value}))} placeholder="Optional…" />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowOpenForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleOpenShift} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:'#10b981' }}>
                                    {saving ? 'Starting…' : 'Start Shift'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {showCloseForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
                                <Square className="h-4 w-4 text-red-500" /> End Shift
                            </h3>
                            <button onClick={() => setShowCloseForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs" style={{ color:'var(--text-secondary)' }}>Count your cash drawer and enter the physical amount to reconcile.</p>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Physical Cash in Drawer (₹)</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={closeForm.physical_cash} onChange={e => setCloseForm(f=>({...f,physical_cash:e.target.value}))} placeholder="0.00" autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Notes</label>
                                <input className={iCls} style={inp} value={closeForm.notes} onChange={e => setCloseForm(f=>({...f,notes:e.target.value}))} />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowCloseForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCloseShift} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:'#ef4444' }}>
                                    {saving ? 'Closing…' : 'End Shift'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cash Movement Modal */}
            {showMovement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>
                                {movType === 'cash_in' ? '💵 Cash In' : '💸 Cash Out'}
                            </h3>
                            <button onClick={() => setShowMovement(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex gap-2">
                                {['cash_in','cash_out'].map(t => (
                                    <button key={t} onClick={() => setMovType(t)}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${movType===t ? 'text-white' : ''}`}
                                        style={movType===t ? { background: t==='cash_in'?'#10b981':'#ef4444' } : { borderColor:'var(--border-color)', color:'var(--text-secondary)', background:'var(--bg-primary)' }}>
                                        {t === 'cash_in' ? '+ Cash In' : '- Cash Out'}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Amount (₹)</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={movForm.amount} onChange={e => setMovForm(f=>({...f,amount:e.target.value}))} autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Reason</label>
                                <input className={iCls} style={inp} value={movForm.reason} onChange={e => setMovForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Petty cash, vendor payment…" />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowMovement(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleMovement} disabled={saving || !movForm.amount} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60"
                                    style={{ background: movType==='cash_in'?'#10b981':'#ef4444' }}>
                                    {saving ? 'Saving…' : 'Record'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.type==='error'?'bg-red-600':'bg-emerald-600'} text-white`}>
                    {toast.type==='error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
