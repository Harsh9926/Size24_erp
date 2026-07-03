import React, { useState, useEffect } from 'react';
import { Scissors, Plus, Search, RefreshCw, CheckCircle2, AlertCircle, X, Clock } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

const STATUS_COLORS = { pending:'#f59e0b', received:'#3b82f6', in_progress:'#8b5cf6', ready:'#10b981', delivered:'#6b7280', cancelled:'#ef4444' };

export default function ServicePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [orders, setOrders] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [viewOrder, setViewOrder] = useState(null);
    const [form, setForm] = useState({ customer_name:'', customer_mobile:'', order_type:'alteration', items:'[]', delivery_date:'', total_amount:'', advance_paid:'0', tailor_id:'', notes:'' });
    const [employees, setEmployees] = useState([]);
    const [newItem, setNewItem] = useState({ description:'', qty:'1', rate:'', remarks:'' });
    const [formItems, setFormItems] = useState([]);

    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get('/service/orders', { params:{ search:search||undefined, status:statusFilter||undefined } });
            setOrders(r.data);
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [search, statusFilter]);
    useEffect(() => {
        api.get('/hr/employees', { params:{ is_active:'true' } }).then(r=>setEmployees(r.data)).catch(()=>{});
    }, []);

    const addItem = () => {
        if (!newItem.description) return;
        setFormItems(prev => [...prev, { ...newItem }]);
        setNewItem({ description:'', qty:'1', rate:'', remarks:'' });
    };

    const handleCreate = async () => {
        const total = formItems.reduce((s,i) => s + parseFloat(i.qty||1)*parseFloat(i.rate||0), 0);
        try {
            await api.post('/service/orders', { ...form, items: JSON.stringify(formItems), total_amount: total.toString() });
            showMsg('Service order created'); setShowForm(false); setFormItems([]); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.put(`/service/orders/${id}/status`, { status });
            showMsg('Status updated'); load();
            if (viewOrder) setViewOrder(prev => ({...prev, status}));
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handlePayment = async (id, amount) => {
        try {
            await api.post(`/service/orders/${id}/payment`, { amount, payment_mode:'cash' });
            showMsg('Payment recorded'); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const items = viewOrder?.items ? (typeof viewOrder.items === 'string' ? JSON.parse(viewOrder.items) : viewOrder.items) : [];

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                    <Scissors className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Service & Alteration</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                    <button onClick={() => { setShowForm(true); setFormItems([]); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                        <Plus className="h-4 w-4" /> New Order
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-40">
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders…" className={iCls+' pl-9'} style={inp} />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        </div>
                        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={iCls+' w-40'} style={inp}>
                            <option value="">All Status</option>
                            {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                        </select>
                    </div>
                    <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <table className="w-full text-sm">
                            <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                {['Order#','Customer','Mobile','Type','Delivery','Total','Advance','Balance','Status','Action'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} className="border-b hover:bg-orange-50/10 cursor-pointer" style={{ borderColor:'var(--border-color)' }}
                                        onClick={() => setViewOrder(o)}>
                                        <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{o.order_number}</td>
                                        <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{o.customer_name}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{o.customer_mobile||'—'}</td>
                                        <td className="px-3 py-2.5 text-xs capitalize" style={{ color:'var(--text-secondary)' }}>{o.order_type?.replace('_',' ')}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: new Date(o.delivery_date)<new Date()&&o.status!=='delivered'?'#ef4444':'var(--text-secondary)' }}>
                                            {o.delivery_date?new Date(o.delivery_date).toLocaleDateString('en-IN'):'—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{fmt(o.total_amount)}</td>
                                        <td className="px-3 py-2.5 text-xs text-emerald-600">{fmt(o.advance_paid)}</td>
                                        <td className="px-3 py-2.5 text-xs font-bold text-red-500">{fmt(o.balance_due)}</td>
                                        <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                                            <select value={o.status} onChange={e=>handleUpdateStatus(o.id,e.target.value)}
                                                className="text-[10px] font-bold px-2 py-1 rounded-full border-0 text-white cursor-pointer outline-none"
                                                style={{ background: STATUS_COLORS[o.status]||ORANGE }}>
                                                {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                                            {parseFloat(o.balance_due) > 0 && (
                                                <button onClick={() => {
                                                    const amt = prompt(`Collect payment (Balance: ₹${o.balance_due})`);
                                                    if (amt) handlePayment(o.id, amt);
                                                }} className="text-[10px] px-2 py-0.5 rounded bg-orange-500 text-white font-bold whitespace-nowrap">
                                                    Collect
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!loading && orders.length === 0 && (
                                    <tr><td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No service orders</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* New Order Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>New Service Order</h3>
                            <button onClick={() => setShowForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {[['customer_name','Customer Name','text'],['customer_mobile','Mobile','tel'],['delivery_date','Delivery Date','date'],['advance_paid','Advance','number']].map(([k,l,type]) => (
                                    <div key={k}>
                                        <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                        <input type={type} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Type</label>
                                    <select value={form.order_type} onChange={e=>setForm(f=>({...f,order_type:e.target.value}))} className={iCls} style={inp}>
                                        {['alteration','repair','stitching','other'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Assigned Tailor</label>
                                    <select value={form.tailor_id} onChange={e=>setForm(f=>({...f,tailor_id:e.target.value}))} className={iCls} style={inp}>
                                        <option value="">-- Select --</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* Items */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'var(--text-secondary)' }}>Items</p>
                                <div className="space-y-2">
                                    {formItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background:'var(--bg-primary)' }}>
                                            <span className="flex-1 text-xs" style={{ color:'var(--text-primary)' }}>{item.description}</span>
                                            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>×{item.qty}</span>
                                            <span className="text-xs font-bold" style={{ color:ORANGE }}>{fmt(parseFloat(item.qty)*parseFloat(item.rate))}</span>
                                            <button onClick={() => setFormItems(prev=>prev.filter((_,j)=>j!==i))}><X className="h-3 w-3 text-red-400" /></button>
                                        </div>
                                    ))}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[['description','Description','text'],['qty','Qty','number'],['rate','Rate','number'],['remarks','Remarks','text']].map(([k,l,type]) => (
                                            <input key={k} type={type} placeholder={l} value={newItem[k]} onChange={e=>setNewItem(prev=>({...prev,[k]:e.target.value}))} className={iCls} style={inp} />
                                        ))}
                                    </div>
                                    <button onClick={addItem} className="text-xs px-3 py-1.5 rounded-lg font-bold text-white" style={{ background:'#6366f1' }}>+ Add Item</button>
                                    {formItems.length > 0 && (
                                        <p className="text-sm font-bold text-right" style={{ color:ORANGE }}>
                                            Total: {fmt(formItems.reduce((s,i) => s+parseFloat(i.qty||1)*parseFloat(i.rate||0),0))}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Notes</label>
                                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className={iCls} style={inp} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreate} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Create Order</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Order */}
            {viewOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Order {viewOrder.order_number}</h3>
                            <button onClick={() => setViewOrder(null)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {[['Customer',viewOrder.customer_name],['Mobile',viewOrder.customer_mobile||'—'],['Type',viewOrder.order_type],['Status',viewOrder.status],['Delivery',viewOrder.delivery_date?new Date(viewOrder.delivery_date).toLocaleDateString('en-IN'):'—'],['Total',fmt(viewOrder.total_amount)],['Advance',fmt(viewOrder.advance_paid)],['Balance',fmt(viewOrder.balance_due)]].map(([l,v]) => (
                                    <div key={l} className="rounded-xl border px-3 py-2" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                                        <p className="text-[10px]" style={{ color:'var(--text-secondary)' }}>{l}</p>
                                        <p className="text-sm font-bold capitalize" style={{ color:'var(--text-primary)' }}>{v}</p>
                                    </div>
                                ))}
                            </div>
                            {items.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color:'var(--text-secondary)' }}>Items</p>
                                    {items.map((item,i) => (
                                        <div key={i} className="flex justify-between text-sm py-1 border-b" style={{ borderColor:'var(--border-color)' }}>
                                            <span style={{ color:'var(--text-primary)' }}>{item.description} ×{item.qty}</span>
                                            <span className="font-bold" style={{ color:ORANGE }}>{fmt(parseFloat(item.qty)*parseFloat(item.rate))}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold ${toast.type==='error'?'bg-red-600':'bg-emerald-600'} text-white`}>
                    {toast.type==='error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
