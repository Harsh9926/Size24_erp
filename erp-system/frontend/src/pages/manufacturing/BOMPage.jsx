import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, X, Edit2, Trash2, List, Calculator, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400 transition";
const iStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const F = ({ label, children, required }) => (
    <div>
        <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

/* ── BOM Modal ── */
const BOMModal = ({ initial, products, materials, onSave, onClose }) => {
    const [form, setForm] = useState({
        product_id: '', version: 'v1', name: '',
        ...initial,
    });
    const [items, setItems] = useState(initial?.items || []);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const addItem = () => setItems(it => [...it, { material_id: '', qty_per_unit: '', unit: '', notes: '' }]);
    const removeItem = (i) => setItems(it => it.filter((_, j) => j !== i));
    const setItem = (i, k, v) => setItems(it => it.map((row, j) => j === i ? { ...row, [k]: v } : row));

    const handleSave = async () => {
        if (!form.product_id) return setErr('Product is required');
        setSaving(true);
        try {
            const payload = { ...form, items };
            if (initial?.id) {
                await api.put(`/mfg/bom/${initial.id}`, payload);
            } else {
                await api.post('/mfg/bom', payload);
            }
            onSave();
        } catch (e) {
            setErr(e.response?.data?.error || 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {initial?.id ? 'Edit BOM' : 'Create Bill of Materials'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>

                <div className="overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <F label="Product" required>
                                <select className={inp} style={iStyle} value={form.product_id} onChange={set('product_id')}>
                                    <option value="">— Select Product —</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </F>
                        </div>
                        <F label="Version">
                            <input className={inp} style={iStyle} value={form.version} onChange={set('version')} placeholder="v1" />
                        </F>
                        <F label="BOM Name">
                            <input className={inp} style={iStyle} value={form.name} onChange={set('name')} placeholder="Optional name" />
                        </F>
                    </div>

                    {/* Items */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Materials ({items.length})</p>
                            <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#FF6B001a', color: '#FF6B00' }}>
                                <Plus className="h-3.5 w-3.5" /> Add Material
                            </button>
                        </div>

                        <div className="space-y-2">
                            {items.map((item, i) => {
                                const mat = materials.find(m => String(m.id) === String(item.material_id));
                                return (
                                    <div key={i} className="flex items-center gap-2 p-3 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <select className="flex-1 px-2 py-2 text-sm rounded-lg border outline-none" style={iStyle} value={item.material_id} onChange={e => setItem(i, 'material_id', e.target.value)}>
                                            <option value="">— Material —</option>
                                            {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.material_unit || m.unit})</option>)}
                                        </select>
                                        <input
                                            type="number" step="0.0001"
                                            className="w-28 px-2 py-2 text-sm rounded-lg border outline-none"
                                            style={iStyle}
                                            placeholder="Qty"
                                            value={item.qty_per_unit}
                                            onChange={e => setItem(i, 'qty_per_unit', e.target.value)}
                                        />
                                        <span className="text-xs w-12 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                                            {mat?.material_unit || mat?.unit || '—'}
                                        </span>
                                        <input
                                            className="w-32 px-2 py-2 text-sm rounded-lg border outline-none"
                                            style={iStyle}
                                            placeholder="Notes"
                                            value={item.notes}
                                            onChange={e => setItem(i, 'notes', e.target.value)}
                                        />
                                        <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                            {items.length === 0 && (
                                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No materials added yet. Click "Add Material".</p>
                            )}
                        </div>
                    </div>

                    {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                        {saving ? 'Saving…' : 'Save BOM'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Requirement Calculator Modal ── */
const CalcModal = ({ products, onClose }) => {
    const [productId, setProductId]   = useState('');
    const [sizes, setSizes]           = useState([{ size: '', qty: '' }]);
    const [results, setResults]       = useState(null);
    const [loading, setLoading]       = useState(false);
    const [err, setErr]               = useState('');

    const addSize = () => setSizes(s => [...s, { size: '', qty: '' }]);
    const removeSize = (i) => setSizes(s => s.filter((_, j) => j !== i));
    const setSize = (i, k, v) => setSizes(s => s.map((r, j) => j === i ? { ...r, [k]: v } : r));

    const calculate = async () => {
        if (!productId) return setErr('Select a product');
        const quantities = {};
        for (const s of sizes) {
            if (s.size && s.qty) quantities[s.size] = parseFloat(s.qty);
        }
        if (Object.keys(quantities).length === 0) return setErr('Add at least one size with quantity');
        setLoading(true);
        setErr('');
        try {
            const r = await api.post('/mfg/bom/calculate-requirements', { product_id: parseInt(productId), quantities });
            setResults(r.data);
        } catch (e) {
            setErr(e.response?.data?.error || 'Calculation failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Material Requirement Calculator</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-5">
                    <F label="Product" required>
                        <select className={inp} style={iStyle} value={productId} onChange={e => setProductId(e.target.value)}>
                            <option value="">— Select Product —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </F>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Production Quantities by Size</p>
                            <button onClick={addSize} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#FF6B001a', color: '#FF6B00' }}>
                                + Add Size
                            </button>
                        </div>
                        <div className="space-y-2">
                            {sizes.map((s, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <input className="flex-1 px-3 py-2 text-sm rounded-xl border outline-none" style={iStyle} placeholder="Size (e.g. 28, M)" value={s.size} onChange={e => setSize(i, 'size', e.target.value)} />
                                    <input type="number" className="w-28 px-3 py-2 text-sm rounded-xl border outline-none" style={iStyle} placeholder="Qty" value={s.qty} onChange={e => setSize(i, 'qty', e.target.value)} />
                                    <button onClick={() => removeSize(i)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}

                    <button onClick={calculate} disabled={loading} className="w-full py-2.5 text-sm font-bold rounded-xl text-white" style={{ background: loading ? '#9ca3af' : '#FF6B00' }}>
                        {loading ? 'Calculating…' : 'Calculate Requirements'}
                    </button>

                    {results && (
                        <div>
                            <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                                Required Materials — Total Cost: ₹{results.reduce((s, r) => s + r.total_cost, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            <div className="space-y-2">
                                {results.map(r => (
                                    <div key={r.material_id} className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ borderColor: r.shortage > 0 ? '#fca5a5' : 'var(--border-color)', background: r.shortage > 0 ? '#fef2f2' : 'var(--bg-primary)' }}>
                                        <div>
                                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.material_name}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                Need: {r.total_required} {r.unit} · Stock: {r.current_stock}
                                                {r.shortage > 0 && <span className="text-red-600 font-bold ml-2">⚠ Short by {r.shortage.toFixed(3)}</span>}
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: '#FF6B00' }}>₹{r.total_cost.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── BOM Card ── */
const BOMCard = ({ bom, onEdit, onDelete, materials }) => {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail]     = useState(null);

    const loadDetail = async () => {
        if (detail) { setExpanded(e => !e); return; }
        const r = await api.get(`/mfg/bom/${bom.id}`);
        setDetail(r.data);
        setExpanded(true);
    };

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: '#FF6B001a' }}>
                        <List className="h-5 w-5" style={{ color: '#FF6B00' }} />
                    </div>
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{bom.product_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {bom.version} {bom.name ? `· ${bom.name}` : ''} · {bom.item_count} material{bom.item_count !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-orange-50" title="Edit"><Edit2 className="h-4 w-4" style={{ color: '#FF6B00' }} /></button>
                    <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    <button onClick={loadDetail} className="p-1.5 rounded-lg hover:bg-gray-100">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {expanded && detail && (
                <div className="border-t px-5 py-4 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                    {detail.items.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No materials in this BOM yet.</p>
                    ) : detail.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)' }}>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.material_name}</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.type_name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold" style={{ color: '#FF6B00' }}>
                                    {item.qty_per_unit} {item.unit || item.material_unit}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    @ ₹{Number(item.current_cost).toFixed(4)}/unit
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function BOMPage() {
    const [boms, setBOMs]           = useState([]);
    const [products, setProducts]   = useState([]);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [modal, setModal]         = useState(null); // 'add' | 'calc' | { edit: bom }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [bRes, pRes, mRes] = await Promise.all([
                api.get('/mfg/bom'),
                api.get('/inv/products'),
                api.get('/mfg/raw-materials'),
            ]);
            setBOMs(bRes.data);
            setProducts(pRes.data);
            setMaterials(mRes.data);
        } catch { /* */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this BOM?')) return;
        await api.delete(`/mfg/bom/${id}`);
        load();
    };

    const closeModal = () => { setModal(null); load(); };

    return (
        <Layout>
            <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Bill of Materials</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Define what goes into each finished product</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setModal('calc')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                            <Calculator className="h-4 w-4" /> Calculate
                        </button>
                        <button onClick={() => setModal('add')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#FF6B00' }}>
                            <Plus className="h-4 w-4" /> New BOM
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />)}
                    </div>
                ) : boms.length === 0 ? (
                    <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                        <List className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>No BOMs defined yet. Create your first BOM.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {boms.map(bom => (
                            <BOMCard
                                key={bom.id}
                                bom={bom}
                                materials={materials}
                                onEdit={() => {
                                    api.get(`/mfg/bom/${bom.id}`).then(r => setModal({ edit: r.data }));
                                }}
                                onDelete={() => handleDelete(bom.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {modal === 'add'  && <BOMModal products={products} materials={materials} onSave={closeModal} onClose={() => setModal(null)} />}
            {modal?.edit      && <BOMModal initial={modal.edit} products={products} materials={materials} onSave={closeModal} onClose={() => setModal(null)} />}
            {modal === 'calc' && <CalcModal products={products} onClose={() => setModal(null)} />}
        </Layout>
    );
}
