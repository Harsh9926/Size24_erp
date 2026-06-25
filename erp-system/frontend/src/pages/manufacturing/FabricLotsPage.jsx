import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { Plus, X, RefreshCw, Layers, Search, ChevronRight } from 'lucide-react';

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

/* ── Add Lot Modal ── */
const AddLotModal = ({ materials, suppliers, warehouses, onSave, onClose }) => {
    const [form, setForm] = useState({
        material_id: '', lot_number: '', total_qty: '', total_cost: '',
        purchase_date: new Date().toISOString().split('T')[0],
        supplier_id: '', warehouse_id: '', invoice_number: '', notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const costPerUnit = form.total_qty && form.total_cost
        ? (parseFloat(form.total_cost) / parseFloat(form.total_qty)).toFixed(4)
        : null;

    const handleSave = async () => {
        if (!form.material_id || !form.lot_number || !form.total_qty || !form.total_cost || !form.purchase_date) {
            return setErr('All required fields must be filled');
        }
        setSaving(true);
        try {
            await api.post('/mfg/raw-materials/fabric-lots', form);
            onSave();
        } catch (e) {
            setErr(e.response?.data?.error || 'Save failed');
        } finally { setSaving(false); }
    };

    // Fabric-type materials only
    const fabricMaterials = materials;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Create Fabric Lot</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <F label="Material" required>
                                <select className={inp} style={iStyle} value={form.material_id} onChange={set('material_id')}>
                                    <option value="">— Select Material —</option>
                                    {fabricMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                                </select>
                            </F>
                        </div>
                        <F label="Lot Number" required>
                            <input className={inp} style={iStyle} value={form.lot_number} onChange={set('lot_number')} placeholder="e.g. A001" />
                        </F>
                        <F label="Purchase Date" required>
                            <input type="date" className={inp} style={iStyle} value={form.purchase_date} onChange={set('purchase_date')} />
                        </F>
                        <F label="Total Qty (meters/kg)" required>
                            <input type="number" step="0.001" className={inp} style={iStyle} value={form.total_qty} onChange={set('total_qty')} placeholder="e.g. 2500" />
                        </F>
                        <F label="Total Cost (₹)" required>
                            <input type="number" step="0.01" className={inp} style={iStyle} value={form.total_cost} onChange={set('total_cost')} placeholder="e.g. 10000" />
                        </F>

                        {costPerUnit && (
                            <div className="col-span-2 px-4 py-3 rounded-xl text-sm font-bold" style={{ background: '#FF6B001a', color: '#FF6B00' }}>
                                ERP Calculated Cost: ₹{costPerUnit} per unit
                            </div>
                        )}

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
                        <F label="Invoice #">
                            <input className={inp} style={iStyle} value={form.invoice_number} onChange={set('invoice_number')} placeholder="Optional" />
                        </F>
                        <F label="Notes">
                            <input className={inp} style={iStyle} value={form.notes} onChange={set('notes')} placeholder="Optional" />
                        </F>
                    </div>
                    {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
                </div>
                <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                        {saving ? 'Creating…' : 'Create Lot'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Usage Modal ── */
const UsageModal = ({ lot, onClose }) => {
    const [detail, setDetail] = useState(null);
    const [form, setForm]     = useState({ used_qty: '', used_date: new Date().toISOString().split('T')[0], note: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr]       = useState('');
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const loadDetail = useCallback(() => {
        api.get(`/mfg/raw-materials/fabric-lots/${lot.id}`)
            .then(r => setDetail(r.data))
            .catch(() => {});
    }, [lot.id]);

    useEffect(() => { loadDetail(); }, [loadDetail]);

    const handleRecord = async () => {
        if (!form.used_qty) return setErr('used_qty required');
        setSaving(true);
        try {
            await api.post(`/mfg/raw-materials/fabric-lots/${lot.id}/usage`, form);
            setForm(f => ({ ...f, used_qty: '', note: '' }));
            setErr('');
            loadDetail();
        } catch (e) {
            setErr(e.response?.data?.error || 'Failed');
        } finally { setSaving(false); }
    };

    const pct = detail ? Math.round((parseFloat(detail.lot.used_qty) / parseFloat(detail.lot.total_qty)) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Lot {lot.lot_number}</h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{detail?.lot.material_name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="overflow-y-auto p-6 space-y-5">
                    {detail && (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'Total', value: `${Number(detail.lot.total_qty).toFixed(2)} ${detail.lot.material_unit}` },
                                    { label: 'Used', value: `${Number(detail.lot.used_qty).toFixed(2)} ${detail.lot.material_unit}` },
                                    { label: 'Available', value: `${Number(detail.lot.available_qty).toFixed(2)} ${detail.lot.material_unit}`, highlight: true },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-xl text-center border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: s.highlight ? '#10b981' : 'var(--text-primary)' }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Progress bar */}
                            <div>
                                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Usage</span><span>{pct}%</span>
                                </div>
                                <div className="h-2 rounded-full" style={{ background: 'var(--border-color)' }}>
                                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 85 ? '#ef4444' : '#FF6B00' }} />
                                </div>
                            </div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                Cost/unit: ₹{Number(detail.lot.cost_per_unit).toFixed(4)} · Total Cost: ₹{Number(detail.lot.total_cost).toLocaleString('en-IN')}
                            </div>

                            {/* Record Usage */}
                            <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Record Usage</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <F label="Qty Used" required>
                                        <input type="number" step="0.001" className={inp} style={iStyle} value={form.used_qty} onChange={set('used_qty')} placeholder="0" />
                                    </F>
                                    <F label="Date">
                                        <input type="date" className={inp} style={iStyle} value={form.used_date} onChange={set('used_date')} />
                                    </F>
                                    <div className="col-span-2">
                                        <F label="Note">
                                            <input className={inp} style={iStyle} value={form.note} onChange={set('note')} placeholder="Optional" />
                                        </F>
                                    </div>
                                </div>
                                {err && <p className="text-sm text-red-600">{err}</p>}
                                <button onClick={handleRecord} disabled={saving} className="px-4 py-2 text-sm font-bold rounded-xl text-white" style={{ background: saving ? '#9ca3af' : '#FF6B00' }}>
                                    {saving ? 'Recording…' : 'Record Usage'}
                                </button>
                            </div>

                            {/* Usage History */}
                            <div>
                                <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Usage History ({detail.usage.length})</p>
                                {detail.usage.length === 0 ? (
                                    <p className="text-sm text-center py-3" style={{ color: 'var(--text-secondary)' }}>No usage recorded yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {detail.usage.map(u => (
                                            <div key={u.id} className="flex justify-between px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{Number(u.used_qty).toFixed(3)} {detail.lot.material_unit}</p>
                                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.used_date?.slice(0,10)} · {u.note || 'No note'}</p>
                                                </div>
                                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.created_by_name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function FabricLotsPage() {
    const [lots, setLots]             = useState([]);
    const [materials, setMaterials]   = useState([]);
    const [suppliers, setSuppliers]   = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [matFilter, setMatFilter]   = useState('');
    const [modal, setModal]           = useState(null); // 'add' | { usage: lot }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = matFilter ? { material_id: matFilter } : {};
            const [lRes, mRes, sRes, wRes] = await Promise.all([
                api.get('/mfg/raw-materials/fabric-lots/list', { params }),
                api.get('/mfg/raw-materials'),
                api.get('/inv/parties/suppliers'),
                api.get('/mfg/raw-materials/warehouses'),
            ]);
            setLots(lRes.data);
            setMaterials(mRes.data);
            setSuppliers(sRes.data);
            setWarehouses(wRes.data);
        } catch { /* */ }
        finally { setLoading(false); }
    }, [matFilter]);

    useEffect(() => { load(); }, [load]);

    const closeModal = () => { setModal(null); load(); };

    return (
        <Layout>
            <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Fabric Lots</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Each purchase creates a lot — cost per meter auto-calculated</p>
                    </div>
                    <button onClick={() => setModal('add')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#FF6B00' }}>
                        <Plus className="h-4 w-4" /> New Lot
                    </button>
                </div>

                <div className="flex gap-3 flex-wrap">
                    <select className="px-3 py-2.5 text-sm rounded-xl border outline-none" style={iStyle} value={matFilter} onChange={e => setMatFilter(e.target.value)}>
                        <option value="">All Materials</option>
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <button onClick={load} className="p-2.5 rounded-xl border" style={iStyle}><RefreshCw className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} /></button>
                </div>

                {/* Lots Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1,2,3].map(i => <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />)}
                    </div>
                ) : lots.length === 0 ? (
                    <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                        <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>No fabric lots yet. Create your first lot.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lots.map(lot => {
                            const usedPct = lot.total_qty > 0 ? Math.round((lot.used_qty / lot.total_qty) * 100) : 0;
                            return (
                                <div key={lot.id} className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Lot {lot.lot_number}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lot.material_name}</p>
                                        </div>
                                        <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: '#FF6B001a', color: '#FF6B00' }}>
                                            ₹{Number(lot.cost_per_unit).toFixed(2)}/{lot.material_unit}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{Number(lot.total_qty).toFixed(1)}</p>
                                            <p style={{ color: 'var(--text-secondary)' }}>Total</p>
                                        </div>
                                        <div>
                                            <p className="font-bold" style={{ color: '#ef4444' }}>{Number(lot.used_qty).toFixed(1)}</p>
                                            <p style={{ color: 'var(--text-secondary)' }}>Used</p>
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-500">{Number(lot.available_qty).toFixed(1)}</p>
                                            <p style={{ color: 'var(--text-secondary)' }}>Available</p>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="h-1.5 rounded-full" style={{ background: 'var(--border-color)' }}>
                                            <div className="h-1.5 rounded-full" style={{ width: `${usedPct}%`, background: usedPct > 85 ? '#ef4444' : '#FF6B00' }} />
                                        </div>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                            {usedPct}% used · ₹{Number(lot.total_cost).toLocaleString('en-IN')} total
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {lot.purchase_date?.slice(0,10)} · {lot.supplier_name || 'No supplier'}
                                        </p>
                                        <button onClick={() => setModal({ usage: lot })} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#FF6B001a', color: '#FF6B00' }}>
                                            Manage <ChevronRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {modal === 'add' && (
                <AddLotModal materials={materials} suppliers={suppliers} warehouses={warehouses} onSave={closeModal} onClose={() => setModal(null)} />
            )}
            {modal?.usage && (
                <UsageModal lot={modal.usage} onClose={closeModal} />
            )}
        </Layout>
    );
}
