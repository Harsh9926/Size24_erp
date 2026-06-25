import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Save, RefreshCw, Scissors, Plus, X, Trash2 } from 'lucide-react';

const iStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

export default function SizeMatrixPage() {
    const [products, setProducts]   = useState([]);
    const [materials, setMaterials] = useState([]);
    const [sizes, setSizes]         = useState([]);
    const [selProduct, setSelProduct] = useState('');
    const [matrix, setMatrix]       = useState([]); // from DB
    const [draft, setDraft]         = useState([]);  // editable rows
    const [saving, setSaving]       = useState(false);
    const [loading, setLoading]     = useState(false);
    const [saved, setSaved]         = useState(false);

    useEffect(() => {
        Promise.all([
            api.get('/inv/products'),
            api.get('/mfg/raw-materials'),
            api.get('/mfg/product-master/sizes'),
        ]).then(([p, m, s]) => {
            setProducts(p.data);
            setMaterials(m.data);
            setSizes(s.data);
        }).catch(() => {});
    }, []);

    const loadMatrix = useCallback(async (pid) => {
        setLoading(true);
        try {
            const r = await api.get(`/mfg/bom/size-matrix/${pid}`);
            setMatrix(r.data);
            setDraft(r.data.map(row => ({ ...row, _new: false })));
        } catch { /* */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (selProduct) loadMatrix(selProduct);
    }, [selProduct, loadMatrix]);

    const addRow = () => {
        setDraft(d => [...d, {
            product_id:  selProduct,
            size_name:   '',
            material_id: '',
            qty:         '',
            unit:        '',
            notes:       '',
            _new:        true,
        }]);
    };

    const setDraftRow = (i, k, v) => setDraft(d => d.map((r, j) => j === i ? { ...r, [k]: v } : r));
    const removeDraftRow = (i) => setDraft(d => d.filter((_, j) => j !== i));

    const handleSave = async () => {
        setSaving(true);
        try {
            const rows = draft
                .filter(r => r.size_name && r.material_id && r.qty)
                .map(r => ({
                    size_name:   r.size_name,
                    material_id: parseInt(r.material_id),
                    qty:         parseFloat(r.qty),
                    unit:        r.unit || null,
                    notes:       r.notes || null,
                }));
            await api.post(`/mfg/bom/size-matrix/${selProduct}`, { rows });
            await loadMatrix(selProduct);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { /* */ }
        finally { setSaving(false); }
    };

    // Group draft by size for display
    const sizeGroups = {};
    for (const row of draft) {
        const s = row.size_name || '(new)';
        if (!sizeGroups[s]) sizeGroups[s] = [];
        sizeGroups[s].push(row);
    }

    // Get unique sizes from draft + standard sizes for quick-add
    const draftSizeNames = [...new Set(draft.map(r => r.size_name).filter(Boolean))];
    const standardSizes  = sizes.map(s => s.name).filter(s => !draftSizeNames.includes(s));

    return (
        <Layout>
            <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Size Consumption Matrix</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Define how much material each size needs — overrides BOM base quantities
                        </p>
                    </div>
                    {selProduct && (
                        <div className="flex items-center gap-3">
                            <button onClick={addRow} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                                <Plus className="h-4 w-4" /> Add Row
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: saved ? '#10b981' : saving ? '#9ca3af' : '#FF6B00' }}>
                                <Save className="h-4 w-4" />
                                {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Matrix'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Product Selector */}
                <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Select Product</label>
                    <select
                        className="w-full max-w-sm px-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400"
                        style={iStyle}
                        value={selProduct}
                        onChange={e => setSelProduct(e.target.value)}
                    >
                        <option value="">— Choose a product —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {!selProduct ? (
                    <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                        <Scissors className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>Select a product to view and edit its size matrix</p>
                    </div>
                ) : loading ? (
                    <div className="space-y-2">
                        {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />)}
                    </div>
                ) : (
                    <>
                        {/* Quick-add size buttons */}
                        {standardSizes.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Quick Add Size</p>
                                <div className="flex flex-wrap gap-2">
                                    {standardSizes.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => {
                                                // Add one row per material for that size
                                                setDraft(d => [...d, { product_id: selProduct, size_name: s, material_id: '', qty: '', unit: '', notes: '', _new: true }]);
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition hover:shadow-sm"
                                            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                                        >
                                            + Size {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Matrix Table */}
                        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                            {['Size', 'Material', 'Qty Required', 'Unit', 'Notes', ''].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draft.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
                                                    No size matrix defined. Click "Add Row" or "Quick Add Size".
                                                </td>
                                            </tr>
                                        ) : draft.map((row, i) => {
                                            const mat = materials.find(m => String(m.id) === String(row.material_id));
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-primary)' }}>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            className="w-20 px-2 py-1.5 text-sm rounded-lg border outline-none"
                                                            style={iStyle}
                                                            value={row.size_name}
                                                            onChange={e => setDraftRow(i, 'size_name', e.target.value)}
                                                            placeholder="28"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <select
                                                            className="w-52 px-2 py-1.5 text-sm rounded-lg border outline-none"
                                                            style={iStyle}
                                                            value={row.material_id}
                                                            onChange={e => setDraftRow(i, 'material_id', e.target.value)}
                                                        >
                                                            <option value="">— Material —</option>
                                                            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number" step="0.0001"
                                                            className="w-28 px-2 py-1.5 text-sm rounded-lg border outline-none font-bold"
                                                            style={{ ...iStyle, color: '#FF6B00' }}
                                                            value={row.qty}
                                                            onChange={e => setDraftRow(i, 'qty', e.target.value)}
                                                            placeholder="0.0000"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                        {mat?.unit || '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            className="w-36 px-2 py-1.5 text-sm rounded-lg border outline-none"
                                                            style={iStyle}
                                                            value={row.notes || ''}
                                                            onChange={e => setDraftRow(i, 'notes', e.target.value)}
                                                            placeholder="Optional"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <button onClick={() => removeDraftRow(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Example callout */}
                        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: '#FF6B000d', color: '#c2410c' }}>
                            <strong>Example:</strong> Size 28 → Fabric 2.20m · Size 34 → Fabric 2.75m. The ERP uses these values when calculating production material requirements.
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}
