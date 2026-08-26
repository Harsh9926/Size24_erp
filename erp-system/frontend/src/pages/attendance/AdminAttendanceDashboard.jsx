import React, { useEffect, useState, useCallback, useContext } from 'react';
import Layout from '../../components/Layout';
import {
    Users, UserCheck, UserX, Clock, Timer, Loader2, Play, CheckSquare,
    TrendingDown, TrendingUp, ClipboardCheck, MapPin, RefreshCw, Search, Eye, X,
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../services/socket';
import {
    mediaUrl, fmtTime, PUNCH_IN_STATUS, PUNCH_OUT_STATUS, ATT_STATUS, DAY_STATUS_OPTIONS,
} from '../../components/attendance/attendanceUtils';
import LocationMap from '../../components/attendance/LocationMap';

const todayISO = () => new Date().toISOString().slice(0, 10);

const Card = ({ icon: Icon, label, value, color }) => (
    <div className="rounded-xl border p-4 flex items-center gap-3"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '1a' }}>
            <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        </div>
    </div>
);

const Badge = ({ map, value }) => {
    const cfg = value && map[value];
    if (!cfg) return <span className="text-gray-400">—</span>;
    return <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${cfg.cls}`}>{cfg.label}</span>;
};

export default function AdminAttendanceDashboard() {
    const { user } = useContext(AuthContext);
    const [date, setDate]     = useState(todayISO());
    const [cards, setCards]   = useState(null);
    const [rows, setRows]     = useState([]);
    const [shops, setShops]   = useState([]);
    const [shopId, setShopId] = useState('');
    const [status, setStatus] = useState('');
    const [q, setQ]           = useState('');
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState(null);

    const loadCards = useCallback(async () => {
        try { const r = await api.get('/attendance/dashboard', { params: { date } }); setCards(r.data); } catch {}
    }, [date]);

    const loadTable = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/attendance/table', { params: { date, shop_id: shopId || undefined, status: status || undefined, q: q || undefined } });
            setRows(r.data);
        } catch {} finally { setLoading(false); }
    }, [date, shopId, status, q]);

    useEffect(() => { api.get('/attendance/shops').then(r => setShops(r.data)).catch(() => {}); }, []);
    useEffect(() => { loadCards(); }, [loadCards]);
    useEffect(() => { const t = setTimeout(loadTable, 250); return () => clearTimeout(t); }, [loadTable]);

    // Real-time refresh
    useEffect(() => {
        if (!socket.connected) socket.connect();
        const refresh = () => { loadCards(); loadTable(); };
        socket.on('attendance:update', refresh);
        socket.on('attendance:registration', loadCards);
        return () => { socket.off('attendance:update', refresh); socket.off('attendance:registration', loadCards); };
    }, [loadCards, loadTable]);

    const openDetail = async (id) => {
        try { const r = await api.get(`/attendance/detail/${id}`); setDetail(r.data); } catch {}
    };

    const setDayStatus = async (userId, newStatus) => {
        if (!newStatus) return;
        try {
            await api.put('/attendance/day-status', { user_id: userId, date, status: newStatus });
            loadCards(); loadTable();
        } catch (e) { alert(e.response?.data?.error || 'Failed to set status'); }
    };

    return (
        <Layout title={user?.role === 'manager' ? 'Shop Attendance' : 'Attendance Dashboard'}>
            <div className="p-4 sm:p-6 space-y-5">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <select value={shopId} onChange={e => setShopId(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Shops</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                    </select>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Status</option>
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="half_day">Half Day</option>
                        <option value="week_off">Week Off</option>
                        <option value="paid_leave">Paid Leave</option>
                        <option value="unpaid_leave">Unpaid Leave</option>
                        <option value="holiday">Holiday</option>
                        <option value="absent">Absent</option>
                    </select>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search employee…"
                            className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    </div>
                    <button onClick={() => { loadCards(); loadTable(); }} className="p-2 text-teal-700 hover:text-teal-800"><RefreshCw className="h-4 w-4" /></button>
                </div>

                {/* Cards */}
                {cards && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <Card icon={Users}         label="Total Employees" value={cards.total_employees} color="#0f766e" />
                        <Card icon={UserCheck}     label="Present Today"   value={cards.present_today}   color="#16a34a" />
                        <Card icon={UserX}         label="Absent Today"    value={cards.absent_today}    color="#dc2626" />
                        <Card icon={Clock}         label="Late"            value={cards.late}            color="#d97706" />
                        <Card icon={Timer}         label="Half Day"        value={cards.half_day}        color="#ea580c" />
                        <Card icon={Play}          label="Working"         value={cards.working}         color="#2563eb" />
                        <Card icon={CheckSquare}   label="Completed Shift" value={cards.completed_shift} color="#0891b2" />
                        <Card icon={TrendingDown}  label="Early Exit"      value={cards.early_exit}      color="#d97706" />
                        <Card icon={TrendingUp}    label="Overtime"        value={cards.overtime}        color="#4f46e5" />
                        <Card icon={ClipboardCheck} label="Pending Reg."   value={cards.pending_registration} color="#9333ea" />
                        <Card icon={MapPin}        label="Loc. Changes"    value={cards.pending_location_change} color="#db2777" />
                    </div>
                )}

                {/* Table */}
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left" style={{ background: 'var(--bg-primary)' }}>
                                    {['Employee', 'Role', 'Shop', 'Punch In', 'Punch Out', 'Hours', 'Status', 'In', 'Out', 'Dist.', 'Selfies', 'Set Day', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-400">No attendance records for this day.</td></tr>
                                ) : rows.map(r => (
                                    <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name || r.mobile}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap capitalize text-gray-500">{(r.role || '').replace('_', ' ')}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.shop_name || '—'}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">{fmtTime(r.punch_in_at)}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">{fmtTime(r.punch_out_at)}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap font-mono">{r.working_hours ? `${r.working_hours}h` : '—'}</td>
                                        <td className="px-3 py-2.5"><Badge map={ATT_STATUS} value={r.attendance_status} /></td>
                                        <td className="px-3 py-2.5"><Badge map={PUNCH_IN_STATUS} value={r.punch_in_status} /></td>
                                        <td className="px-3 py-2.5"><Badge map={PUNCH_OUT_STATUS} value={r.punch_out_status} /></td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.punch_in_distance_m != null ? `${Math.round(r.punch_in_distance_m)}m` : '—'}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex gap-1">
                                                {r.punch_in_selfie_url && <img src={mediaUrl(r.punch_in_selfie_url)} alt="in" className="h-8 w-8 rounded object-cover border" />}
                                                {r.punch_out_selfie_url && <img src={mediaUrl(r.punch_out_selfie_url)} alt="out" className="h-8 w-8 rounded object-cover border" />}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <select value="" onChange={e => setDayStatus(r.user_id, e.target.value)}
                                                className="px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-teal-700"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                                <option value="">Set…</option>
                                                {DAY_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <button onClick={() => openDetail(r.id)} className="text-teal-700 hover:text-teal-800"><Eye className="h-4 w-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
        </Layout>
    );
}

/* ── Attendance Detail Modal ─────────────────────────────────────── */
function DetailModal({ detail: d, onClose }) {
    const Row = ({ k, v }) => (
        <div className="flex justify-between py-1.5 border-b text-xs" style={{ borderColor: 'var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
            <span className="font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{v ?? '—'}</span>
        </div>
    );
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{d.name} · {new Date(d.date).toLocaleDateString('en-IN')}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200" style={{ color: 'var(--text-secondary)' }}><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-xs font-bold uppercase mb-2 text-teal-700">Punch In</p>
                        {d.punch_in_selfie_url && <img src={mediaUrl(d.punch_in_selfie_url)} alt="in" className="w-full max-w-[160px] rounded-lg border mb-2" />}
                        <Row k="Time" v={fmtTime(d.punch_in_at)} />
                        <Row k="Status" v={d.punch_in_status} />
                        <Row k="Distance" v={d.punch_in_distance_m != null ? `${Math.round(d.punch_in_distance_m)} m` : '—'} />
                        <Row k="Accuracy" v={d.punch_in_accuracy_m != null ? `±${Math.round(d.punch_in_accuracy_m)} m` : '—'} />
                        <Row k="Browser" v={d.punch_in_browser} />
                        <Row k="Device" v={d.punch_in_device} />
                        <Row k="IP" v={d.punch_in_ip} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase mb-2 text-teal-700">Punch Out</p>
                        {d.punch_out_selfie_url && <img src={mediaUrl(d.punch_out_selfie_url)} alt="out" className="w-full max-w-[160px] rounded-lg border mb-2" />}
                        <Row k="Time" v={fmtTime(d.punch_out_at)} />
                        <Row k="Status" v={d.punch_out_status} />
                        <Row k="Distance" v={d.punch_out_distance_m != null ? `${Math.round(d.punch_out_distance_m)} m` : '—'} />
                        <Row k="Working Hours" v={d.working_hours ? `${d.working_hours} h` : '—'} />
                        <Row k="Browser" v={d.punch_out_browser} />
                        <Row k="IP" v={d.punch_out_ip} />
                    </div>
                    {Array.isArray(d.sessions) && d.sessions.length > 1 && (
                        <div className="md:col-span-2">
                            <p className="text-xs font-bold uppercase mb-2 text-teal-700">All Sessions ({d.sessions.length})</p>
                            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                                {d.sessions.map(s => (
                                    <div key={s.id} className="flex items-center justify-between px-3 py-1.5 border-b text-xs" style={{ borderColor: 'var(--border-color)' }}>
                                        <span className="font-mono text-gray-400">#{s.seq}</span>
                                        <span>In {fmtTime(s.punch_in_at)}</span>
                                        <span>Out {s.punch_out_at ? fmtTime(s.punch_out_at) : 'Open'}</span>
                                        <span className="font-mono font-bold text-teal-700">{s.working_hours ? `${s.working_hours}h` : '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="md:col-span-2">
                        <p className="text-xs font-bold uppercase mb-2 text-teal-700">Today's Punch-In Location</p>
                        <LocationMap lat={d.punch_in_lat} lng={d.punch_in_lng} />
                    </div>
                    {d.registered_lat && (
                        <div className="md:col-span-2">
                            <p className="text-xs font-bold uppercase mb-2 text-teal-700">Registered Office Location · radius {d.allowed_radius_m}m</p>
                            <LocationMap lat={d.registered_lat} lng={d.registered_lng} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
