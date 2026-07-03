import React, { useState, useEffect, useRef } from 'react';
import { Tag, Search, Printer, Plus, Minus, RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';
import JsBarcode from 'jsbarcode';

const ORANGE = '#FF6B00';
const inp    = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls   = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

function BarcodeImg({ value, width = 1.5, height = 40, fontSize = 9 }) {
    const ref = useRef();
    useEffect(() => {
        if (!ref.current || !value) return;
        try {
            JsBarcode(ref.current, String(value), {
                format:    'CODE128',
                width,
                height,
                displayValue: true,
                fontSize,
                margin: 2,
                lineColor: '#000',
            });
        } catch {}
    }, [value, width, height, fontSize]);
    if (!value) return <div className="w-24 h-8 bg-gray-100 rounded" />;
    return <img ref={ref} alt={`barcode-${value}`} />;
}

function LabelCard({ item, qty, onQtyChange }) {
    return (
        <div className="rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center"
            style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)', width:160, flexShrink:0 }}>
            <p className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color:'var(--text-primary)' }}>
                {item.product_name}
            </p>
            {(item.size || item.color) && (
                <p className="text-[9px]" style={{ color:'var(--text-secondary)' }}>
                    {[item.size, item.color].filter(Boolean).join(' / ')}
                </p>
            )}
            <BarcodeImg value={item.barcode || item.sku || item.variant_id} width={1.2} height={36} fontSize={8} />
            <p className="text-xs font-bold" style={{ color:ORANGE }}>₹{Number(item.sale_price||0).toFixed(2)}</p>
            <p className="text-[9px]" style={{ color:'var(--text-secondary)' }}>{item.sku}</p>
            <div className="flex items-center gap-1 mt-0.5">
                <button onClick={() => onQtyChange(Math.max(1, qty - 1))} className="w-5 h-5 rounded text-xs font-bold border flex items-center justify-center" style={{ borderColor:'var(--border-color)', color:'var(--text-secondary)', background:'var(--bg-primary)' }}>−</button>
                <input type="number" min={1} value={qty} onChange={e => onQtyChange(Math.max(1, parseInt(e.target.value)||1))}
                    className="w-10 text-center text-xs border rounded py-0.5 outline-none" style={inp} />
                <button onClick={() => onQtyChange(qty + 1)} className="w-5 h-5 rounded text-xs font-bold border flex items-center justify-center" style={{ borderColor:'var(--border-color)', color:'var(--text-secondary)', background:'var(--bg-primary)' }}>+</button>
            </div>
        </div>
    );
}

