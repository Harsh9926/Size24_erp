import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, ChevronRight, X, Save, RefreshCw, Package } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

const EMPTY_PROD = { name:'', category_id:'', article_code:'', unit:'pcs', gst_rate:'5', hsn_code:'', min_stock:'0', description:'', sale_price:'', purchase_price:'', disc_on_sale:'0', sale_price_with_tax: true };
const EMPTY_VAR  = { school_id:'', size:'', color:'', purchase_price:'', sale_price:'', mrp:'' };
const SIZES = ['20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50','S','M','L','XL','XXL'];

export default function ItemMasterPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [products, setProducts]       = useState([]);
    const [categories, setCategories]   = useState([]);
    const [schools, setSchools]         = useState([]);
    const [search, setSearch]           = useState('');
    const [loading, setLoading]         = useState(true);

    const [showProdModal, setShowProdModal] = useState(false);
    const [showVarModal, setShowVarModal]   = useState(false);
    const [selectedProd, setSelectedProd]   = useState(null);
    const [prodForm, setProdForm]           = useState(EMPTY_PROD);
    const [varForm, setVarForm]             = useState(EMPTY_VAR);
    const [saving, setSaving]               = useState(false);
    const [error, setError]                 = useState('');

    // Bulk variant creation
    const [bulkSizes,   setBulkSizes]   = useState([]);
    const [bulkSchools, setBulkSchools] = useState([]);
    const [bulkMode,    setBulkMode]    = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, c, s] = await Promise.all([
                api.get(`/inv/products${search ? `?search=${search}` : ''}`),
                api.get('/inv/categories'),
                api.get('/inv/schools'),
            ]);
            setProducts(p.data);
            setCategories(c.data);
            setSchools(s.data);
        } catch { } finally { setLoading(false); }
    }, [search]);

    useEffect(() => { load(); }, [load]);

    const saveProd = async () => {
        if (!prodForm.name) return setError('Product name required');
        setSaving(true); setError('');
        try {
            if (selectedProd?.id) {
                await api.put(`/inv/products/${selectedProd.id}`, prodForm);
            } else {
                await api.post('/inv/products', prodForm);
            }
            setShowProdModal(false); setSelectedProd(null); setProdForm(EMPTY_PROD); load();
        } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const saveVariant = async () => {
        if (!selectedProd?.id) return;
        setSaving(true); setError('');
        try {
            if (bulkMode) {
                await api.post('/inv/variants/bulk', {
                    product_id: selectedProd.id,
                    school_ids: bulkSchools,
                    sizes: bulkSizes,
                    color: varForm.color,
                    purchase_price: varForm.purchase_price,
                    sale_price: varForm.sale_price,
                    mrp: varForm.mrp,
                });
            } else {
                await api.post('/inv/variants', { ...varForm, product_id: selectedProd.id });
            }
            setShowVarModal(false); setVarForm(EMPTY_VAR); setBulkSizes([]); setBulkSchools([]); load();
        } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const openEdit = (prod) => {
        setSelectedProd(prod);
        setProdForm({ name: prod.name, category_id: prod.category_id||'', article_code: prod.article_code||'',
            unit: prod.unit||'pcs', gst_rate: prod.gst_rate||'5', hsn_code: prod.hsn_code||'',
            min_stock: prod.min_stock||'0', description: prod.description||'',
            sale_price: prod.sale_price||'', purchase_price: prod.purchase_price||'',
            disc_on_sale: prod.disc_on_sale||'0', sale_price_with_tax: prod.sale_price_with_tax !== false });
        setShowProdModal(true);
    };

    const toggleSize = (s) => setBulkSizes(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
    const toggleSchool = (id) => setBulkSchools(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

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
                        <Package className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Item Master</h1>
                    </div>
                    <button onClick={() => { setSelectedProd(null); setProdForm(EMPTY_PROD); setShowProdModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: '#FF6B00' }}>
                        <Plus className="h-4 w-4" /> Add Product
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                            style={inp} />
                    </div>

                    {/* Products Table */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Product Name','Article Code','Category','Unit','GST%','Variants','Stock','Actions'].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></td></tr>
                                        ))
                                    ) : products.length === 0 ? (
                                        <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No products found. Add your first product.</td></tr>
                                    ) : products.map(p => (
                                        <tr key={p.id} className="hover:bg-orange-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</td>
                                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.article_code || '—'}</td>
                                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.category_name || '—'}</td>
                                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.unit}</td>
                                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.gst_rate}%</td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">{p.variant_count}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${parseFloat(p.total_stock)>0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{p.total_stock}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--text-secondary)' }}><Edit2 className="h-4 w-4" /></button>
                                                    <button onClick={() => { setSelectedProd(p); setShowVarModal(true); }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors" style={{ background: 'rgba(255,107,0,0.1)', color: '#FF6B00' }}>
                                                        <Plus className="h-3 w-3" /> Variant
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {/* Product Modal */}
            {showProdModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{selectedProd?.id ? 'Edit Product' : 'Add New Product'}</h3>
                            <button onClick={() => { setShowProdModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Item Name *</label>
                                    <input className={iCls} style={inp} value={prodForm.name} onChange={e => setProdForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Shirt, Pant, Belt" />
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Item HSN</label>
                                    <input className={iCls} style={inp} value={prodForm.hsn_code} onChange={e => setProdForm(f=>({...f,hsn_code:e.target.value}))} placeholder="e.g. 6205" />
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Unit</label>
                                    <select className={iCls} style={inp} value={prodForm.unit} onChange={e => setProdForm(f=>({...f,unit:e.target.value}))}>
                                        {['pcs','pairs','set','dozen','kg','gm','mtr','ltr'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Category</label>
                                    <select className={iCls} style={inp} value={prodForm.category_id} onChange={e => setProdForm(f=>({...f,category_id:e.target.value}))}>
                                        <option value="">-- Select --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Item Code / Article</label>
                                    <input className={iCls} style={inp} value={prodForm.article_code} onChange={e => setProdForm(f=>({...f,article_code:e.target.value}))} placeholder="e.g. SHIRT-001" />
                                </div>
                            </div>

                            {/* Sale Price */}
                            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Sale Price</p>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Sale Price (₹)</label>
                                        <input type="number" min="0" className={iCls} style={inp} value={prodForm.sale_price} onChange={e => setProdForm(f=>({...f,sale_price:e.target.value}))} placeholder="0.00" />
                                    </div>
                                    {/* With / Without Tax toggle */}
                                    <div className="flex rounded-lg overflow-hidden border text-xs font-semibold mb-0.5" style={{ borderColor: 'var(--border-color)' }}>
                                        <button onClick={() => setProdForm(f=>({...f,sale_price_with_tax:true}))}
                                            className={`px-3 py-2.5 transition-colors ${prodForm.sale_price_with_tax ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`} style={prodForm.sale_price_with_tax ? {} : { background: 'var(--bg-surface)' }}>
                                            With Tax
                                        </button>
                                        <button onClick={() => setProdForm(f=>({...f,sale_price_with_tax:false}))}
                                            className={`px-3 py-2.5 transition-colors ${!prodForm.sale_price_with_tax ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`} style={!prodForm.sale_price_with_tax ? {} : { background: 'var(--bg-surface)' }}>
                                            Without Tax
                                        </button>
                                    </div>
                                    <div className="w-32">
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Disc. On Sale (₹)</label>
                                        <input type="number" min="0" className={iCls} style={inp} value={prodForm.disc_on_sale} onChange={e => setProdForm(f=>({...f,disc_on_sale:e.target.value}))} placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            {/* Purchase Price + Tax */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Purchase Price</p>
                                    <input type="number" min="0" className={iCls} style={inp} value={prodForm.purchase_price} onChange={e => setProdForm(f=>({...f,purchase_price:e.target.value}))} placeholder="0.00" />
                                </div>
                                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Tax Rate (GST)</p>
                                    <select className={iCls} style={inp} value={prodForm.gst_rate} onChange={e => setProdForm(f=>({...f,gst_rate:e.target.value}))}>
                                        {['0','5','12','18','28'].map(r => <option key={r} value={r}>GST@{r}%</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Min Stock Alert</label>
                                <input type="number" className={iCls} style={inp} value={prodForm.min_stock} onChange={e => setProdForm(f=>({...f,min_stock:e.target.value}))} />
                            </div>

                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setShowProdModal(false); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                                <button onClick={saveProd} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                    {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Variant Modal */}
            {showVarModal && selectedProd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Add Variants — {selectedProd.name}</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Create size/school combinations</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setBulkMode(m => !m)} className={`text-xs px-3 py-1 rounded-full font-semibold border transition-colors ${bulkMode ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                    {bulkMode ? 'Bulk Mode ON' : 'Bulk Mode'}
                                </button>
                                <button onClick={() => { setShowVarModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} /></button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {bulkMode ? (
                                <>
                                    <div>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Select Schools</label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {schools.map(s => (
                                                <button key={s.id} onClick={() => toggleSchool(s.id)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${bulkSchools.includes(s.id) ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{s.name}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Select Sizes</label>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {SIZES.map(s => (
                                                <button key={s} onClick={() => toggleSize(s)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${bulkSizes.includes(s) ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>School</label>
                                        <select className={iCls} style={inp} value={varForm.school_id} onChange={e => setVarForm(f=>({...f,school_id:e.target.value}))}>
                                            <option value="">Generic (No School)</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Size</label>
                                        <input list="sizes-list" className={iCls} style={inp} value={varForm.size} onChange={e => setVarForm(f=>({...f,size:e.target.value}))} placeholder="e.g. 24, S, M" />
                                        <datalist id="sizes-list">{SIZES.map(s => <option key={s} value={s} />)}</datalist>
                                    </div>
                                    <div>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Color</label>
                                        <input className={iCls} style={inp} value={varForm.color} onChange={e => setVarForm(f=>({...f,color:e.target.value}))} placeholder="e.g. White, Navy" />
                                    </div>
                                </div>
                            )}

                            {/* Prices — common to both modes */}
                            <div className="grid grid-cols-3 gap-3">
                                {[['purchase_price','Purchase Price'],['sale_price','Sale Price'],['mrp','MRP']].map(([k,l]) => (
                                    <div key={k}>
                                        <label className={lCls} style={{ color: 'var(--text-secondary)' }}>{l}</label>
                                        <input type="number" min="0" className={iCls} style={inp} value={varForm[k]} onChange={e => setVarForm(f=>({...f,[k]:e.target.value}))} placeholder="0" />
                                    </div>
                                ))}
                            </div>

                            {bulkMode && bulkSizes.length > 0 && bulkSchools.length > 0 && (
                                <p className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700">
                                    Will create <strong>{bulkSizes.length * bulkSchools.length}</strong> variants ({bulkSchools.length} schools &times; {bulkSizes.length} sizes)
                                </p>
                            )}

                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setShowVarModal(false); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                                <button onClick={saveVariant} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                    {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Create</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
