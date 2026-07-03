import React, { useState, useEffect } from 'react';
import { Factory, RefreshCw, CheckCircle2, AlertCircle, TrendingDown, Package, ShoppingCart } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';
const TABS = ['Stock Analysis','Purchase Suggestions'];

const CLASS_COLORS = { out_of_stock:'#ef4444', low_stock:'#f59e0b', dead_stock:'#6b7280', ok:'#10b981' };

export default function MRPPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState('Stock Analysis');
    const [toast, setToast] = useState(null);
    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const [analysis, setAnalysis] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [classFilter, setClassFilter] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            if (tab === 'Stock Analysis') {
                const r = await api.get('/mrp/stock-analysis', { params:{ classification: classFilter||undefined } });
                setAnalysis(r.data);
            } else {
                const r = await api.get('/mrp/suggestions');
                setSuggestions(r.data);
            }
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [tab, classFilter]);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const r = await api.post('/mrp/generate');
            showMsg(`Generated ${r.data.suggestions} purchase suggestions`);
            const r2 = await api.get('/mrp/suggestions');
            setSuggestions(r2.data);
            setTab('Purchase Suggestions');
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
        finally { setLoading(false); }
    };

    const handleApprove = async (id) => {
        try {
            await api.put(`/mrp/suggestions/${id}/approve`);
            showMsg('Suggestion approved');
            const r = await api.get('/mrp/suggestions');
            setSuggestions(r.data);
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const classGroups = analysis.reduce((g,r) => {
        (g[r.classification] = g[r.classification] || []).push(r);
        return g;
    }, {});

    const filtered = classFilter ? (classGroups[classFilter]||[]) : analysis;

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
                    <Factory className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Purchase Planning (MRP)</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                    <button onClick={handleGenerate} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:'#8b5cf6' }}>
                        <RefreshCw className="h-4 w-4" /> Generate Suggestions
                    </button>
                </header>

                {/* Summary stats */}
                <div className="flex gap-3 px-4 md:px-6 py-3 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor:'var(--border-color)' }}>
                    {Object.entries(CLASS_COLORS).map(([cls, color]) => {
                        const count = (classGroups[cls]||[]).length;
                        return (
                            <button key={cls} onClick={() => setClassFilter(classFilter===cls?'':cls)}
                                className={`flex-shrink-0 rounded-xl border px-4 py-2.5 transition-all ${classFilter===cls?'ring-2 ring-offset-1':''}`}
                                style={{ background:'var(--bg-surface)', borderColor: classFilter===cls?color:'var(--border-color)', ringColor: color }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{cls.replace('_',' ')}</p>
                                <p className="text-xl font-extrabold" style={{ color }}>{count}</p>
                            </button>
                        );
                    })}
                </div>

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
                    {tab === 'Stock Analysis' && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <table className="w-full text-sm">
                                <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['SKU','Product','Category','Current Stock','Reorder Point','3M Avg Sales/Day','Days Stock Left','Status'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {filtered.map(r => (
                                        <tr key={r.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color:ORANGE }}>{r.sku}</td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{r.name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{r.category||'—'}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: parseInt(r.stock_qty)<=0?'#ef4444':parseInt(r.stock_qty)<parseInt(r.reorder_point)?'#f59e0b':'#10b981' }}>{r.stock_qty}</td>
                                            <td className="px-3 py-2.5 text-xs">{r.reorder_point||'—'}</td>
                                            <td className="px-3 py-2.5 text-xs">{parseFloat(r.avg_daily_sales||0).toFixed(2)}</td>
                                            <td className="px-3 py-2.5 text-xs">{r.days_of_stock != null ? Math.round(r.days_of_stock) : '—'}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                                    style={{ background: CLASS_COLORS[r.classification]||ORANGE }}>
                                                    {r.classification?.replace('_',' ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filtered.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No items match this filter</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'Purchase Suggestions' && (
                        <div className="space-y-4">
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['SKU','Product','Current Stock','Reorder Qty','Suggested Vendor','Est. Cost','Status','Action'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {suggestions.map(s => (
                                            <tr key={s.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-mono" style={{ color:ORANGE }}>{s.sku}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{s.product_name}</td>
                                                <td className="px-3 py-2.5 text-xs text-red-500 font-bold">{s.current_stock}</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{s.suggested_qty}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{s.suggested_supplier||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs">{s.estimated_cost?fmt(s.estimated_cost):'—'}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status==='approved'?'bg-emerald-100 text-emerald-700':s.status==='converted'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
                                                        {s.status?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {s.status === 'pending' && (
                                                        <button onClick={() => handleApprove(s.id)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white font-bold">Approve</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && suggestions.length === 0 && (
                                            <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>
                                                No suggestions. Click "Generate Suggestions" to run MRP analysis.
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.type==='error'?'bg-red-600':'bg-emerald-600'} text-white`}>
                    {toast.type==='error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
