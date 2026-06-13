import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Save, RefreshCw, TrendingUp, Trash2 } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const iCls  = "w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition";
const lCls  = "block text-xs font-semibold mb-1 uppercase tracking-wide";
const inp   = { background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };
const fmt   = v => `₹${Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const STATUS_COLORS = { draft:'bg-gray-100 text-gray-600', unpaid:'bg-red-100 text-red-700', partial:'bg-amber-100 text-amber-700', paid:'bg-emerald-100 text-emerald-700', cancelled:'bg-gray-100 text-gray-500' };

export default function SalesInvoicePage() {
    const [sidebarOpen, setSidebarOpen]   = useState(false);
    const [invoices, setInvoices]         = useState([]);
    const [totals, setTotals]             = useState({});
    const [customers, setCustomers]       = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedInv, setSelectedInv]   = useState(null);

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [from, setFrom]     = useState('');
    const [to, setTo]         = useState('');

    const [form, setForm]     = useState({ customer_id:'', invoice_date:today(), due_date:'', notes:'', discount:'0' });
    const [lines, setLines]   = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [payForm, setPayForm] = useState({ amount:'', payment_date:today(), payment_mode:'cash', reference:'' });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (search) p.set('search', search);
            if (status) p.set('status', status);
            if (from)   p.set('from', from);
            if (to)     p.set('to', to);
            const [inv, c] = await Promise.all([api.get(`/inv/sales/invoices?${p}`), api.get('/inv/parties/customers')]);
            setInvoices(inv.data.invoices); setTotals(inv.data.totals); setCustomers(c.data);
        } catch {} finally { setLoading(false); }
    }, [search, status, from, to]);

    useEffect(() => { load(); }, [load]);

    const addByBarcode = async () => {
        if (!barcodeInput.trim()) return;
        try {
            const r = await api.get(`/inv/barcode/${barcodeInput.trim()}`);
            const v = r.data;
            if (parseFloat(v.stock) <= 0) { alert(`${v.product_name} — Out of stock!`); return; }
            setLines(l => [...l, { variant_id: v.id, product_name: `${v.product_name} ${v.school_name||''} Sz:${v.size||''}`.trim(), qty:'1', unit_price: v.sale_price||'0', gst_rate: v.gst_rate||'0', discount:'0' }]);
            setBarcodeInput('');
        } catch { alert('Product not found'); }
    };

    const addEmptyLine = () => setLines(l => [...l, { variant_id:'', product_name:'', qty:'1', unit_price:'0', gst_rate:'0', discount:'0' }]);
    const removeLine = (i) => setLines(l => l.filter((_,idx) => idx!==i));
    const updLine = (i,k,v) => setLines(l => l.map((line,idx) => idx===i ? {...line,[k]:v} : line));

    const lineTotal = (l) => {
        const base = parseFloat(l.qty||0)*parseFloat(l.unit_price||0) - parseFloat(l.discount||0);
        return base + base*(parseFloat(l.gst_rate||0)/100);
    };
    const subtotal   = lines.reduce((s,l) => s + parseFloat(l.qty||0)*parseFloat(l.unit_price||0), 0);
    const discTotal  = lines.reduce((s,l) => s + parseFloat(l.discount||0), 0);
    const gstTotal   = lines.reduce((s,l) => { const b=parseFloat(l.qty||0)*parseFloat(l.unit_price||0)-parseFloat(l.discount||0); return s+b*(parseFloat(l.gst_rate||0)/100); }, 0);
    const grandTotal = subtotal - discTotal + gstTotal - parseFloat(form.discount||0);

    const saveInvoice = async () => {
        if (!lines.length || lines.some(l => !l.variant_id)) return setError('Add at least one product');
        setSaving(true); setError('');
        try {
            await api.post('/inv/sales/invoices', {
                ...form,
                items: lines.map(l => ({ variant_id:l.variant_id, qty:l.qty, unit_price:l.unit_price, gst_rate:l.gst_rate, discount:l.discount }))
            });
            setShowModal(false); setLines([]); setForm({ customer_id:'', invoice_date:today(), due_date:'', notes:'', discount:'0' }); load();
        } catch (e) { setError(e.response?.data?.error||'Save failed'); }
        finally { setSaving(false); }
    };

    const recordPayment = async () => {
        if (!payForm.amount) return;
        setSaving(true);
        try {
            await api.post('/inv/sales/payments', { ...payForm, invoice_id: selectedInv.id, customer_id: selectedInv.customer_id });
            setShowPayModal(false); setPayForm({ amount:'', payment_date:today(), payment_mode:'cash', reference:'' }); load();
        } catch (e) { alert(e.response?.data?.error||'Failed'); }
        finally { setSaving(false); }
    };

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex items-center gap-2 flex-1"><TrendingUp className="h-5 w-5" style={{ color: '#FF6B00' }} /><h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Sales Invoices</h1></div>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6B00' }}><Plus className="h-4 w-4" /> New Invoice</button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {/* Vyapar-style summary card */}
                    {!loading && (
                        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Total Sales Amount</p>
                            <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{fmt(totals.total_amount)}</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                Received: <span className="font-bold text-emerald-600">{fmt(totals.paid_amount)}</span>
                                <span className="mx-2">|</span>
                                Balance: <span className="font-bold text-red-500">{fmt(totals.balance)}</span>
                            </p>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-40">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice / party…" className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-400" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        </div>
                        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                        <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                            <option value="">All Status</option>
                            {['draft','unpaid','partial','paid','cancelled'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                        </select>
                    </div>

                    {/* Transactions table — Vyapar style */}
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Transactions</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                                        {['Date','Invoice No','Party Name','Transaction','Payment Type','Amount','Balance','Status','Actions'].map(h=>(
                                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {loading ? Array(5).fill(0).map((_,i)=><tr key={i}><td colSpan={9} className="px-3 py-2.5"><div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-primary)' }} /></td></tr>)
                                    : invoices.length===0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No transactions found.</td></tr>
                                    : invoices.map(inv=>(
                                        <tr key={inv.id} className="hover:bg-orange-50/20 transition-colors">
                                            <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color:'var(--text-secondary)' }}>
                                                {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color:'#FF6B00' }}>{inv.invoice_number}</td>
                                            <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color:'var(--text-primary)' }}>
                                                {inv.customer_name || 'Walk-in'}
                                                {inv.customer_mobile && <span className="block text-[10px]" style={{ color:'var(--text-secondary)' }}>{inv.customer_mobile}</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>Sale</td>
                                            <td className="px-3 py-2.5">
                                                {inv.payment_mode
                                                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{inv.payment_mode}</span>
                                                    : <span className="text-[10px]" style={{ color:'var(--text-secondary)' }}>—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color:'var(--text-primary)' }}>₹{Number(inv.total_amount).toLocaleString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold whitespace-nowrap" style={{ color: parseFloat(inv.balance)>0?'#ef4444':'var(--text-secondary)' }}>
                                                ₹{Number(inv.balance).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status]||''}`}>{inv.status?.toUpperCase()}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {inv.status!=='paid' && inv.status!=='cancelled' && (
                                                    <button onClick={() => { setSelectedInv(inv); setPayForm({ amount:inv.balance, payment_date:today(), payment_mode:'cash', reference:'' }); setShowPayModal(true); }}
                                                        className="text-xs px-2 py-1 rounded-lg font-semibold text-white whitespace-nowrap" style={{ background:'#FF6B00' }}>Collect</button>
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

            {/* New Invoice Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background:'var(--bg-surface)', maxHeight:'92vh' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold" style={{ color:'var(--text-primary)' }}>New Sales Invoice</h3>
                            <button onClick={() => { setShowModal(false); setLines([]); setError(''); }} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className={lCls} style={{ color:'var(--text-secondary)' }}>Customer (optional)</label>
                                    <select className={iCls} style={inp} value={form.customer_id} onChange={e=>setForm(f=>({...f,customer_id:e.target.value}))}>
                                        <option value="">Walk-in Customer</option>
                                        {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={lCls} style={{ color:'var(--text-secondary)' }}>Invoice Date</label>
                                    <input type="date" className={iCls} style={inp} value={form.invoice_date} onChange={e=>setForm(f=>({...f,invoice_date:e.target.value}))} />
                                </div>
                                <div>
                                    <label className={lCls} style={{ color:'var(--text-secondary)' }}>Due Date</label>
                                    <input type="date" className={iCls} style={inp} value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input value={barcodeInput} onChange={e=>setBarcodeInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addByBarcode()}
                                    className="flex-1 px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400" style={inp} placeholder="Scan barcode or SKU + Enter…" />
                                <button onClick={addByBarcode} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background:'#FF6B00' }}>Scan</button>
                                <button onClick={addEmptyLine} className="px-4 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor:'var(--border-color)', color:'var(--text-primary)', background:'var(--bg-primary)' }}>+ Add Row</button>
                            </div>

                            {lines.length>0 && (
                                <div className="border rounded-xl overflow-hidden" style={{ borderColor:'var(--border-color)' }}>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                                {['Product','Qty','Unit Price','Discount','GST%','Total',''].map(h=>(
                                                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor:'var(--border-color)' }}>
                                            {lines.map((line,i)=>(
                                                <tr key={i}>
                                                    <td className="px-3 py-2">
                                                        {line.product_name ? <span className="text-xs font-medium" style={{ color:'var(--text-primary)' }}>{line.product_name}</span>
                                                        : <input className="w-full px-2 py-1 border rounded text-xs outline-none" style={inp} placeholder="SKU" value={line.product_name} onChange={e=>updLine(i,'product_name',e.target.value)} />}
                                                    </td>
                                                    <td className="px-3 py-2"><input type="number" min="0.001" step="0.001" className="w-20 px-2 py-1 border rounded text-xs outline-none text-center" style={inp} value={line.qty} onChange={e=>updLine(i,'qty',e.target.value)} /></td>
                                                    <td className="px-3 py-2"><input type="number" min="0" className="w-24 px-2 py-1 border rounded text-xs outline-none text-right" style={inp} value={line.unit_price} onChange={e=>updLine(i,'unit_price',e.target.value)} /></td>
                                                    <td className="px-3 py-2"><input type="number" min="0" className="w-20 px-2 py-1 border rounded text-xs outline-none text-right" style={inp} value={line.discount} onChange={e=>updLine(i,'discount',e.target.value)} /></td>
                                                    <td className="px-3 py-2">
                                                        <select className="px-2 py-1 border rounded text-xs outline-none" style={inp} value={line.gst_rate} onChange={e=>updLine(i,'gst_rate',e.target.value)}>
                                                            {['0','5','12','18','28'].map(r=><option key={r} value={r}>{r}%</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs font-semibold" style={{ color:'#FF6B00' }}>₹{lineTotal(line).toFixed(2)}</td>
                                                    <td className="px-3 py-2"><button onClick={()=>removeLine(i)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {lines.length>0 && (
                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2 text-sm">
                                        <div className="flex justify-between"><span style={{ color:'var(--text-secondary)' }}>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span style={{ color:'var(--text-secondary)' }}>Discount</span><span>₹{discTotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span style={{ color:'var(--text-secondary)' }}>GST</span><span>₹{gstTotal.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-bold border-t pt-2" style={{ borderColor:'var(--border-color)' }}>
                                            <span style={{ color:'var(--text-primary)' }}>Grand Total</span>
                                            <span style={{ color:'#FF6B00' }}>₹{grandTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                        </div>
                        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                            <button onClick={() => { setShowModal(false); setLines([]); setError(''); }} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)', color:'var(--text-primary)' }}>Cancel</button>
                            <button onClick={saveInvoice} disabled={saving||!lines.length} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background:'#FF6B00' }}>
                                {saving?<><RefreshCw className="h-4 w-4 animate-spin"/>Saving…</>:<><Save className="h-4 w-4"/>Save Invoice</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayModal && selectedInv && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <div>
                                <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Collect Payment</h3>
                                <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>Due: ₹{Number(selectedInv.balance).toLocaleString('en-IN')}</p>
                            </div>
                            <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-gray-200"><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[['amount','Amount','number'],['payment_date','Payment Date','date'],['reference','Reference','text']].map(([k,l,t])=>(
                                <div key={k}>
                                    <label className={lCls} style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input type={t} className={iCls} style={inp} value={payForm[k]} onChange={e=>setPayForm(f=>({...f,[k]:e.target.value}))} />
                                </div>
                            ))}
                            <div>
                                <label className={lCls} style={{ color:'var(--text-secondary)' }}>Mode</label>
                                <select className={iCls} style={inp} value={payForm.payment_mode} onChange={e=>setPayForm(f=>({...f,payment_mode:e.target.value}))}>
                                    {['cash','bank','upi','cheque'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowPayModal(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={recordPayment} disabled={saving} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60" style={{ background:'#FF6B00' }}>
                                    {saving?'Saving…':'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
