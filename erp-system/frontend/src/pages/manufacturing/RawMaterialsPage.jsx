import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../services/api';
import {
    Plus, Search, AlertTriangle, X, ChevronDown,
    Package, RefreshCw, History, Edit2,
} from 'lucide-react';

const UNITS = ['meter', 'piece', 'roll', 'kg', 'liter', 'gram'];

/* ── Reusable input ── */
const F = ({ label, children, required }) => (
    <div>
        <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400 transition";
const iStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

/* ── Material Modal ── */
const MaterialModal = ({ initial, types, suppliers, warehouses, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: '', type_id: '', supplier_id: '', unit: 'meter',
        purchase_price: '', current_cost: '', current_stock: '',
        reorder_level: '', barcode: '', lot_number: '', warehouse_id: '',
        gst_rate: '', hsn_code: '', notes: '',
        ...initial,
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSave = async () => {
        if (!form.name.trim()) return setErr('Name is required');
        setSaving(true);
        try {
            if (initial?.id) {
                await api.put(`/mfg/raw-materials/${initial.id}`, form);
            } else {
                await api.post('/mfg/raw-materials', form);
            }
            onSave();
        } catch (e) {
            setErr(e.response?.data?.error || 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {initial?.id ? 'Edit Material' : 'Add Raw Material'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <F label="Material Name" required>
                                <input className={inp} style={iStyle} value={form.name} onChange={set('name')} placeholder="e.g. Cotton Fabric 40x40" />
                            </F>
                        </div>
                        <F label="Type">
                            <select className={inp} style={iStyle} value={form.type_id} onChange={set('type_id')}>
                                <option value="">— Select Type —</option>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </F>
                        <F label="Unit" required>
                            <select className={inp} style={iStyle} value={form.unit} onChange={set('unit')}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </F>
                        <F label="Supplier">
                            <select className={inp} style={iStyle} value={form.supplier_id} onChange={set('supplier_id')}>
                                <option value="">— None —</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </F>
                        <F label="Warehouse">
                            <select className={inp} style={iStyle} value={form.warehouse_id} onChange={set('warehouse_id')}>
                                <option value="">— None —</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </F>
                        <F label="Purchase Price (₹)">
                            <input type="number" step="0.01" className={inp} style={iStyle} value={form.purchase_price} onChange={set('purchase_price')} placeholder="0.00" />
                        </F>
                        <F label="Current Cost (₹)">
                            <input type="number" step="0.0001" className={inp} style={iStyle} value={form.current_cost} onChange={set('current_cost')} placeholder="0.0000" />
                        </F>
                        <F label="Current Stock">
                            <input type="number" step="0.001" className={inp} style={iStyle} value={form.current_stock} onChange={set('current_stock')} placeholder="0" />
                        </F>
                        <F label="Reorder Level">
                            <input type="number" step="0.001" className={inp} style={iStyle} value={form.reorder_level} onChange={set('reorder_level')} placeholder="0" />
                        </F>
                        <F label="GST Rate (%)">
                            <input type="number" step="0.01" className={inp} style={iStyle} value={form.gst_rate} onChange={set('gst_rate')} placeholder="0" />
                        </F>
                        <F label="HSN Code">
                            <input className={inp} style={iStyle} value={form.hsn_code} onChange={set('hsn_code')} placeholder="e.g. 5208" />
                        </F>
                        <F label="Barcode">
                            <input className={inp} style={iStyle} value={form.barcode} onChange={set('barcode')} placeholder="Optional" />
                        </F>
                        <F label="Lot Number">
                            <input className={inp} style={iStyle} value={form.lot_number} onChange={set('lot_number')} placeholder="Optional" />
                        </F>
                        <div className="col-span-2">
                            <F label="Notes">
                                <textarea rows={2} className={inp} style={iStyle} value={form.notes} onChange={set('notes')} placeholder="Optional notes..." />
                            </F>
                        </div>
                    </div>

                    {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                        {saving ? 'Saving…' : 'Save Material'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Purchase History Modal ── */
const PurchaseModal = ({ material, suppliers, onClose }) => {
    const [history, setHistory] = useState([]);
    const [form, setForm] = useState({ supplier_id: material.supplier_id || '', purchase_date: new Date().toISOString().split('T')[0], qty: '', unit_price: '', invoice_number: '', notes: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    useEffect(() => {
        api.get(`/mfg/raw-materials/${material.id}/purchases`)
            .then(r => setHistory(r.data))
            .catch(() => {});
    }, [material.id]);

    const handleAdd = async () => {
        if (!form.qty || !form.unit_price || !form.purchase_date) return setErr('Date, qty and price required');
        setSaving(true);
        try {
            await api.post(`/mfg/raw-materials/${material.id}/purchases`, form);
            const r = await api.get(`/mfg/raw-materials/${material.id}/purchases`);
            setHistory(r.data);
            setForm(f => ({ ...f, qty: '', unit_price: '', invoice_number: '', notes: '' }));
            setErr('');
        } catch (e) {
            setErr(e.response?.data?.error || 'Failed to add');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Purchase History</h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{material.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>

                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Add Purchase */}
                    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add Purchase</p>
                        <div className="grid grid-cols-2 gap-3">
                            <F label="Date" required>
                                <input type="date" className={inp} style={iStyle} value={form.purchase_date} onChange={set('purchase_date')} />
                            </F>
                            <F label="Supplier">
                                <select className={inp} style={iStyle} value={form.supplier_id} onChange={set('supplier_id')}>
                                    <option value="">— None —</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </F>
                            <F label={`Qty (${material.unit})`} required>
                                <input type="number" step="0.001" className={inp} style={iStyle} value={form.qty} onChange={set('qty')} placeholder="0" />
                            </F>
                            <F label="Unit Price (₹)" required>
                                <input type="number" step="0.01" className={inp} style={iStyle} value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" />
                            </F>
                            <F label="Invoice #">
                                <input className={inp} style={iStyle} value={form.invoice_number} onChange={set('invoice_number')} placeholder="Optional" />
                            </F>
                            <F label="Notes">
                                <input className={inp} style={iStyle} value={form.notes} onChange={set('notes')} placeholder="Optional" />
                            </F>
                        </div>
                        {form.qty && form.unit_price && (
                            <p className="text-sm font-bold" style={{ color: '#FF6B00' }}>
                                Total: ₹{(parseFloat(form.qty) * parseFloat(form.unit_price)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </p>
                        )}
                        {err && <p className="text-sm text-red-600">{err}</p>}
                        <button onClick={handleAdd} disabled={saving} className="px-4 py-2 text-sm font-bold rounded-xl text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                            {saving ? 'Adding…' : 'Add Purchase'}
                        </button>
                    </div>

                    {/* History Table */}
                    <div>
                        <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>History ({history.length})</p>
                        {history.length === 0 ? (
                            <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No purchases yet</p>
                        ) : (
                            <div className="space-y-2">
                                {history.map(p => (
                                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {p.qty} {material.unit} @ ₹{p.unit_price}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                {p.purchase_date?.slice(0,10)} · {p.supplier_name || 'No supplier'}
                                                {p.invoice_number ? ` · #${p.invoice_number}` : ''}
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: '#FF6B00' }}>
                                            ₹{Number(p.total_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function RawMaterialsPage() {
    const [searchParams] = useSearchParams();
    const [materials, setMaterials]   = useState([]);
    const [types, setTypes]           = useState([]);
    const [suppliers, setSuppliers]   = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('low_stock') === 'true');
    const [modal, setModal]           = useState(null); // 'add' | { edit: material } | { history: material }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (search)       params.search    = search;
            if (typeFilter)   params.type_id   = typeFilter;
            if (lowStockOnly) params.low_stock  = 'true';
            const [mRes, tRes, sRes, wRes] = await Promise.all([
                api.get('/mfg/raw-materials', { params }),
                api.get('/mfg/raw-materials/types'),
                api.get('/inv/parties/suppliers'),
                api.get('/mfg/raw-materials/warehouses'),
            ]);
            setMaterials(mRes.data);
            setTypes(tRes.data);
            setSuppliers(sRes.data);
            setWarehouses(wRes.data);
        } catch { /* handled */ }
        finally { setLoading(false); }
    }, [search, typeFilter, lowStockOnly]);

    useEffect(() => { load(); }, [load]);

    const closeModal = () => { setModal(null); load(); };

    const tdCls = "px-4 py-3 text-sm whitespace-nowrap";

    return (
        <Layout>
            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Raw Materials</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Master list · Stock · Purchase history</p>
                    </div>
                    <button
                        onClick={() => setModal('add')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: '#FF6B00' }}
                    >
                        <Plus className="h-4 w-4" /> Add Material
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                        <input
                            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400"
                            style={iStyle}
                            placeholder="Search materials…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400"
                        style={iStyle}
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                    >
                        <option value="">All Types</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer select-none text-sm font-medium" style={{ ...iStyle, borderColor: lowStockOnly ? '#ef4444' : 'var(--border-color)' }}>
                        <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="accent-red-500" />
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Low Stock
                    </label>
                    <button onClick={load} className="p-2.5 rounded-xl border" style={iStyle}>
                        <RefreshCw className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                {/* Table */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Material', 'Type', 'Unit', 'Stock', 'Reorder', 'Cost/Unit', 'Supplier', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                                        <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />Loading…
                                    </td></tr>
                                ) : materials.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No materials found
                                    </td></tr>
                                ) : materials.map((m, i) => {
                                    const isLow = parseFloat(m.current_stock) <= parseFloat(m.reorder_level) && parseFloat(m.reorder_level) > 0;
                                    return (
                                        <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                            <td className={tdCls}>
                                                <div className="flex items-center gap-2">
                                                    {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                                                    <div>
                                                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                                                        {m.barcode && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.barcode}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={tdCls} style={{ color: 'var(--text-secondary)' }}>{m.type_name || '—'}</td>
                                            <td className={tdCls} style={{ color: 'var(--text-secondary)' }}>{m.unit}</td>
                                            <td className={tdCls}>
                                                <span className={`font-bold ${isLow ? 'text-red-500' : ''}`} style={isLow ? {} : { color: 'var(--text-primary)' }}>
                                                    {Number(m.current_stock).toFixed(3)}
                                                </span>
                                            </td>
                                            <td className={tdCls} style={{ color: 'var(--text-secondary)' }}>{Number(m.reorder_level).toFixed(3)}</td>
                                            <td className={tdCls} style={{ color: 'var(--text-primary)' }}>
                                                ₹{Number(m.current_cost).toFixed(4)}
                                            </td>
                                            <td className={tdCls} style={{ color: 'var(--text-secondary)' }}>{m.supplier_name || '—'}</td>
                                            <td className={tdCls}>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setModal({ edit: m })}
                                                        className="p-1.5 rounded-lg hover:bg-orange-50 transition"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" style={{ color: '#FF6B00' }} />
                                                    </button>
                                                    <button
                                                        onClick={() => setModal({ history: m })}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 transition"
                                                        title="Purchase History"
                                                    >
                                                        <History className="h-3.5 w-3.5 text-blue-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {materials.length} material{materials.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Modals */}
            {modal === 'add' && (
                <MaterialModal types={types} suppliers={suppliers} warehouses={warehouses} onSave={closeModal} onClose={() => setModal(null)} />
            )}
            {modal?.edit && (
                <MaterialModal initial={modal.edit} types={types} suppliers={suppliers} warehouses={warehouses} onSave={closeModal} onClose={() => setModal(null)} />
            )}
            {modal?.history && (
                <PurchaseModal material={modal.history} suppliers={suppliers} onClose={() => setModal(null)} />
            )}
        </Layout>
    );
}
