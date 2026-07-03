import React, { useState, useEffect } from 'react';
import { Store, Plus, RefreshCw, CheckCircle2, AlertCircle, X, DollarSign, Package } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt = v => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';
const TABS = ['Partners','Orders','Settlements'];

export default function FranchisePage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState('Partners');
    const [toast, setToast] = useState(null);
    const showMsg = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

    const [partners, setPartners] = useState([]);
    const [orders, setOrders]     = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPartnerForm, setShowPartnerForm] = useState(false);
    const [partnerForm, setPartnerForm] = useState({ business_name:'', owner_name:'', mobile:'', email:'', city:'', state:'', commission_pct:'5', credit_limit:'0' });
    const [showTopup, setShowTopup] = useState(false);
    const [topupForm, setTopupForm] = useState({ partner_id:'', amount:'', type:'credit', narration:'' });

    const load = async () => {
        setLoading(true);
        try {
            if (tab === 'Partners') {
                const [pR, dR] = await Promise.all([
                    api.get('/franchise/partners'),
                    api.get('/franchise/dashboard'),
                ]);
                setPartners(pR.data); setDashboard(dR.data);
            } else if (tab === 'Orders') {
                const r = await api.get('/franchise/orders');
                setOrders(r.data);
            } else if (tab === 'Settlements') {
                const r = await api.get('/franchise/settlements');
                setSettlements(r.data);
            }
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [tab]);

    const handleCreatePartner = async () => {
        try {
            await api.post('/franchise/partners', partnerForm);
            showMsg('Partner created'); setShowPartnerForm(false); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleTopup = async () => {
        try {
            await api.post('/franchise/wallet', topupForm);
            showMsg('Wallet updated'); setShowTopup(false); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleApproveOrder = async (id) => {
        try {
            await api.put(`/franchise/orders/${id}/approve`);
            showMsg('Order approved'); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

    const handleSettle = async (partnerId) => {
        try {
            const r = await api.post('/franchise/settlements', { partner_id: partnerId });
            showMsg(`Settled ${fmt(r.data.settlement_amount)}`); load();
        } catch (e) { showMsg(e.response?.data?.error||'Failed','error'); }
    };

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
                    <Store className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Franchise</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" style={{ color:'var(--text-secondary)' }} />}
                </header>

                {tab === 'Partners' && dashboard && (
                    <div className="flex gap-3 px-4 md:px-6 py-3 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor:'var(--border-color)' }}>
                        {[['Total Partners',dashboard.stats?.total_partners,ORANGE],['Active',dashboard.stats?.active,'#10b981'],['Pending Orders',dashboard.stats?.pending_orders,'#f59e0b']].map(([l,v,c]) => (
                            <div key={l} className="flex-shrink-0 rounded-xl border px-4 py-2.5" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{l}</p>
                                <p className="text-xl font-extrabold" style={{ color:c }}>{v||0}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-1 px-4 py-3 border-b overflow-x-auto flex-shrink-0" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${tab===t?'text-white':'border'}`}
                            style={tab===t?{background:ORANGE}:{borderColor:'var(--border-color)',background:'var(--bg-primary)',color:'var(--text-secondary)'}}>
                            {t}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {tab === 'Partners' && (
                        <div className="space-y-4">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowTopup(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border" style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)', color:'var(--text-primary)' }}>
                                    <DollarSign className="h-4 w-4" /> Wallet Topup
                                </button>
                                <button onClick={() => setShowPartnerForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background:ORANGE }}>
                                    <Plus className="h-4 w-4" /> Add Partner
                                </button>
                            </div>
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <table className="w-full text-sm">
                                    <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                        {['Code','Business','Owner','Mobile','City','Commission','Wallet','Credit Limit','Status'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {partners.map(p => (
                                            <tr key={p.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                                <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{p.franchise_code}</td>
                                                <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{p.business_name}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{p.owner_name}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{p.mobile||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{p.city||'—'}</td>
                                                <td className="px-3 py-2.5 text-xs">{p.commission_pct}%</td>
                                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color:'#10b981' }}>{fmt(p.wallet_balance)}</td>
                                                <td className="px-3 py-2.5 text-xs">{fmt(p.credit_limit)}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-500'}`}>
                                                        {p.is_active?'Active':'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && partners.length === 0 && (
                                            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No franchise partners</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'Orders' && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <table className="w-full text-sm">
                                <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['Order#','Partner','Date','Amount','Status','Action'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{o.order_number}</td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{o.partner_name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(o.order_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{fmt(o.total_amount)}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.status==='approved'?'bg-emerald-100 text-emerald-700':o.status==='dispatched'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
                                                    {o.status?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {o.status === 'pending' && (
                                                    <button onClick={() => handleApproveOrder(o.id)} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white font-bold">Approve</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && orders.length === 0 && (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No orders</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'Settlements' && (
                        <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <table className="w-full text-sm">
                                <thead><tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                    {['Settlement#','Partner','Period From','Period To','Gross Sales','Commission','Net Payable','Date'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {settlements.map(s => (
                                        <tr key={s.id} className="border-b hover:bg-orange-50/10" style={{ borderColor:'var(--border-color)' }}>
                                            <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:ORANGE }}>{s.settlement_number}</td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{s.partner_name}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(s.period_from).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(s.period_to).toLocaleDateString('en-IN')}</td>
                                            <td className="px-3 py-2.5 text-xs">{fmt(s.gross_sales)}</td>
                                            <td className="px-3 py-2.5 text-xs">{fmt(s.commission_amount)}</td>
                                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color:ORANGE }}>{fmt(s.settlement_amount)}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {!loading && settlements.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color:'var(--text-secondary)' }}>No settlements</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {showPartnerForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Add Franchise Partner</h3>
                            <button onClick={() => setShowPartnerForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-4">
                            {[['business_name','Business Name'],['owner_name','Owner Name'],['mobile','Mobile'],['email','Email'],['city','City'],['state','State'],['commission_pct','Commission %'],['credit_limit','Credit Limit']].map(([k,l]) => (
                                <div key={k}>
                                    <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>{l}</label>
                                    <input value={partnerForm[k]} onChange={e=>setPartnerForm(f=>({...f,[k]:e.target.value}))} className={iCls} style={inp} />
                                </div>
                            ))}
                            <div className="col-span-2 flex gap-3">
                                <button onClick={() => setShowPartnerForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleCreatePartner} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Create Partner</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>Wallet Topup / Deduct</h3>
                            <button onClick={() => setShowTopup(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Partner</label>
                                <select value={topupForm.partner_id} onChange={e=>setTopupForm(f=>({...f,partner_id:e.target.value}))} className={iCls} style={inp}>
                                    <option value="">-- Select --</option>
                                    {partners.map(p => <option key={p.id} value={p.id}>{p.franchise_code} — {p.business_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Type</label>
                                <select value={topupForm.type} onChange={e=>setTopupForm(f=>({...f,type:e.target.value}))} className={iCls} style={inp}>
                                    <option value="credit">Credit (Add)</option>
                                    <option value="debit">Debit (Deduct)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Amount</label>
                                <input type="number" value={topupForm.amount} onChange={e=>setTopupForm(f=>({...f,amount:e.target.value}))} className={iCls} style={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Narration</label>
                                <input value={topupForm.narration} onChange={e=>setTopupForm(f=>({...f,narration:e.target.value}))} className={iCls} style={inp} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowTopup(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleTopup} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:ORANGE }}>Confirm</button>
                            </div>
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
