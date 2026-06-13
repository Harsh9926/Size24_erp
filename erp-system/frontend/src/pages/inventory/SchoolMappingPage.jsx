import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, X, Save, RefreshCw, BookOpen, Trash2, CheckCircle2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const EMPTY = { name:'', code:'', address:'', contact:'' };

export default function SchoolMappingPage() {
    const [sidebarOpen, setSidebarOpen]   = useState(false);
    const [schools, setSchools]           = useState([]);
    const [allProducts, setAllProducts]   = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolProducts, setSchoolProducts] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [form, setForm]                 = useState(EMPTY);
    const [editSchool, setEditSchool]     = useState(null);
    const [saving, setSaving]             = useState(false);
    const [error, setError]               = useState('');
    const [toast, setToast]               = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, p] = await Promise.all([api.get('/inv/schools'), api.get('/inv/products')]);
            setSchools(s.data); setAllProducts(p.data);
        } catch {} finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const selectSchool = async (school) => {
        setSelectedSchool(school);
        try {
            const r = await api.get(`/inv/schools/${school.id}/products`);
            setSchoolProducts(r.data.map(p => p.product_id));
        } catch {}
    };

    const toggleProduct = (pid) => {
        setSchoolProducts(prev => prev.includes(pid) ? prev.filter(x=>x!==pid) : [...prev, pid]);
    };

    const saveMapping = async () => {
        if (!selectedSchool) return;
        setSaving(true);
        try {
            await api.put(`/inv/schools/${selectedSchool.id}/products`, {
                product_ids: schoolProducts.map(id => ({ product_id: id, is_mandatory: true }))
            });
            showToast('Mapping saved successfully!');
            load();
        } catch (e) { alert(e.response?.data?.error||'Failed'); }
        finally { setSaving(false); }
    };

    const saveSchool = async () => {
        if (!form.name) return setError('Name required');
        setSaving(true); setError('');
        try {
            if (editSchool?.id) await api.put(`/inv/schools/${editSchool.id}`, form);
            else                await api.post('/inv/schools', form);
            setShowModal(false); setEditSchool(null); setForm(EMPTY); load();
        } catch (e) { setError(e.response?.data?.error||'Save failed'); }
        finally { setSaving(false); }
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1"><BookOpen className="h-5 w-5" style={{ color: '#FF6B00' }} /><h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>School Uniform Mapping</h1></div>
                    <button onClick={() => { setEditSchool(null); setForm(EMPTY); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B00' }}><Plus className="h-4 w-4" /> Add School</button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* School List */}
                        <div className="md:col-span-1">
                            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Schools ({schools.length})</p>
                                </div>
                                <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? Array(4).fill(0).map((_,i) => <div key={i} className="p-4"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></div>)
                                    : schools.length===0 ? <p className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No schools yet.</p>
                                    : schools.map(s => (
                                        <div key={s.id} onClick={() => selectSchool(s)}
                                            className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selectedSchool?.id===s.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.product_count} products · {s.customer_count} customers</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={e => { e.stopPropagation(); setEditSchool(s); setForm({name:s.name,code:s.code||'',address:s.address||'',contact:s.contact||''}); setShowModal(true); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-secondary)' }}>
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Product Mapping */}
                        <div className="md:col-span-2">
                            {selectedSchool ? (
                                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{selectedSchool.name} — Uniform Products</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{schoolProducts.length} products assigned</p>
                                        </div>
                                        <button onClick={saveMapping} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                                        </button>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {allProducts.map(p => {
                                            const isChecked = schoolProducts.includes(p.id);
                                            return (
                                                <label key={p.id} onClick={() => toggleProduct(p.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}>
                                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                                                        {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                                                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{p.article_code || p.category_name || '—'}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border flex items-center justify-center py-24 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <div>
                                        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" style={{ color: '#FF6B00' }} />
                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Select a school</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Click a school to configure its uniform products</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* School Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{editSchool?.id?'Edit School':'Add School'}</h3>
                            <button onClick={() => { setShowModal(false); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>School Name *</label><input className={iCls} style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. DPS Pune" /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Short Code</label><input className={iCls} style={inp} value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="e.g. DPS" /></div>
                                <div><label className={lCls} style={{ color:'var(--text-secondary)' }}>Contact</label><input className={iCls} style={inp} value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} /></div>
                                <div className="col-span-2"><label className={lCls} style={{ color:'var(--text-secondary)' }}>Address</label><textarea className={iCls} style={inp} rows={2} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></div>
                            </div>
                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                            <div className="flex gap-3">
                                <button onClick={() => { setShowModal(false); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={saveSchool} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background:'#FF6B00' }}>
                                    {saving?<><RefreshCw className="h-4 w-4 animate-spin"/>Saving…</>:<><Save className="h-4 w-4"/>Save</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />{toast}
                </div>
            )}
        </div>
    );
}
