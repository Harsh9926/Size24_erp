import React from 'react';
import api from '../services/api';
import {
    History, TrendingUp, Calendar, X, Wallet,
    AlertCircle, Loader2, RefreshCw, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';

const WalletHistoryModal = ({ shopId, shopName, onClose }) => {
    const todayISO = () => new Date().toISOString().split('T')[0];
    const [walletHistory,  setWalletHistory]  = React.useState(null);
    const [loading,        setLoading]        = React.useState(false);
    const [error,          setError]          = React.useState(null);
    const [viewMode,       setViewMode]       = React.useState('history');
    const [histFilter,     setHistFilter]     = React.useState('all');
    const [customFrom,     setCustomFrom]     = React.useState('');
    const [customTo,       setCustomTo]       = React.useState('');
    const [summaryQuick,   setSummaryQuick]   = React.useState('today');
    const [summaryDate,    setSummaryDate]    = React.useState(todayISO());

    const fetchHistory = React.useCallback(async (filter, from, to) => {
        setLoading(true); setError(null);
        try {
            const params = {};
            if (filter === 'custom') {
                if (from) params.from_date = from;
                if (to)   params.to_date   = to;
            } else if (filter !== 'all') {
                params.period = filter;
            }
            const res = await api.get(`/shops/${shopId}/wallet-history`, { params });
            setWalletHistory(res.data);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to load');
        } finally { setLoading(false); }
    }, [shopId]);

    React.useEffect(() => { fetchHistory('all', '', ''); }, [fetchHistory]);

    const today        = todayISO();
    const yesterday    = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`;
    const last7start   = new Date(Date.now() - 6*86400000).toISOString().split('T')[0];

    const runSummaryQuick = (key) => {
        setSummaryQuick(key);
        if (key === 'today')     fetchHistory('custom', today, today);
        if (key === 'yesterday') fetchHistory('custom', yesterday, yesterday);
        if (key === 'last7')     fetchHistory('custom', last7start, today);
        if (key === 'month')     fetchHistory('custom', firstOfMonth, today);
        if (key === 'custom')    fetchHistory('custom', summaryDate, summaryDate);
    };

    const txns       = walletHistory?.transactions ?? [];
    const sumCredit  = txns.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
    const sumDebit   = txns.filter(t => t.amount < 0).reduce((s,t) => s + Math.abs(t.amount), 0);
    const sumOpening = walletHistory?.openingBalance ?? 0;
    const sumClosing = sumOpening + sumCredit - sumDebit;
    const fmt = (v) => Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const filterTabs = [
        { key:'all', label:'All' }, { key:'today', label:'Today' },
        { key:'yesterday', label:'Yesterday' }, { key:'last7', label:'Last 7 Days' },
        { key:'custom', label:'Custom Range' },
    ];
    const summaryTabs = [
        { key:'today', label:'Today' }, { key:'yesterday', label:'Yesterday' },
        { key:'last7', label:'Last 7 Days' }, { key:'month', label:'This Month' },
        { key:'custom', label:'Pick Date' },
    ];

    const TxnRow = ({ txn }) => {
        const isCredit = txn.amount >= 0;
        const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
        return (
            <div className="flex items-start gap-3 p-3 rounded-xl border hover:border-teal-200 transition-colors"
                style={{ background:'var(--bg-primary)', borderColor:'var(--border-color)' }}>
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-100':'bg-red-100'}`}>
                    <Icon className={`h-3.5 w-3.5 ${isCredit ? 'text-green-600':'text-red-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color:'var(--text-primary)' }}>{txn.description}</p>
                    <p className="text-[10px] mt-0.5 text-gray-400">
                        {new Date(txn.created_at).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        {txn.done_by && <span className="ml-1.5">· {txn.done_by}</span>}
                    </p>
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className={`text-xs font-bold ${isCredit ? 'text-green-600':'text-red-600'}`}>
                        {isCredit ? '+' : '−'}₹{fmt(Math.abs(txn.amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">Bal: ₹{fmt(txn.balance_after)}</p>
                </div>
            </div>
        );
    };

    const EmptyState = () => (
        <div className="text-center py-10">
            <Wallet className="h-9 w-9 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-semibold text-gray-400">No cash transactions in this period</p>
            {histFilter !== 'all' && (
                <p className="text-xs text-gray-300 mt-1">
                    Try <button onClick={() => { setHistFilter('all'); fetchHistory('all','',''); }}
                        className="underline text-teal-500 font-semibold">All</button>.
                </p>
            )}
        </div>
    );

    const ErrorState = ({ onRetry }) => (
        <div className="text-center py-10">
            <AlertCircle className="h-9 w-9 mx-auto mb-2 text-red-300" />
            <p className="text-sm font-semibold text-red-500">Failed to load history</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{error}</p>
            <button onClick={onRetry} className="mt-3 px-4 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white">Retry</button>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background:'rgba(0,0,0,0.55)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                style={{ background:'var(--bg-surface)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ background:'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-teal-100" />
                        <div>
                            <h2 className="text-sm font-bold text-white leading-tight">Wallet Ledger</h2>
                            <p className="text-[11px] text-teal-200">{shopName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {walletHistory && (
                            <span className="text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full">
                                Balance: ₹{fmt(walletHistory.currentBalance)}
                            </span>
                        )}
                        <button onClick={onClose} className="text-teal-100 hover:text-white"><X className="h-5 w-5" /></button>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex border-b flex-shrink-0" style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                    {[{ key:'history', label:'Transaction History', Icon:History }, { key:'summary', label:'Day Summary', Icon:TrendingUp }].map(({ key, label, Icon }) => (
                        <button key={key}
                            onClick={() => {
                                setViewMode(key);
                                if (key === 'history') fetchHistory(histFilter, customFrom, customTo);
                                if (key === 'summary') runSummaryQuick(summaryQuick);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${viewMode === key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                            style={{ background:'transparent' }}>
                            <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                    ))}
                </div>

                {/* History Mode */}
                {viewMode === 'history' && (<>
                    <div className="px-6 py-3 border-b flex-shrink-0 flex flex-wrap items-center gap-2"
                        style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                        {filterTabs.map(({ key, label }) => (
                            <button key={key}
                                onClick={() => { setHistFilter(key); if (key !== 'custom') fetchHistory(key, customFrom, customTo); }}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${histFilter === key ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-200 hover:border-teal-400'}`}
                                style={histFilter !== key ? { background:'var(--bg-primary)' } : {}}>
                                {label}
                            </button>
                        ))}
                        {histFilter === 'custom' && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                    className="px-2 py-1 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500"
                                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)', color:'var(--text-primary)' }} />
                                <span className="text-xs text-gray-400">to</span>
                                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                    className="px-2 py-1 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500"
                                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)', color:'var(--text-primary)' }} />
                                <button onClick={() => fetchHistory('custom', customFrom, customTo)}
                                    className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-600 text-white border border-teal-600">Apply</button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>
                        : error   ? <ErrorState onRetry={() => fetchHistory(histFilter, customFrom, customTo)} />
                        : txns.length === 0 ? <EmptyState />
                        : <div className="space-y-2">{txns.map((txn, i) => <TxnRow key={txn.ref_id + i} txn={txn} />)}</div>}
                    </div>
                    {txns.length > 0 && (
                        <div className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between"
                            style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                            <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{txns.length} of {walletHistory.totalCount} transactions</p>
                            <button onClick={() => fetchHistory(histFilter, customFrom, customTo)}
                                className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700">
                                <RefreshCw className="h-3 w-3" />Refresh
                            </button>
                        </div>
                    )}
                </>)}

                {/* Summary Mode */}
                {viewMode === 'summary' && (<>
                    <div className="px-6 py-3 border-b flex-shrink-0 flex flex-wrap items-center gap-2"
                        style={{ borderColor:'var(--border-color)', background:'var(--bg-surface)' }}>
                        {summaryTabs.map(({ key, label }) => (
                            <button key={key} onClick={() => runSummaryQuick(key)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${summaryQuick === key ? 'bg-teal-600 text-white border-teal-600' : 'text-gray-600 border-gray-200 hover:border-teal-400'}`}
                                style={summaryQuick !== key ? { background:'var(--bg-primary)' } : {}}>
                                {label}
                            </button>
                        ))}
                        {summaryQuick === 'custom' && (
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                <input type="date" value={summaryDate} max={today}
                                    onChange={e => { setSummaryDate(e.target.value); fetchHistory('custom', e.target.value, e.target.value); }}
                                    className="px-2 py-1 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-teal-500"
                                    style={{ background:'var(--bg-surface)', borderColor:'var(--border-color)', color:'var(--text-primary)' }} />
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 border-b flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3"
                        style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                        {loading ? <div className="col-span-4 flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-teal-500" /></div>
                        : error   ? <div className="col-span-4 text-center py-3"><p className="text-sm text-red-500">{error}</p><button onClick={() => runSummaryQuick(summaryQuick)} className="mt-2 px-3 py-1 text-xs font-semibold rounded-lg bg-teal-600 text-white">Retry</button></div>
                        : (<>
                            {[
                                { label:'Opening Balance', value:sumOpening, color:'text-gray-700', bg:'bg-gray-50', border:'border-gray-200', prefix:'' },
                                { label:'Total Credit',    value:sumCredit,  color:'text-green-700', bg:'bg-green-50', border:'border-green-200', prefix:'+' },
                                { label:'Total Debit',     value:sumDebit,   color:'text-red-700', bg:'bg-red-50', border:'border-red-200', prefix:'−' },
                                { label:'Closing Balance', value:sumClosing, color:sumClosing >= 0 ? 'text-teal-700':'text-red-700', bg:sumClosing >= 0 ? 'bg-teal-50':'bg-red-50', border:sumClosing >= 0 ? 'border-teal-200':'border-red-200', prefix:'' },
                            ].map(({ label, value, color, bg, border, prefix }) => (
                                <div key={label} className={`rounded-xl p-3 border ${bg} ${border}`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
                                    <p className={`text-base font-extrabold ${color}`}>{prefix}₹{fmt(value)}</p>
                                </div>
                            ))}
                        </>)}
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {!loading && !error && txns.length === 0 && (
                            <div className="text-center py-10">
                                <Wallet className="h-9 w-9 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm font-semibold text-gray-400">No cash transactions in this period</p>
                                <p className="text-xs text-gray-300 mt-1">Opening = Closing = ₹{fmt(sumOpening)}</p>
                            </div>
                        )}
                        {!loading && !error && txns.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color:'var(--text-secondary)' }}>
                                    {txns.length} transaction{txns.length !== 1 ? 's':''}
                                </p>
                                {txns.map((txn, i) => <TxnRow key={txn.ref_id + i} txn={txn} />)}
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between"
                        style={{ borderColor:'var(--border-color)', background:'var(--bg-primary)' }}>
                        <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
                            {summaryQuick === 'custom' ? summaryDate : summaryTabs.find(t => t.key === summaryQuick)?.label}
                            {walletHistory ? ` · ${walletHistory.totalCount} total transactions` : ''}
                        </p>
                        <button onClick={() => runSummaryQuick(summaryQuick)} className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700">
                            <RefreshCw className="h-3 w-3" />Refresh
                        </button>
                    </div>
                </>)}
            </div>
        </div>
    );
};

export default WalletHistoryModal;
