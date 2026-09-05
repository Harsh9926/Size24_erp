import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, AlertTriangle, Download, BarChart3, Store, Upload, X, CheckCircle2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const fmt = (v) => `₹${Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function StockSummaryPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [items, setItems]             = useState([]);
    const [schools, setSchools]         = useState([]);
    const [categories, setCategories]   = useState([]);
    const [shops, setShops]             = useState([]);
    const [totalValue, setTotalValue]   = useState(0);
    const [loading, setLoading]         = useState(true);

    const [search,     setSearch]     = useState('');
    const [schoolId,   setSchoolId]   = useState('');
    const [catId,      setCatId]      = useState('');
    const [lowOnly,    setLowOnly]    = useState(false);
    const [byShop,     setByShop]     = useState(false); // toggle: global stock vs shop-wise breakdown
    const [shopId,     setShopId]     = useState('');    // filter within by-shop mode

    // ── Excel import modal ──────────────────────────────────────────
    const [showImport, setShowImport] = useState(false);
    const [importing, setImporting]   = useState(false);
    const [importSummary, setImportSummary] = useState(null);
    const [importShopId, setImportShopId]   = useState('');
    const fileRef = useRef(null);

    // Best-effort: suggest a shop from the picked file's name.
    const handleFilePicked = () => {
        const file = fileRef.current?.files?.[0];
        if (!file) return;
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toLowerCase();
        const match = shops.find(s => base.includes(s.shop_name.toLowerCase()));
        if (match) setImportShopId(String(match.id));
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (byShop) {
                const params = new URLSearchParams();
                if (shopId)  params.set('shop_id', shopId);
                if (search)  params.set('search', search);
                const r = await api.get(`/inv/shop-stock?${params}`);
                setItems(r.data.items);
                setTotalValue(r.data.total_value);
            } else {
                const params = new URLSearchParams();
                if (search)   params.set('search', search);
                if (schoolId) params.set('school_id', schoolId);
                if (catId)    params.set('category_id', catId);
                if (lowOnly)  params.set('low_stock', 'true');
                const r = await api.get(`/inv/stock?${params}`);
                setItems(r.data.items);
                setTotalValue(r.data.total_value);
            }
        } catch { } finally { setLoading(false); }
    }, [search, schoolId, catId, lowOnly, byShop, shopId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        Promise.all([api.get('/inv/schools'), api.get('/inv/categories'), api.get('/shops')])
            .then(([sc, c, sh]) => { setSchools(sc.data); setCategories(c.data); setShops(sh.data); })
            .catch(() => {});
    }, []);

    const exportCSV = () => {
        if (byShop) {
            const headers = 'Shop,Product,Article Code,SKU,Size,Color,Qty,Purchase Price,Sale Price,Stock Value';
            const rows = items.map(i => `"${i.shop_name}","${i.product_name}","${i.article_code||''}","${i.sku||''}","${i.size||''}","${i.color||''}",${i.qty},${i.purchase_price},${i.sale_price},${i.stock_value}`);
            const csv = [headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shop_wise_stock.csv'; a.click();
        } else {
            const headers = 'Product,School,Size,Color,SKU,Qty,Purchase Price,Sale Price,Stock Value';
            const rows = items.map(i => `"${i.product_name}","${i.school_name||''}","${i.size||''}","${i.color||''}","${i.sku||''}",${i.qty},${i.purchase_price},${i.sale_price},${i.stock_value}`);
            const csv = [headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stock.csv'; a.click();
        }
    };

    const handleImport = async () => {
        const file = fileRef.current?.files?.[0];
        if (!file) return;
        if (!importShopId) { setImportSummary({ error: 'Select the shop this file belongs to' }); return; }
        setImporting(true);
        setImportSummary(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('shop_id', importShopId);
            const r = await api.post('/inv/import-excel', fd);
            setImportSummary(r.data);
            load();
        } catch (e) {
            setImportSummary({ error: e.response?.data?.error || 'Import failed', errors: e.response?.data?.errors || [] });
        } finally { setImporting(false); }
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
                                Total Value: <strong className="text-teal-600">{fmt(totalValue)}</strong> · {items.length} {byShop ? 'shop-item rows' : 'variants'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: '#FF6B00' }}>
                        <Upload className="h-4 w-4" /> Import Excel
                    </button>
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
                        <button onClick={() => setByShop(b => !b)}
                            className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-semibold ${byShop ? 'text-white' : ''}`}
                            style={byShop ? { background: '#FF6B00', borderColor: '#FF6B00' } : { background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                            <Store className="h-4 w-4" /> Shop-wise
                        </button>
                        {byShop ? (
                            <select value={shopId} onChange={e => setShopId(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                <option value="">All Shops</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {(byShop
                                            ? ['Shop','Product','Article Code','Size','Color','Qty','Sale ₹','Purchase ₹','Stock Value']
                                            : ['Product','School','Size','Color','SKU','Qty','Min Stock','Purchase ₹','Sale ₹','Stock Value','Status']
                                        ).map(h => (
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
                                    ) : byShop ? items.map((item, idx) => (
                                        <tr key={`${item.shop_id}-${item.variant_id}-${idx}`} className="transition-colors hover:bg-orange-50/20">
                                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: '#FF6B00' }}>{item.shop_name}</td>
                                            <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{item.product_name}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{item.article_code || '—'}</td>
                                            <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{item.size || '—'}</span></td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.color || '—'}</td>
                                            <td className="px-3 py-2.5 font-bold text-center" style={{ color: parseFloat(item.qty)===0 ? '#ef4444' : 'var(--text-primary)' }}>{item.qty}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: '#FF6B00' }}>₹{item.sale_price}</td>
                                            <td className="px-3 py-2.5 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>₹{item.purchase_price}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-teal-700">₹{Number(item.stock_value).toLocaleString('en-IN')}</td>
                                        </tr>
                                    )) : items.map(item => (
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

            {/* Import Excel modal */}
            {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Import Shop-wise Stock (Excel)</h3>
                            <button onClick={() => { setShowImport(false); setImportSummary(null); setImportShopId(''); }}><X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                Columns read: Item Name, Article Code/SKU (optional), Sale Price, Purchase Price,
                                Item Stock Quantity, Category, Unit, GST% (optional). This file format has no Shop
                                Name column, so pick the shop it belongs to below — every row will be imported as
                                that shop's stock. Products are matched by Article Code/SKU first, then name — no
                                duplicates are created.
                            </p>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Shop</label>
                                <select value={importShopId} onChange={e => setImportShopId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                    <option value="">-- Select Shop --</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                                </select>
                            </div>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFilePicked}
                                className="w-full text-xs px-3 py-2 border rounded-lg" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            <button onClick={handleImport} disabled={importing}
                                className="w-full py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                {importing ? 'Importing…' : 'Upload & Import'}
                            </button>

                            {importSummary && (
                                <div className="rounded-xl border p-3 text-xs space-y-1" style={{ borderColor: 'var(--border-color)' }}>
                                    {importSummary.error ? (
                                        <p className="text-red-600 font-semibold">{importSummary.error}</p>
                                    ) : (
                                        <>
                                            <p className="flex items-center gap-1.5 text-emerald-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Import complete</p>
                                            <p>Products processed: <strong>{importSummary.processed}</strong> / {importSummary.total_rows}</p>
                                            <p>New products created: <strong>{importSummary.products_created}</strong></p>
                                            <p>Existing products reused: <strong>{importSummary.products_updated}</strong></p>
                                            <p>Shop inventory records created/updated: <strong>{importSummary.shop_stock_upserts}</strong></p>
                                            <p>Rows skipped: <strong>{importSummary.rows_skipped}</strong></p>
                                        </>
                                    )}
                                    {importSummary.errors?.length > 0 && (
                                        <div className="mt-2 max-h-40 overflow-y-auto border-t pt-2" style={{ borderColor: 'var(--border-color)' }}>
                                            {importSummary.errors.map((er, i) => (
                                                <p key={i} className="text-red-500">Row {er.row}: {er.error}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
