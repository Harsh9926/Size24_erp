import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, X, Edit2, Package, RefreshCw, Palette, Tag, Copy } from 'lucide-react';

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

/* ── Lookup Manager (shared for Colors, Genders, etc.) ── */
const LookupSection = ({ title, items, onAdd, color }) => {
    const [val, setVal] = useState('');
    const [saving, setSaving] = useState(false);
    const handleAdd = async () => {
        if (!val.trim()) return;
        setSaving(true);
        try { await onAdd(val.trim()); setVal(''); }
        finally { setSaving(false); }
    };
    return (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <div className="flex flex-wrap gap-2">
                {items.map(item => (
                    <span key={item.id} className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: color + '40', background: color + '15', color }}>
                        {item.name}
                        {item.hex_code && <span className="ml-1.5 inline-block w-3 h-3 rounded-full border border-white align-middle" style={{ background: item.hex_code }} />}
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input className="flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none" style={iStyle} value={val} onChange={e => setVal(e.target.value)} placeholder={`New ${title}…`} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs font-bold rounded-lg text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                    {saving ? '…' : 'Add'}
                </button>
            </div>
        </div>
    );
};

/* ── Product Detail Modal ── */
const ProductModal = ({ initial, lookups, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: '', category_id: '', gender_id: '', sleeve_type_id: '', fabric_type_id: '',
        gst_rate: '', hsn_code: '', description: '', sku: '', barcode: '',
        ...initial,
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');
    const [genLoading, setGenLoading] = useState({});
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSave = async () => {
        if (!form.name) return setErr('Name required');
        setSaving(true);
        try {
            if (initial?.id) {
                await api.put(`/inv/products/${initial.id}`, form);
            } else {
                await api.post('/inv/products', form);
            }
            onSave();
        } catch (e) {
            setErr(e.response?.data?.error || 'Save failed');
        } finally { setSaving(false); }
    };

    const genSKU = async () => {
        setGenLoading(g => ({ ...g, sku: true }));
        try {
            const r = await api.get('/mfg/product-master/generate-sku', {
                params: { category_id: form.category_id, gender_id: form.gender_id, product_id: initial?.id || 0 },
            });
            setForm(f => ({ ...f, sku: r.data.sku }));
        } catch { /* */ }
        finally { setGenLoading(g => ({ ...g, sku: false })); }
    };

    const genBarcode = async () => {
        if (!initial?.id) return setErr('Save product first to generate barcode');
        setGenLoading(g => ({ ...g, barcode: true }));
        try {
            const r = await api.get('/mfg/product-master/generate-barcode', { params: { product_id: initial.id } });
            setForm(f => ({ ...f, barcode: r.data.barcode }));
        } catch { /* */ }
        finally { setGenLoading(g => ({ ...g, barcode: false })); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {initial?.id ? 'Edit Product' : 'New Product'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <F label="Product Name" required>
                                <input className={inp} style={iStyle} value={form.name} onChange={set('name')} placeholder="e.g. Boys School Shirt" />
                            </F>
                        </div>
                        <F label="Category">
                            <select className={inp} style={iStyle} value={form.category_id} onChange={set('category_id')}>
                                <option value="">— None —</option>
                                {lookups.categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </F>
                        <F label="Gender">
                            <select className={inp} style={iStyle} value={form.gender_id} onChange={set('gender_id')}>
                                <option value="">— None —</option>
                                {lookups.genders?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </F>
                        <F label="Sleeve Type">
                            <select className={inp} style={iStyle} value={form.sleeve_type_id} onChange={set('sleeve_type_id')}>
                                <option value="">— None —</option>
                                {lookups.sleeve_types?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </F>
                        <F label="Fabric Type">
                            <select className={inp} style={iStyle} value={form.fabric_type_id} onChange={set('fabric_type_id')}>
                                <option value="">— None —</option>
                                {lookups.fabric_types?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </F>
                        <F label="GST Rate (%)">
                            <input type="number" step="0.01" className={inp} style={iStyle} value={form.gst_rate} onChange={set('gst_rate')} placeholder="0" />
                        </F>
                        <F label="HSN Code">
                            <input className={inp} style={iStyle} value={form.hsn_code} onChange={set('hsn_code')} placeholder="e.g. 6105" />
                        </F>

                        {/* SKU */}
                        <F label="SKU">
                            <div className="flex gap-2">
                                <input className="flex-1 px-3 py-2.5 text-sm rounded-xl border outline-none" style={iStyle} value={form.sku} onChange={set('sku')} placeholder="Auto or manual" />
                                <button onClick={genSKU} disabled={genLoading.sku} className="px-3 py-2.5 text-xs font-bold rounded-xl text-white flex-shrink-0" style={{ background: '#FF6B00' }}>
                                    {genLoading.sku ? '…' : 'Gen'}
                                </button>
                            </div>
                        </F>

                        {/* Barcode */}
                        <F label="Barcode (EAN-13)">
                            <div className="flex gap-2">
                                <input className="flex-1 px-3 py-2.5 text-sm rounded-xl border outline-none font-mono" style={iStyle} value={form.barcode} onChange={set('barcode')} placeholder="Auto or manual" />
                                <button onClick={genBarcode} disabled={genLoading.barcode} className="px-3 py-2.5 text-xs font-bold rounded-xl text-white flex-shrink-0" style={{ background: '#8b5cf6' }}>
                                    {genLoading.barcode ? '…' : 'Gen'}
                                </button>
                            </div>
                        </F>

                        <div className="col-span-2">
                            <F label="Description">
                                <textarea rows={2} className={inp} style={iStyle} value={form.description} onChange={set('description')} placeholder="Optional description" />
                            </F>
                        </div>
                    </div>

                    {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                </div>

                <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                        {saving ? 'Saving…' : 'Save Product'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ProductMasterPage() {
    const [products, setProducts] = useState([]);
    const [lookups, setLookups]   = useState({});
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('products'); // 'products' | 'master'
    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState(null); // 'add' | { edit: product }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, lRes, cRes] = await Promise.all([
                api.get('/inv/products', { params: search ? { search } : {} }),
                api.get('/mfg/product-master/lookups'),
                api.get('/inv/categories'),
            ]);
            setProducts(pRes.data);
            setLookups({ ...lRes.data, categories: cRes.data });
        } catch { /* */ }
        finally { setLoading(false); }
    }, [search]);

    useEffect(() => { load(); }, [load]);
    const closeModal = () => { setModal(null); load(); };

    const handleAddLookup = (endpoint, reloadKey) => async (name) => {
        await api.post(endpoint, { name });
        const r = await api.get('/mfg/product-master/lookups');
        setLookups(l => ({ ...l, ...r.data }));
    };

    const copyToClipboard = (val) => navigator.clipboard.writeText(val).catch(() => {});

    return (
        <Layout>
            <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Product Master</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Products with manufacturing attributes — gender, sleeve, fabric, SKU, barcode</p>
                    </div>
                    <button onClick={() => setModal('add')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#FF6B00' }}>
                        <Plus className="h-4 w-4" /> New Product
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-surface)' }}>
                    {[['products', 'Products'], ['master', 'Master Lookups']].map(([k, label]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className="px-4 py-2 text-sm font-semibold rounded-lg transition"
                            style={tab === k
                                ? { background: '#FF6B00', color: '#fff' }
                                : { color: 'var(--text-secondary)' }
                            }
                        >{label}</button>
                    ))}
                </div>

                {tab === 'products' && (
                    <>
                        <div className="relative max-w-sm">
                            <input
                                className="w-full pl-4 pr-3 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-orange-400"
                                style={iStyle}
                                placeholder="Search products…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                            {['Product', 'Category', 'Gender', 'Sleeve', 'Fabric', 'SKU', 'Barcode', ''].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={8} className="text-center py-10"><RefreshCw className="h-5 w-5 mx-auto animate-spin" style={{ color: 'var(--text-secondary)' }} /></td></tr>
                                        ) : products.length === 0 ? (
                                            <tr><td colSpan={8} className="text-center py-10" style={{ color: 'var(--text-secondary)' }}>
                                                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No products
                                            </td></tr>
                                        ) : products.map((p, i) => (
                                            <tr key={p.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                <td className="px-4 py-3">
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                                    {p.description && <p className="text-xs truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{p.description}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{p.category_name || '—'}</td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                    {lookups.genders?.find(g => g.id === p.gender_id)?.name || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                    {lookups.sleeve_types?.find(s => s.id === p.sleeve_type_id)?.name || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                    {lookups.fabric_types?.find(f => f.id === p.fabric_type_id)?.name || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {p.sku ? (
                                                        <div className="flex items-center gap-1">
                                                            <code className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: '#FF6B00' }}>{p.sku}</code>
                                                            <button onClick={() => copyToClipboard(p.sku)} className="p-0.5 text-gray-400 hover:text-gray-600"><Copy className="h-3 w-3" /></button>
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {p.barcode ? (
                                                        <code className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{p.barcode}</code>
                                                    ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button onClick={() => setModal({ edit: p })} className="p-1.5 rounded-lg hover:bg-orange-50">
                                                        <Edit2 className="h-3.5 w-3.5" style={{ color: '#FF6B00' }} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {tab === 'master' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <LookupSection title="Colors" items={lookups.colors || []} color="#FF6B00"
                            onAdd={handleAddLookup('/mfg/product-master/colors')} />
                        <LookupSection title="Genders" items={lookups.genders || []} color="#8b5cf6"
                            onAdd={handleAddLookup('/mfg/product-master/genders')} />
                        <LookupSection title="Sleeve Types" items={lookups.sleeve_types || []} color="#0ea5e9"
                            onAdd={handleAddLookup('/mfg/product-master/sleeve-types')} />
                        <LookupSection title="Fabric Types" items={lookups.fabric_types || []} color="#10b981"
                            onAdd={handleAddLookup('/mfg/product-master/fabric-types')} />
                        <LookupSection title="Sizes" items={lookups.sizes || []} color="#f59e0b"
                            onAdd={handleAddLookup('/mfg/product-master/sizes')} />
                        <LookupSection title="Houses" items={lookups.houses || []} color="#ec4899"
                            onAdd={handleAddLookup('/mfg/product-master/houses')} />
                    </div>
                )}
            </div>

            {modal === 'add' && <ProductModal lookups={lookups} onSave={closeModal} onClose={() => setModal(null)} />}
            {modal?.edit    && <ProductModal initial={modal.edit} lookups={lookups} onSave={closeModal} onClose={() => setModal(null)} />}
        </Layout>
    );
}