export default function BarcodeLabelsPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch]           = useState('');
    const [results, setResults]         = useState([]);
    const [loading, setLoading]         = useState(false);
    const [selected, setSelected]       = useState([]);
    const [qtys, setQtys]               = useState({});
    const [toast, setToast]             = useState(null);
    const debounceRef = useRef();

    const showMsg = (msg, type='success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!search.trim()) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const r = await api.get('/pos2/barcode-labels', { params: { q: search, limit: 40 } });
                setResults(r.data);
            } catch {} finally { setLoading(false); }
        }, 200);
    }, [search]);

    const addItem = (item) => {
        if (selected.find(s => s.variant_id === item.variant_id)) return;
        setSelected(prev => [...prev, item]);
        setQtys(prev => ({ ...prev, [item.variant_id]: 1 }));
    };

    const removeItem = (variantId) => {
        setSelected(prev => prev.filter(s => s.variant_id !== variantId));
        setQtys(prev => { const n = {...prev}; delete n[variantId]; return n; });
    };

    const setQty = (variantId, qty) => {
        setQtys(prev => ({ ...prev, [variantId]: qty }));
    };

    const handlePrint = () => {
        if (!selected.length) { showMsg('Add at least one item', 'error'); return; }
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>Barcode Labels</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family: Arial, sans-serif; background: #fff; }
                .page { display: flex; flex-wrap: wrap; gap: 4px; padding: 6mm; }
                .label { border: 1px solid #ccc; border-radius: 4px; padding: 4px; width: 38mm; text-align: center; page-break-inside: avoid; }
                .prod-name { font-size: 7pt; font-weight: bold; line-height: 1.2; margin-bottom: 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                .variant   { font-size: 6pt; color: #666; margin-bottom: 2px; }
                .price     { font-size: 9pt; font-weight: bold; color: #FF6B00; margin-top: 2px; }
                .sku       { font-size: 6pt; color: #888; }
                img        { max-width: 100%; height: 32px; }
                @media print { body { -webkit-print-color-adjust: exact; } }
            </style>
        </head><body><div class="page">`);

        selected.forEach(item => {
            const count = qtys[item.variant_id] || 1;
            const barcodeVal = item.barcode || item.sku || item.variant_id;
            // Generate barcode SVG inline
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            try {
                JsBarcode(svg, String(barcodeVal), { format:'CODE128', width:1.5, height:32, displayValue:true, fontSize:7, margin:2, lineColor:'#000', xmlDocument: document });
            } catch {}
            const svgStr = svg.outerHTML || '';

            for (let i = 0; i < count; i++) {
                win.document.write(`
                    <div class="label">
                        <div class="prod-name">${item.product_name || ''}</div>
                        ${item.size||item.color ? `<div class="variant">${[item.size,item.color].filter(Boolean).join(' / ')}</div>` : ''}
                        ${svgStr ? svgStr : `<div style="height:32px;background:#f0f0f0;margin:2px 0;font-size:8pt;line-height:32px">${barcodeVal}</div>`}
                        <div class="price">₹${Number(item.sale_price||0).toFixed(2)}</div>
                        <div class="sku">${item.sku||''}</div>
                    </div>
                `);
            }
        });

        win.document.write('</div></body></html>');
        win.document.close();
        setTimeout(() => win.print(), 300);
    };

    const totalLabels = selected.reduce((s, item) => s + (qtys[item.variant_id]||1), 0);

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
                    <Tag className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Barcode Labels</h1>
                    {selected.length > 0 && (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background:'rgba(255,107,0,0.1)', color:ORANGE }}>
                            {totalLabels} labels
                        </span>
                    )}
                    <button onClick={handlePrint} disabled={!selected.length}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background:ORANGE }}>
                        <Printer className="h-4 w-4" /> Print Labels
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {/* Search */}
                    <div className="rounded-2xl border p-4" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color:'var(--text-secondary)' }}>Search Products</p>
                        <div className="relative">
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name, SKU, barcode, size, color…"
                                className={iCls + ' pl-10'} style={inp} autoFocus />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            {loading && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                        </div>
                        {results.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 gap-1 max-h-60 overflow-y-auto">
                                {results.map(item => {
                                    const alreadyAdded = selected.some(s => s.variant_id === item.variant_id);
                                    return (
                                        <button key={item.variant_id} onClick={() => alreadyAdded ? null : addItem(item)}
                                            className={`text-left flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-300'}`}
                                            style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                            <Tag className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                                            <span className="flex-1 font-medium" style={{ color:'var(--text-primary)' }}>{item.product_name}</span>
                                            {item.size && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background:'rgba(255,107,0,0.1)', color:ORANGE }}>Sz:{item.size}</span>}
                                            {item.color && <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{item.color}</span>}
                                            <span className="text-xs font-bold" style={{ color:ORANGE }}>₹{Number(item.sale_price||0).toFixed(2)}</span>
                                            {alreadyAdded ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <Plus className="h-4 w-4 text-gray-400" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Items Preview */}
                    {selected.length > 0 ? (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Label Preview</p>
                                <button onClick={() => { setSelected([]); setQtys({}); }} className="text-xs text-red-500 font-semibold">Clear All</button>
                            </div>
                            <div className="p-4 flex flex-wrap gap-4">
                                {selected.map(item => (
                                    <div key={item.variant_id} className="relative">
                                        <button onClick={() => removeItem(item.variant_id)}
                                            className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                                            <X className="h-3 w-3" />
                                        </button>
                                        <LabelCard item={item} qty={qtys[item.variant_id]||1} onQtyChange={qty => setQty(item.variant_id, qty)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-2xl border p-12 text-center" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color:'var(--text-secondary)' }} />
                            <p className="text-sm font-semibold" style={{ color:'var(--text-secondary)' }}>No items selected</p>
                            <p className="text-xs mt-1" style={{ color:'var(--text-secondary)' }}>Search and add products above</p>
                        </div>
                    )}
                </div>
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
