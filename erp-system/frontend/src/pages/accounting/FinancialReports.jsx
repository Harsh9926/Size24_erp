import React, { useState, useEffect } from 'react';
import { Scale, TrendingUp, BarChart3, RefreshCw, Printer, BookOpen, DollarSign, Landmark, FileText, Plus, AlertCircle, CheckCircle2, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

function ReportShell({ icon: Icon, title, children, onPrint, loading }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
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
                    <Icon className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>{title}</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                    {onPrint && <button onClick={onPrint} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                        <Printer className="h-4 w-4" /> Print
                    </button>}
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
            </div>
        </div>
    );
}

/* ── Trial Balance ─────────────────────────────────────── */
export function TrialBalance() {
    const [from, setFrom] = useState('');
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/accounting/trial-balance', { params:{ from:from||undefined, to } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [from, to]);

    const totalDr = data.reduce((s,r) => s + parseFloat(r.total_dr||0), 0);
    const totalCr = data.reduce((s,r) => s + parseFloat(r.total_cr||0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.01;

    return (
        <ReportShell icon={Scale} title="Trial Balance" loading={loading}
            onPrint={() => window.print()}>
            <div className="flex gap-3 mb-4 flex-wrap">
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                <span className="text-sm self-center" style={{ color:'var(--text-secondary)' }}>to</span>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} className={iCls} style={inp} />
                <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>Run</button>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                            {['Code','Account Name','Type','Opening Dr','Opening Cr','Period Dr','Period Cr','Total Dr','Total Cr'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(r => (
                            <tr key={r.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                <td className="px-3 py-2 text-xs font-mono" style={{ color:ORANGE }}>{r.code}</td>
                                <td className="px-3 py-2 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{r.name}</td>
                                <td className="px-3 py-2 text-xs capitalize" style={{ color:'var(--text-secondary)' }}>{r.type}</td>
                                <td className="px-3 py-2 text-xs text-right">{parseFloat(r.opening_dr)>0?fmt(r.opening_dr):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right">{parseFloat(r.opening_cr)>0?fmt(r.opening_cr):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right text-emerald-600">{parseFloat(r.period_dr)>0?fmt(r.period_dr):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right text-red-500">{parseFloat(r.period_cr)>0?fmt(r.period_cr):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right font-bold">{parseFloat(r.total_dr)>0?fmt(r.total_dr):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right font-bold">{parseFloat(r.total_cr)>0?fmt(r.total_cr):'—'}</td>
                            </tr>
                        ))}
                        <tr className="border-t-2 font-bold" style={{ background:'var(--bg-primary)', borderColor: balanced?'#10b981':'#ef4444' }}>
                            <td colSpan={7} className="px-3 py-2 text-xs">
                                Total {balanced ? '✓ Balanced' : '⚠ Imbalanced'}
                            </td>
                            <td className="px-3 py-2 text-xs text-right font-bold text-emerald-600">{fmt(totalDr)}</td>
                            <td className="px-3 py-2 text-xs text-right font-bold text-red-500">{fmt(totalCr)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </ReportShell>
    );
}

/* ── Profit & Loss ─────────────────────────────────────── */
export function ProfitLoss() {
    const curMonth = new Date().toISOString().slice(0,7);
    const [from, setFrom] = useState(`${curMonth}-01`);
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/accounting/profit-loss', { params:{ from, to } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    return (
        <ReportShell icon={TrendingUp} title="Profit & Loss Statement" loading={loading} onPrint={() => window.print()}>
            <div className="flex gap-3 mb-4 flex-wrap">
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                <span className="text-sm self-center" style={{ color:'var(--text-secondary)' }}>to</span>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} className={iCls} style={inp} />
                <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>Run</button>
            </div>
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[['Revenue', data.revenue, data.total_revenue, '#10b981'], ['Expenses', data.expenses, data.total_expenses, '#ef4444']].map(([label, items, total, color]) => (
                        <div key={label} className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>{label}</p>
                            </div>
                            <div className="p-4 space-y-2">
                                {items.map(r => (
                                    <div key={r.code} className="flex justify-between items-center py-1 border-b" style={{ borderColor:'var(--border-color)' }}>
                                        <span className="text-xs" style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                        <span className="text-sm font-semibold" style={{ color }}>{fmt(r.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>Total {label}</span>
                                    <span className="text-lg font-extrabold" style={{ color }}>{fmt(total)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="md:col-span-2 rounded-2xl border p-5 flex items-center justify-between"
                        style={{ background: parseFloat(data.net_profit)>=0?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)', borderColor: parseFloat(data.net_profit)>=0?'#10b981':'#ef4444' }}>
                        <span className="text-lg font-bold" style={{ color:'var(--text-primary)' }}>{parseFloat(data.net_profit)>=0?'Net Profit':'Net Loss'}</span>
                        <span className="text-2xl font-extrabold" style={{ color: parseFloat(data.net_profit)>=0?'#10b981':'#ef4444' }}>{fmt(Math.abs(data.net_profit))}</span>
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

/* ── Balance Sheet ─────────────────────────────────────── */
export function BalanceSheet() {
    const [asOf, setAsOf] = useState(new Date().toISOString().slice(0,10));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/accounting/balance-sheet', { params:{ as_of: asOf } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    return (
        <ReportShell icon={BarChart3} title="Balance Sheet" loading={loading} onPrint={() => window.print()}>
            <div className="flex gap-3 mb-4 flex-wrap">
                <label className="text-sm self-center" style={{ color:'var(--text-secondary)' }}>As of</label>
                <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)} className={iCls} style={inp} />
                <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>Run</button>
            </div>
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Assets */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Assets</p>
                        </div>
                        <div className="p-4 space-y-1">
                            {data.assets.map(r => (
                                <div key={r.code} className="flex justify-between py-1">
                                    <span className="text-xs" style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                    <span className="text-sm font-semibold text-emerald-600">{fmt(r.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between pt-2 border-t font-bold" style={{ borderColor:'var(--border-color)' }}>
                                <span className="text-sm" style={{ color:'var(--text-primary)' }}>Total Assets</span>
                                <span className="text-lg font-extrabold text-emerald-600">{fmt(data.total_assets)}</span>
                            </div>
                        </div>
                    </div>
                    {/* Liabilities + Equity */}
                    <div className="space-y-4">
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                <p className="text-xs font-bold uppercase tracking-widest text-red-500">Liabilities</p>
                            </div>
                            <div className="p-4 space-y-1">
                                {data.liabilities.map(r => (
                                    <div key={r.code} className="flex justify-between py-1">
                                        <span className="text-xs" style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                        <span className="text-sm font-semibold text-red-500">{fmt(r.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t font-bold" style={{ borderColor:'var(--border-color)' }}>
                                    <span className="text-sm" style={{ color:'var(--text-primary)' }}>Total Liabilities</span>
                                    <span className="text-lg font-extrabold text-red-500">{fmt(data.total_liabilities)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <div className="px-5 py-3 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'#8b5cf6' }}>Equity</p>
                            </div>
                            <div className="p-4 space-y-1">
                                {data.equity.map(r => (
                                    <div key={r.code} className="flex justify-between py-1">
                                        <span className="text-xs" style={{ color:'var(--text-primary)' }}>{r.name}</span>
                                        <span className="text-sm font-semibold" style={{ color:'#8b5cf6' }}>{fmt(r.amount)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t font-bold" style={{ borderColor:'var(--border-color)' }}>
                                    <span className="text-sm" style={{ color:'var(--text-primary)' }}>Total Equity</span>
                                    <span className="text-lg font-extrabold" style={{ color:'#8b5cf6' }}>{fmt(data.total_equity)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ReportShell>
    );
}

/* ── Cash Book / Bank Book / Day Book / Ledger ─────────── */
function SimpleBookPage({ icon: Icon, title, apiPath, extraParams, columns }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [from, setFrom] = useState(new Date().toISOString().slice(0,7)+'-01');
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [extraState, setExtraState] = useState({});

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get(apiPath, { params:{ from, to, ...extraParams, ...extraState } });
            setData(Array.isArray(r.data) ? r.data : r.data.entries || r.data.ledger || []);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    let balance = 0;
    const rows = data.map(row => {
        balance += parseFloat(row.dr_amount||0) - parseFloat(row.cr_amount||0);
        return { ...row, running_balance: balance };
    });

    return (
        <ReportShell icon={Icon || BookOpen} title={title} loading={loading} onPrint={() => window.print()}>
            <div className="flex gap-3 mb-4 flex-wrap">
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                <span className="text-sm self-center" style={{ color:'var(--text-secondary)' }}>to</span>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} className={iCls} style={inp} />
                <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>Run</button>
            </div>
            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                            {['Date','Entry#','Narration','Debit','Credit','Balance'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r,i) => (
                            <tr key={i} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                <td className="px-3 py-2 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(r.entry_date).toLocaleDateString('en-IN')}</td>
                                <td className="px-3 py-2 text-xs font-mono" style={{ color:ORANGE }}>{r.entry_number}</td>
                                <td className="px-3 py-2 text-xs max-w-64 truncate" style={{ color:'var(--text-primary)' }}>{r.narration||r.line_narration||r.je_narration}</td>
                                <td className="px-3 py-2 text-xs text-right text-emerald-600 font-semibold">{parseFloat(r.dr_amount)>0?fmt(r.dr_amount):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right text-red-500 font-semibold">{parseFloat(r.cr_amount)>0?fmt(r.cr_amount):'—'}</td>
                                <td className="px-3 py-2 text-xs text-right font-bold" style={{ color: r.running_balance>=0?'#10b981':'#ef4444' }}>{fmt(Math.abs(r.running_balance))} {r.running_balance>=0?'Dr':'Cr'}</td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No entries found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ReportShell>
    );
}

export function CashBook() {
    return <SimpleBookPage icon={DollarSign} title="Cash Book" apiPath="/accounting/cash-book" />;
}
export function BankBook() {
    return <SimpleBookPage icon={Landmark} title="Bank Book" apiPath="/accounting/bank-book" />;
}

/* ── GST Ledger ─────────────────────────────────────────── */
export function GSTLedger() {
    const [from, setFrom] = useState(new Date().toISOString().slice(0,7)+'-01');
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [gstType, setGstType] = useState('');
    const [data, setData] = useState({ ledger:[], totals:{} });
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/accounting/gst-ledger', { params:{ from, to, gst_type:gstType||undefined } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

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
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>GST Ledger</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                        <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className={iCls} style={inp} />
                        <select value={gstType} onChange={e=>setGstType(e.target.value)} className={iCls} style={inp}>
                            <option value="">All</option>
                            <option value="collected">Collected (Output)</option>
                            <option value="paid">Paid (Input)</option>
                        </select>
                        <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>Run</button>
                    </div>
                    {/* Totals */}
                    <div className="grid grid-cols-4 gap-3">
                        {[['Taxable',data.totals.taxable,'#6366f1'],['CGST',data.totals.cgst,'#3b82f6'],['SGST',data.totals.sgst,'#8b5cf6'],['Total GST',data.totals.total,ORANGE]].map(([l,v,c]) => (
                            <div key={l} className="rounded-2xl border p-3" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{l}</p>
                                <p className="text-lg font-extrabold mt-0.5" style={{ color:c }}>{fmt(v)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Date','Ref#','Type','Party','GSTIN','Taxable','CGST','SGST','IGST','Total','I/O'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ledger.map((r,i) => (
                                        <tr key={i} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{new Date(r.entry_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2 text-xs font-mono" style={{ color:ORANGE }}>{r.ref_number}</td>
                                            <td className="px-3 py-2 text-xs capitalize" style={{ color:'var(--text-secondary)' }}>{r.ref_type}</td>
                                            <td className="px-3 py-2 text-xs" style={{ color:'var(--text-primary)' }}>{r.party_name}</td>
                                            <td className="px-3 py-2 text-xs font-mono" style={{ color:'var(--text-secondary)' }}>{r.gstin||'—'}</td>
                                            <td className="px-3 py-2 text-xs text-right">{fmt(r.taxable_amount)}</td>
                                            <td className="px-3 py-2 text-xs text-right">{fmt(r.cgst)}</td>
                                            <td className="px-3 py-2 text-xs text-right">{fmt(r.sgst)}</td>
                                            <td className="px-3 py-2 text-xs text-right">{fmt(r.igst)}</td>
                                            <td className="px-3 py-2 text-xs text-right font-bold" style={{ color:ORANGE }}>{fmt(r.total_gst)}</td>
                                            <td className="px-3 py-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.gst_type==='collected'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>
                                                    {r.gst_type==='collected'?'OUT':'IN'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.ledger.length === 0 && (
                                        <tr><td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No GST entries</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Ledger (Account-wise) ──────────────────────────────── */
export function AccountLedger() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [from, setFrom] = useState(new Date().toISOString().slice(0,7)+'-01');
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/accounting/accounts').then(r => setAccounts(r.data)).catch(()=>{});
    }, []);

    const load = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        try {
            const r = await api.get('/accounting/ledger', { params:{ account_id: selectedAccount, from, to } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
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
                    <Landmark className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Account Ledger</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} className={iCls+' flex-1 min-w-48'} style={inp}>
                            <option value="">-- Select Account --</option>
                            {accounts.filter(a=>!a.is_group).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                        <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className={iCls} style={inp} />
                        <button onClick={load} disabled={!selectedAccount} className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background:ORANGE }}>View Ledger</button>
                    </div>

                    {data && (
                        <>
                            <div className="flex gap-3">
                                {[['Account',data.account.name],['Code',data.account.code],['Opening Dr',fmt(data.opening_dr)],['Opening Cr',fmt(data.opening_cr)]].map(([l,v]) => (
                                    <div key={l} className="rounded-xl border px-3 py-2" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{l}</p>
                                        <p className="text-sm font-bold" style={{ color:'var(--text-primary)' }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                            {['Date','Entry#','Type','Narration','Debit','Credit','Balance'].map(h => (
                                                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.ledger.map((r,i) => (
                                            <tr key={i} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(r.entry_date).toLocaleDateString('en-IN')}</td>
                                                <td className="px-3 py-2 text-xs font-mono" style={{ color:ORANGE }}>{r.entry_number}</td>
                                                <td className="px-3 py-2 text-xs" style={{ color:'var(--text-secondary)' }}>{r.entry_type}</td>
                                                <td className="px-3 py-2 text-xs max-w-48 truncate" style={{ color:'var(--text-primary)' }}>{r.je_narration}</td>
                                                <td className="px-3 py-2 text-xs text-right text-emerald-600 font-semibold">{parseFloat(r.dr_amount)>0?fmt(r.dr_amount):'—'}</td>
                                                <td className="px-3 py-2 text-xs text-right text-red-500 font-semibold">{parseFloat(r.cr_amount)>0?fmt(r.cr_amount):'—'}</td>
                                                <td className="px-3 py-2 text-xs text-right font-bold" style={{ color: r.running_balance>=0?'#10b981':'#ef4444' }}>
                                                    {fmt(Math.abs(r.running_balance))} {r.running_balance>=0?'Dr':'Cr'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Vouchers Page ──────────────────────────────────────── */
export function VouchersPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [vouchers, setVouchers] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [from, setFrom] = useState(new Date().toISOString().slice(0,7)+'-01');
    const [to, setTo]     = useState(new Date().toISOString().slice(0,10));
    const [vType, setVType] = useState('payment');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ voucher_type:'payment', voucher_date:new Date().toISOString().slice(0,10), party_name:'', amount:'', payment_mode:'cash', narration:'', debit_account_id:'', credit_account_id:'' });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);

    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const load = async () => {
        setLoading(true);
        try {
            const [vR, aR] = await Promise.all([
                api.get('/accounting/vouchers', { params:{ voucher_type:vType, from, to } }),
                api.get('/accounting/accounts'),
            ]);
            setVouchers(vR.data); setAccounts(aR.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [from, to, vType]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/accounting/vouchers', form);
            showMsg('Voucher created'); setShowForm(false); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
        finally { setSaving(false); }
    };

    const VT_COLORS = { payment:'#ef4444', receipt:'#10b981', contra:'#6366f1' };

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
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Vouchers</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                    <button onClick={() => { setForm(f=>({...f,voucher_type:vType})); setShowForm(true); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                        <Plus className="h-4 w-4" /> New Voucher
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        {['payment','receipt','contra'].map(t => (
                            <button key={t} onClick={()=>setVType(t)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${vType===t?'text-white':'border'}`}
                                style={vType===t?{background:VT_COLORS[t]}:{borderColor:'var(--border-color)',background:'var(--bg-surface)',color:'var(--text-secondary)'}}>
                                {t.charAt(0).toUpperCase()+t.slice(1)} Voucher
                            </button>
                        ))}
                        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={iCls} style={inp} />
                        <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className={iCls} style={inp} />
                    </div>
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['Date','Voucher#','Party','Amount','Mode','Narration','By'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vouchers.map(v => (
                                    <tr key={v.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(v.voucher_date).toLocaleDateString('en-IN')}</td>
                                        <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:VT_COLORS[v.voucher_type]||ORANGE }}>{v.voucher_number}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-primary)' }}>{v.party_name||'—'}</td>
                                        <td className="px-3 py-2.5 text-xs font-bold text-right" style={{ color:VT_COLORS[v.voucher_type]||ORANGE }}>₹{Number(v.amount).toLocaleString('en-IN')}</td>
                                        <td className="px-3 py-2.5 text-xs capitalize" style={{ color:'var(--text-secondary)' }}>{v.payment_mode}</td>
                                        <td className="px-3 py-2.5 text-xs max-w-40 truncate" style={{ color:'var(--text-secondary)' }}>{v.narration}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{v.created_by_name}</td>
                                    </tr>
                                ))}
                                {!loading && vouchers.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No vouchers found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm capitalize" style={{ color:'var(--text-primary)' }}>New {form.voucher_type} Voucher</h3>
                            <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            {[['voucher_type','Type','select',['payment','receipt','contra']],['voucher_date','Date','date'],['party_name','Party Name','text'],['amount','Amount','number'],['payment_mode','Mode','select',['cash','bank','upi','cheque']],['narration','Narration','text']].map(([k,l,type,opts]) => (
                                <div key={k} className={k==='narration'?'col-span-2':''}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    {type==='select' ? (
                                        <select value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp}>
                                            {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input type={type} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                    )}
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Debit Account</label>
                                <select value={form.debit_account_id} onChange={e=>setForm(f=>({...f,debit_account_id:e.target.value}))} className={iCls} style={inp}>
                                    <option value="">-- Select --</option>
                                    {accounts.filter(a=>!a.is_group).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Credit Account</label>
                                <select value={form.credit_account_id} onChange={e=>setForm(f=>({...f,credit_account_id:e.target.value}))} className={iCls} style={inp}>
                                    <option value="">-- Select --</option>
                                    {accounts.filter(a=>!a.is_group).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 flex gap-3">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:VT_COLORS[form.voucher_type]||ORANGE }}>
                                    {saving?'Saving…':'Create Voucher'}
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

