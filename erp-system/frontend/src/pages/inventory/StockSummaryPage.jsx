import React, { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, Download, BarChart3 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const fmt = (v) => `₹${Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function StockSummaryPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [items, setItems]             = useState([]);
    const [schools, setSchools]         = useState([]);
    const [categories, setCategories]   = useState([]);
    const [totalValue, setTotalValue]   = useState(0);
    const [loading, setLoading]         = useState(true);

    const [search,     setSearch]     = useState('');
    const [schoolId,   setSchoolId]   = useState('');
    const [catId,      setCatId]      = useState('');
    const [lowOnly,    setLowOnly]    = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search)   params.set('search', search);
            if (schoolId) params.set('school_id', schoolId);
            if (catId)    params.set('category_id', catId);
            if (lowOnly)  params.set('low_stock', 'true');

            const [s, sc, c] = await Promise.all([
                api.get(`/inv/stock?${params}`),
                api.get('/inv/schools'),
                api.get('/inv/categories'),
            ]);
            setItems(s.data.items);
            setTotalValue(s.data.total_value);
            setSchools(sc.data);
            setCategories(c.data);
        } catch { } finally { setLoading(false); }
    }, [search, schoolId, catId, lowOnly]);

    useEffect(() => { load(); }, [load]);

    const exportCSV = () => {
        const headers = 'Product,School,Size,Color,SKU,Qty,Purchase Price,Sale Price,Stock Value';
        const rows = items.map(i => `"${i.product_name}","${i.school_name||''}","${i.size||''}","${i.color||''}","${i.sku||''}",${i.qty},${i.purchase_price},${i.sale_price},${i.stock_value}`);
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stock.csv'; a.click();
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1">
                        <BarChart3 className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        <div>
                            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>Stock Summary</h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Total Value: <strong className="text-teal-600">{fmt(totalValue)}</strong> · {items.length} variants
                            </p>
                        </div>
                    </div>
                    <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                        <Download className="h-4 w-4" /> CSV
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="relative flex-1 min-w-40">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product / SKU…"
                                className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Schools</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={catId} onChange={e => setCatId(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <label className="flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer select-none text-sm" style={{ background: lowOnly ? 'rgba(239,68,68,0.08)' : 'var(--bg-surface)', borderColor: lowOnly ? '#ef4444' : 'var(--border-color)', color: lowOnly ? '#ef4444' : 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="sr-only" />
                            <AlertTriangle className="h-4 w-4" /> Low Stock Only
                        </label>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Product','School','Size','Color','SKU','Qty','Min Stock','Purchase ₹','Sale ₹','Stock Value','Status'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? (
                                        Array(8).fill(0).map((_, i) => (
                                            <tr key={i}><td colSpan={11} className="px-3 py-2.5"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></td></tr>
                                        ))
                                    ) : items.length === 0 ? (
                                        <tr><td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No stock data found.</td></tr>
                                    ) : items.map(item => (
                                        <tr key={item.variant_id} className={`transition-colors ${item.low_stock ? 'bg-red-50/30' : 'hover:bg-orange-50/20'}`}>
                                            <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{item.product_name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.school_name || '—'}</td>
                                            <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{item.size || '—'}</span></td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.color || '—'}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{item.sku || '—'}</td>
                                            <td className="px-3 py-2.5 font-bold text-center" style={{ color: parseFloat(item.qty)===0 ? '#ef4444' : 'var(--text-primary)' }}>{item.qty}</td>
                                            <td className="px-3 py-2.5 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>{item.min_stock}</td>
                                            <td className="px-3 py-2.5 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>₹{item.purchase_price}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: '#FF6B00' }}>₹{item.sale_price}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-teal-700">₹{Number(item.stock_value).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-2.5">
                                                {item.low_stock ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                                        <AlertTriangle className="h-3 w-3" /> Low
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">OK</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
