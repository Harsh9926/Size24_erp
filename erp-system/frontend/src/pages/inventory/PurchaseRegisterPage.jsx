import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Save, RefreshCw, ShoppingCart, Trash2, ChevronDown } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp  = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const fmt  = v => `₹${Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

const STATUS_COLORS = { unpaid:'bg-red-100 text-red-700', partial:'bg-amber-100 text-amber-700', paid:'bg-emerald-100 text-emerald-700', cancelled:'bg-gray-100 text-gray-600' };

export default function PurchaseRegisterPage() {
    const [sidebarOpen, setSidebarOpen]   = useState(false);
    const [bills, setBills]               = useState([]);
    const [totals, setTotals]             = useState({});
    const [suppliers, setSuppliers]       = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);

    const [search, setSearch]   = useState('');
    const [status, setStatus]   = useState('');
    const [from,   setFrom]     = useState('');
    const [to,     setTo]       = useState('');

    // Bill form state
    const [form, setForm]   = useState({ supplier_id:'', bill_number:'', bill_date: todayISO(), due_date:'', notes:'', discount:'0' });
    const [lines, setLines] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');

    // Payment form
    const [payForm, setPayForm] = useState({ amount:'', payment_date: todayISO(), payment_mode:'cash', reference:'', notes:'' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (search) p.set('search', search);
            if (status) p.set('status', status);
            if (from)   p.set('from', from);
            if (to)     p.set('to', to);
            const [b, s] = await Promise.all([
                api.get(`/inv/purchase/bills?${p}`),
                api.get('/inv/parties/suppliers'),
            ]);
            setBills(b.data.bills); setTotals(b.data.totals); setSuppliers(s.data);
        } catch { } finally { setLoading(false); }
    }, [search, status, from, to]);

    useEffect(() => { load(); }, [load]);

    const addLineByBarcode = async () => {
        if (!barcodeInput.trim()) return;
        try {
            const r = await api.get(`/inv/barcode/${barcodeInput.trim()}`);
            const v = r.data;
            setLines(l => [...l, { variant_id: v.id, product_name: `${v.product_name} ${v.school_name||''} Sz:${v.size||''}`.trim(), qty:'1', unit_price: v.purchase_price||'0', gst_rate: v.gst_rate||'0' }]);
            setBarcodeInput('');
        } catch { alert('Product not found'); }
    };

    const addEmptyLine = () => setLines(l => [...l, { variant_id:'', product_name:'', qty:'1', unit_price:'0', gst_rate:'0' }]);
    const removeLine = (i) => setLines(l => l.filter((_,idx) => idx !== i));
    const updateLine = (i, k, v) => setLines(l => l.map((line, idx) => idx===i ? {...line,[k]:v} : line));

    const lineTotal = (line) => {
        const base = parseFloat(line.qty||0) * parseFloat(line.unit_price||0);
        return base + base * (parseFloat(line.gst_rate||0)/100);
    };
    const subtotal = lines.reduce((s,l) => s + parseFloat(l.qty||0)*parseFloat(l.unit_price||0), 0);
    const gstTotal = lines.reduce((s,l) => { const b=parseFloat(l.qty||0)*parseFloat(l.unit_price||0); return s+b*(parseFloat(l.gst_rate||0)/100); }, 0);
    const grandTotal = subtotal + gstTotal - parseFloat(form.discount||0);

    const saveBill = async () => {
        if (!form.supplier_id) return setError('Select a supplier');
        if (!lines.length || lines.some(l => !l.variant_id)) return setError('Add at least one product with variant selected');
        setSaving(true); setError('');
        try {
            await api.post('/inv/purchase/bills', {
                ...form,
                items: lines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: l.unit_price, gst_rate: l.gst_rate }))
            });
            setShowModal(false); setLines([]); setForm({ supplier_id:'', bill_number:'', bill_date:todayISO(), due_date:'', notes:'', discount:'0' }); load();
        } catch (e) { setError(e.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const recordPayment = async () => {
        if (!payForm.amount) return;
        setSaving(true);
        try {
            await api.post('/inv/purchase/payments', { ...payForm, bill_id: selectedBill.id, supplier_id: selectedBill.supplier_id });
            setShowPayModal(false); setPayForm({ amount:'', payment_date:todayISO(), payment_mode:'cash', reference:'', notes:'' }); load();
        } catch (e) { alert(e.response?.data?.error || 'Failed'); }
        finally { setSaving(false); }
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
                        <ShoppingCart className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Purchase Register</h1>
                    </div>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B00' }}>
                        <Plus className="h-4 w-4" /> New Bill
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {/* Summary Cards */}
                    {!loading && (
                        <div className="grid grid-cols-3 gap-3">
                            {[['Total Bills', fmt(totals.total_amount), 'text-gray-700'],
                              ['Paid', fmt(totals.paid_amount), 'text-emerald-600'],
                              ['Balance', fmt(totals.balance), 'text-red-600']].map(([l,v,c]) => (
                                <div key={l} className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l}</p>
                                    <p className={`text-xl font-bold mt-1 ${c}`}>{v}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-40">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bill / supplier…"
                                className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Status</option>
                            {['unpaid','partial','paid','cancelled'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                        </select>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>

                    {/* Bills Table — Vyapar style */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Date','Supplier','Bill No.','GSTIN','Due Date','Status','Total','Paid','Balance','Action'].map(h => (
                                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? Array(5).fill(0).map((_,i) => (
                                        <tr key={i}><td colSpan={10} className="px-3 py-2.5"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></td></tr>
                                    )) : bills.length === 0 ? (
                                        <tr><td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No purchase bills found.</td></tr>
                                    ) : bills.map(b => (
                                        <tr key={b.id} className="hover:bg-orange-50/20 transition-colors">
                                            <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)' }}>{b.bill_date?.split('T')[0]}</td>
                                            <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{b.supplier_name}</td>
                                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{b.bill_number || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{b.supplier_gst || '—'}</td>
                                            <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: b.due_date && new Date(b.due_date) < new Date() && b.status !== 'paid' ? '#ef4444' : 'var(--text-secondary)' }}>{b.due_date?.split('T')[0] || '—'}</td>
                                            <td className="px-3 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status?.toUpperCase()}</span></td>
                                            <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap text-emerald-600">₹{Number(b.paid_amount).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold whitespace-nowrap" style={{ color: parseFloat(b.balance)>0 ? '#ef4444' : 'var(--text-secondary)' }}>₹{Number(b.balance).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-2.5">
                                                {b.status !== 'paid' && b.status !== 'cancelled' && (
                                                    <button onClick={() => { setSelectedBill(b); setPayForm({ amount: b.balance, payment_date: todayISO(), payment_mode:'cash', reference:'', notes:'' }); setShowPayModal(true); }}
                                                        className="text-xs px-2 py-1 rounded-lg font-semibold text-white" style={{ background: '#FF6B00' }}>Pay</button>
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

            {/* New Bill Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--bg-surface)', maxHeight: '92vh' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>New Purchase Bill</h3>
                            <button onClick={() => { setShowModal(false); setLines([]); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Header fields */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Supplier *</label>
                                    <select className={iCls} style={inp} value={form.supplier_id} onChange={e => setForm(f=>({...f,supplier_id:e.target.value}))}>
                                        <option value="">-- Select Supplier --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Bill Number</label>
                                    <input className={iCls} style={inp} value={form.bill_number} onChange={e => setForm(f=>({...f,bill_number:e.target.value}))} placeholder="Auto-generated if empty" />
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Bill Date</label>
                                    <input type="date" className={iCls} style={inp} value={form.bill_date} onChange={e => setForm(f=>({...f,bill_date:e.target.value}))} />
                                </div>
                                <div>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Due Date</label>
                                    <input type="date" className={iCls} style={inp} value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} />
                                </div>
                            </div>

                            {/* Barcode scanner / add lines */}
                            <div className="flex gap-2">
                                <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addLineByBarcode()}
                                    className="flex-1 px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                                    style={inp} placeholder="Scan barcode or type SKU + Enter…" />
                                <button onClick={addLineByBarcode} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#FF6B00' }}>Scan</button>
                                <button onClick={addEmptyLine} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>+ Add Row</button>
                            </div>

                            {/* Line items */}
                            {lines.length > 0 && (
                                <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                                {['Product','Qty','Unit Price','GST%','Total',''].map(h => (
                                                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                            {lines.map((line, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2">
                                                        {line.product_name ? (
                                                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{line.product_name}</span>
                                                        ) : (
                                                            <input className="w-full px-2 py-1 border rounded text-xs outline-none" style={inp} placeholder="SKU or product name" value={line.product_name} onChange={e => updateLine(i,'product_name',e.target.value)} />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2"><input type="number" min="0.001" step="0.001" className="w-20 px-2 py-1 border rounded text-xs outline-none text-center" style={inp} value={line.qty} onChange={e => updateLine(i,'qty',e.target.value)} /></td>
                                                    <td className="px-3 py-2"><input type="number" min="0" step="0.01" className="w-24 px-2 py-1 border rounded text-xs outline-none text-right" style={inp} value={line.unit_price} onChange={e => updateLine(i,'unit_price',e.target.value)} /></td>
                                                    <td className="px-3 py-2">
                                                        <select className="px-2 py-1 border rounded text-xs outline-none" style={inp} value={line.gst_rate} onChange={e => updateLine(i,'gst_rate',e.target.value)}>
                                                            {['0','5','12','18','28'].map(r => <option key={r} value={r}>{r}%</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color: '#FF6B00' }}>₹{lineTotal(line).toFixed(2)}</td>
                                                    <td className="px-3 py-2"><button onClick={() => removeLine(i)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Totals */}
                            {lines.length > 0 && (
                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2 text-sm">
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Subtotal</span><span style={{ color: 'var(--text-primary)' }}>₹{subtotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>GST</span><span style={{ color: 'var(--text-primary)' }}>₹{gstTotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center">
                                            <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                                            <input type="number" min="0" value={form.discount} onChange={e => setForm(f=>({...f,discount:e.target.value}))} className="w-28 px-2 py-1 border rounded text-xs text-right outline-none" style={inp} />
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor: 'var(--border-color)' }}>
                                            <span style={{ color: 'var(--text-primary)' }}>Total</span>
                                            <span style={{ color: '#FF6B00' }}>₹{grandTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                        </div>
                        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                            <button onClick={() => { setShowModal(false); setLines([]); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Cancel</button>
                            <button onClick={saveBill} disabled={saving || !lines.length} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Bill</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayModal && selectedBill && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                            <div>
                                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Record Payment</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Balance: ₹{Number(selectedBill.balance).toLocaleString('en-IN')}</p>
                            </div>
                            <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[['amount','Amount','number'],['payment_date','Payment Date','date'],['reference','Reference','text']].map(([k,l,t]) => (
                                <div key={k}>
                                    <label className={lCls} style={{ color: 'var(--text-secondary)' }}>{l}</label>
                                    <input type={t} className={iCls} style={inp} value={payForm[k]} onChange={e => setPayForm(f=>({...f,[k]:e.target.value}))} />
                                </div>
                            ))}
                            <div>
                                <label className={lCls} style={{ color: 'var(--text-secondary)' }}>Mode</label>
                                <select className={iCls} style={inp} value={payForm.payment_mode} onChange={e => setPayForm(f=>({...f,payment_mode:e.target.value}))}>
                                    {['cash','bank','upi','cheque'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowPayModal(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Cancel</button>
                                <button onClick={recordPayment} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60" style={{ background: '#FF6B00' }}>
                                    {saving ? 'Saving…' : 'Record Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
