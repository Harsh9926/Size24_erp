import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users, Search, RefreshCw, ChevronDown, CreditCard, TrendingDown,
    TrendingUp, Clock, Wallet, AlertCircle, CheckCircle2, Plus, X, Edit2,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../services/api';

const ORANGE = '#FF6B00';
const fmt    = (v) => `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
const inp    = { background:'var(--bg-primary)', borderColor:'var(--border-color)', color:'var(--text-primary)' };
const iCls   = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 transition';

function StatCard({ icon: Icon, label, value, color = ORANGE, sub, badge }) {
    return (
        <div className="rounded-2xl border p-4 flex items-start gap-3" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
            <div className="rounded-xl p-2.5" style={{ background:`${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{label}</p>
                <p className="text-xl font-extrabold mt-0.5 truncate" style={{ color:'var(--text-primary)' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>{sub}</p>}
            </div>
            {badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.err ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{badge.text}</span>
            )}
        </div>
    );
}

export default function CustomerLedgerPage() {
    const [sidebarOpen, setSidebarOpen]   = useState(false);
    const [custSearch, setCustSearch]     = useState('');
    const [custResults, setCustResults]   = useState([]);
    const [custLoading, setCustLoading]   = useState(false);
    const [showDrop, setShowDrop]         = useState(false);
    const [customer, setCustomer]         = useState(null);
    const [ledger, setLedger]             = useState([]);
    const [advances, setAdvances]         = useState([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [toast, setToast]               = useState(null);

    // Credit limit edit
    const [showCreditForm, setShowCreditForm] = useState(false);
    const [creditForm, setCreditForm]         = useState({ credit_limit:'', credit_days:'' });
    const [savingCredit, setSavingCredit]     = useState(false);

    // New advance
    const [showAdvForm, setShowAdvForm] = useState(false);
    const [advForm, setAdvForm]         = useState({ amount:'', payment_mode:'cash', notes:'' });
    const [savingAdv, setSavingAdv]     = useState(false);

    const debounceRef = useRef();

    const showMsg = (msg, type='success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!custSearch.trim()) { setCustResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setCustLoading(true);
            try {
                const r = await api.get('/pos/search-customers', { params:{ q: custSearch } });
                setCustResults(r.data); setShowDrop(true);
            } catch {} finally { setCustLoading(false); }
        }, 200);
    }, [custSearch]);

    const loadCustomer = useCallback(async (id) => {
        setLedgerLoading(true);
        try {
            const [ledR, advR] = await Promise.all([
                api.get(`/pos2/ledger/${id}`),
                api.get(`/pos2/advances/${id}`),
            ]);
            setLedger(ledR.data);
            setAdvances(advR.data);
        } catch {} finally { setLedgerLoading(false); }
    }, []);

    const selectCustomer = async (c) => {
        setCustSearch(c.name); setCustResults([]); setShowDrop(false);
        const r = await api.get(`/pos/customers/${c.id}`);
        setCustomer(r.data);
        loadCustomer(c.id);
        setCreditForm({ credit_limit: r.data.credit_limit || '0', credit_days: r.data.credit_days || '30' });
    };

    const handleSaveCredit = async () => {
        if (!customer) return;
        setSavingCredit(true);
        try {
            await api.put(`/pos2/credit-limit/${customer.id}`, creditForm);
            setCustomer(c => ({ ...c, ...creditForm }));
            setShowCreditForm(false);
            showMsg('Credit limit updated');
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSavingCredit(false); }
    };

    const handleAddAdvance = async () => {
        if (!customer || !advForm.amount) return;
        setSavingAdv(true);
        try {
            await api.post('/pos2/advances', { customer_id: customer.id, ...advForm });
            setShowAdvForm(false);
            setAdvForm({ amount:'', payment_mode:'cash', notes:'' });
            showMsg('Advance recorded');
            loadCustomer(customer.id);
        } catch (e) { showMsg(e.response?.data?.error || 'Failed', 'error'); }
        finally { setSavingAdv(false); }
    };

    const outstanding = customer ? parseFloat(customer.current_balance || 0) : 0;
    const creditLimit = customer ? parseFloat(customer.credit_limit || 0) : 0;
    const creditUsedPct = creditLimit > 0 ? Math.min(100, (outstanding / creditLimit) * 100) : 0;
    const creditOk = creditLimit === 0 || outstanding <= creditLimit;

    return (
        <div className="flex h-screen overflow-hidden" style={{ background:'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            <div className="flex-1 flex flex-col min-w-0 md:ml-64">
                {/* Header */}
                <header className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                    <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <Users className="h-5 w-5" style={{ color:ORANGE }} />
                    <h1 className="text-base font-bold flex-1" style={{ color:'var(--text-primary)' }}>Customer Ledger</h1>
                    {customer && (
                        <button onClick={() => loadCustomer(customer.id)} className="p-2 rounded-lg hover:bg-gray-100">
                            <RefreshCw className={`h-4 w-4 ${ledgerLoading ? 'animate-spin' : ''}`} style={{ color:'var(--text-secondary)' }} />
                        </button>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {/* Customer Search */}
                    <div className="rounded-2xl border p-4" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                        <div className="relative">
                            <input value={custSearch} onChange={e => setCustSearch(e.target.value)} onFocus={() => custResults.length && setShowDrop(true)}
                                placeholder="Search customer by name or mobile…"
                                className={iCls + ' pl-10'} style={inp} autoFocus />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            {custLoading && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                            {showDrop && custResults.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 border rounded-xl shadow-2xl z-30 overflow-hidden max-h-64 overflow-y-auto"
                                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    {custResults.map(c => (
                                        <button key={c.id} onClick={() => selectCustomer(c)}
                                            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-orange-50/20 border-b"
                                            style={{ borderColor:'var(--border-color)' }}>
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                                style={{ background:ORANGE }}>{c.name?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{c.name}</p>
                                                <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{c.mobile}</p>
                                            </div>
                                            {parseFloat(c.current_balance||0) > 0 && (
                                                <span className="ml-auto text-xs font-bold text-red-600">Due: {fmt(c.current_balance)}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {customer && (
                        <>
                            {/* Customer Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard icon={TrendingDown} label="Outstanding" value={fmt(outstanding)} color={outstanding > 0 ? '#ef4444' : '#10b981'}
                                    badge={outstanding > 0 ? { text:'DUE', err:true } : { text:'CLEAR', err:false }} />
                                <StatCard icon={CreditCard}   label="Credit Limit" value={creditLimit > 0 ? fmt(creditLimit) : 'None'} color="#6366f1"
                                    sub={creditLimit > 0 ? `${creditUsedPct.toFixed(0)}% used` : 'No limit set'}
                                    badge={!creditOk ? { text:'EXCEEDED', err:true } : null} />
                                <StatCard icon={Wallet}        label="Total Advances" value={fmt(advances.reduce((s,a)=>s+parseFloat(a.balance||0),0))} color="#f59e0b"
                                    sub={`${advances.length} pending`} />
                                <StatCard icon={TrendingUp}    label="Loyalty Points" value={customer.loyalty_points || 0} color="#8b5cf6" sub="points earned" />
                            </div>

                            {/* Credit limit bar */}
                            {creditLimit > 0 && (
                                <div className="rounded-2xl border p-4" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold" style={{ color:'var(--text-secondary)' }}>Credit Utilization</p>
                                        <button onClick={() => setShowCreditForm(true)} className="flex items-center gap-1 text-xs font-semibold" style={{ color:ORANGE }}>
                                            <Edit2 className="h-3 w-3" /> Edit
                                        </button>
                                    </div>
                                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background:'var(--bg-primary)' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width:`${creditUsedPct}%`, background: creditOk ? '#10b981' : '#ef4444' }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] mt-1" style={{ color:'var(--text-secondary)' }}>
                                        <span>Used: {fmt(outstanding)}</span>
                                        <span>Limit: {fmt(creditLimit)}</span>
                                    </div>
                                </div>
                            )}

                            {!creditLimit && (
                                <button onClick={() => setShowCreditForm(true)} className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border" style={{ borderColor:'var(--border-color)', color:ORANGE, background:'var(--bg-surface)' }}>
                                    <CreditCard className="h-4 w-4" /> Set Credit Limit
                                </button>
                            )}

                            {/* Actions row */}
                            <div className="flex gap-2">
                                <button onClick={() => setShowAdvForm(true)} className="flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl text-white" style={{ background:'#6366f1' }}>
                                    <Plus className="h-4 w-4" /> Record Advance
                                </button>
                            </div>

                            {/* Advances */}
                            {advances.length > 0 && (
                                <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                    <div className="px-5 py-3 border-b" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Pending Advances</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                                    {['ID','Date','Amount Received','Balance Left','Mode','Notes'].map(h => (
                                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {advances.map(adv => (
                                                    <tr key={adv.id} className="border-b" style={{ borderColor:'var(--border-color)' }}>
                                                        <td className="px-3 py-2.5 text-xs font-mono font-bold" style={{ color:'#6366f1' }}>#{adv.id}</td>
                                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{new Date(adv.received_date).toLocaleDateString('en-IN')}</td>
                                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color:'var(--text-primary)' }}>{fmt(adv.amount)}</td>
                                                        <td className="px-3 py-2.5 text-xs font-bold text-emerald-600">{fmt(adv.balance)}</td>
                                                        <td className="px-3 py-2.5 text-xs capitalize" style={{ color:'var(--text-secondary)' }}>{adv.payment_mode}</td>
                                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{adv.notes || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Ledger Transactions */}
                            <div className="rounded-2xl border overflow-hidden" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                                <div className="px-5 py-3 border-b" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color:'var(--text-secondary)' }}>Transaction Ledger</p>
                                </div>
                                {ledgerLoading ? (
                                    <div className="p-6 space-y-2">{[1,2,3,4,5].map(i=><div key={i} className="h-10 rounded-xl animate-pulse" style={{ background:'var(--bg-primary)' }} />)}</div>
                                ) : ledger.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border-color)' }}>
                                                    {['Date','Invoice','Type','Debit (Charged)','Credit (Paid/Advance)','Balance','Notes'].map(h => (
                                                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ledger.map((row, i) => (
                                                    <tr key={i} className="border-b hover:bg-orange-50/10 transition-colors" style={{ borderColor:'var(--border-color)' }}>
                                                        <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color:'var(--text-secondary)' }}>
                                                            {new Date(row.transaction_date || row.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs font-mono" style={{ color:ORANGE }}>{row.invoice_number || '—'}</td>
                                                        <td className="px-3 py-2.5">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${row.type==='debit'?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'}`}>
                                                                {row.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color: row.type==='debit' ? '#ef4444' : 'var(--text-secondary)' }}>
                                                            {row.type==='debit' ? fmt(row.amount) : '—'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color: row.type==='credit' ? '#10b981' : 'var(--text-secondary)' }}>
                                                            {row.type==='credit' ? fmt(row.amount) : '—'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs font-bold" style={{ color: parseFloat(row.balance||0) > 0 ? '#ef4444' : '#10b981' }}>
                                                            {fmt(row.balance)}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-xs" style={{ color:'var(--text-secondary)' }}>{row.notes || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        <p className="text-sm" style={{ color:'var(--text-secondary)' }}>No ledger entries for this customer</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {!customer && (
                        <div className="rounded-2xl border p-12 text-center" style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)' }}>
                            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color:'var(--text-secondary)' }} />
                            <p className="text-sm font-semibold" style={{ color:'var(--text-secondary)' }}>Search for a customer to view their ledger</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Credit Limit Modal */}
            {showCreditForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
                                <CreditCard className="h-4 w-4" style={{ color:'#6366f1' }} /> Credit Limit
                            </h3>
                            <button onClick={() => setShowCreditForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Credit Limit (₹)</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={creditForm.credit_limit} onChange={e => setCreditForm(f=>({...f,credit_limit:e.target.value}))} autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Credit Days</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={creditForm.credit_days} onChange={e => setCreditForm(f=>({...f,credit_days:e.target.value}))} placeholder="30" />
                                <p className="text-[10px] mt-1" style={{ color:'var(--text-secondary)' }}>Number of days before payment is due</p>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowCreditForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleSaveCredit} disabled={savingCredit} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white" style={{ background:'#6366f1' }}>
                                    {savingCredit ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Advance Modal */}
            {showAdvForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background:'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                            <h3 className="font-bold text-sm flex items-center gap-2" style={{ color:'var(--text-primary)' }}>
                                <Wallet className="h-4 w-4 text-indigo-500" /> Record Advance Payment
                            </h3>
                            <button onClick={() => setShowAdvForm(false)}><X className="h-5 w-5" style={{ color:'var(--text-secondary)' }} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Amount (₹)</label>
                                <input type="number" min="0" className={iCls} style={inp}
                                    value={advForm.amount} onChange={e => setAdvForm(f=>({...f,amount:e.target.value}))} autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Payment Mode</label>
                                <select className={iCls} style={inp} value={advForm.payment_mode} onChange={e => setAdvForm(f=>({...f,payment_mode:e.target.value}))}>
                                    {['cash','upi','card','bank','wallet'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--text-secondary)' }}>Notes</label>
                                <input className={iCls} style={inp} value={advForm.notes} onChange={e => setAdvForm(f=>({...f,notes:e.target.value}))} placeholder="Optional…" />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setShowAdvForm(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)', color:'var(--text-primary)' }}>Cancel</button>
                                <button onClick={handleAddAdvance} disabled={savingAdv || !advForm.amount} className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white disabled:opacity-60" style={{ background:'#6366f1' }}>
                                    {savingAdv ? 'Saving…' : 'Record Advance'}
                                </button>
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
