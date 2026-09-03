import React, { useCallback, useEffect, useState } from 'react';
import {
    Users, UserCheck, UserX, CalendarDays, Plane, Clock, Radio,
    LogIn, LogOut, RefreshCw, Smartphone, Store, Circle,
} from 'lucide-react';
import api from '../../services/api';
import socket from '../../services/socket';
import { fmtTime, ATT_STATUS } from './attendanceUtils';

const todayISO = () => new Date().toISOString().slice(0, 10);

const Stat = ({ icon: Icon, label, value, color }) => (
    <div className="rounded-xl border p-3 flex items-center gap-3"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '1a' }}>
            <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-xl font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
        </div>
    </div>
);

// Most recent punch time on a row (last-out if present, else first-in).
const lastPunch = (r) => r.punch_out_at || r.punch_in_at;

export default function LiveAttendanceToday() {
    const [cards, setCards] = useState(null);
    const [shopCards, setShopCards] = useState([]);
    const [rows, setRows] = useState([]);
    const [activity, setActivity] = useState([]);
    const [live, setLive] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [c, t, a, s] = await Promise.all([
                api.get('/attendance/dashboard', { params: { date: todayISO() } }),
                api.get('/attendance/table', { params: { date: todayISO() } }),
                api.get('/attendance/recent-activity', { params: { limit: 12 } }),
                api.get('/attendance/shop-summary', { params: { date: todayISO() } }),
            ]);
            setCards(c.data); setRows(t.data || []); setActivity(a.data || []);
            setShopCards(s.data?.shops || []);
        } catch { /* endpoints may be unavailable for this role */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Real-time refresh on any punch/day-status update.
    useEffect(() => {
        if (!socket.connected) socket.connect();
        const onConn = () => setLive(true);
        const onDisc = () => setLive(false);
        setLive(socket.connected);
        socket.on('connect', onConn);
        socket.on('disconnect', onDisc);
        socket.on('attendance:update', load);
        socket.on('attendance:registration', load);
        return () => {
            socket.off('connect', onConn); socket.off('disconnect', onDisc);
            socket.off('attendance:update', load); socket.off('attendance:registration', load);
        };
    }, [load]);

    // Present/online first, then by most recent punch.
    const sorted = [...rows].sort((a, b) => {
        const ao = a.punch_in_at && !a.punch_out_at ? 1 : 0;
        const bo = b.punch_in_at && !b.punch_out_at ? 1 : 0;
        if (ao !== bo) return bo - ao;
        return new Date(lastPunch(b) || 0) - new Date(lastPunch(a) || 0);
    });

    const c = cards || {};

    return (
        <div className="mb-6 rounded-xl border shadow-sm overflow-hidden"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            {/* Header */}
            <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3 flex-wrap"
                style={{ borderColor: 'var(--border-color)', background: 'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
                <div className="flex items-center gap-2">
                    <Radio className={`h-4 w-4 text-white ${live ? 'animate-pulse' : ''}`} />
                    <h3 className="text-sm font-bold text-white">Live Attendance Today</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${live ? 'bg-white/25 text-white' : 'bg-white/10 text-teal-50'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`} />
                        {live ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[11px] text-teal-50 font-semibold">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <button onClick={load} className="text-white/90 hover:text-white" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat icon={Users}        label="Total Employees" value={c.total_employees ?? 0} color="#0f766e" />
                <Stat icon={UserCheck}    label="Present"         value={c.present_today ?? 0}   color="#16a34a" />
                <Stat icon={UserX}        label="Absent"          value={c.absent_today ?? 0}    color="#dc2626" />
                <Stat icon={CalendarDays} label="Week Off"        value={c.week_off ?? 0}        color="#0284c7" />
                <Stat icon={Plane}        label="On Leave"        value={c.on_leave ?? 0}        color="#7c3aed" />
                <Stat icon={Clock}        label="Late"            value={c.late ?? 0}            color="#d97706" />
            </div>

            {/* Shop-wise Attendance */}
            {shopCards.length > 0 && (
                <div className="px-4 pb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <Store className="h-3.5 w-3.5" /> Shop-wise Attendance
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {shopCards.map(s => (
                            <div key={s.shop_id} className="rounded-lg border p-2.5"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                <p className="text-xs font-bold truncate mb-1" style={{ color: 'var(--text-primary)' }}>{s.shop_name}</p>
                                <p className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                    Total: <b style={{ color: 'var(--text-primary)' }}>{s.total}</b>{' '}
                                    <span className="text-green-600">| Present: <b>{s.present}</b></span>{' '}
                                    <span className="text-red-600">| Absent: <b>{s.absent}</b></span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-0 xl:gap-4 px-4 pb-4">
                {/* Live table */}
                <div className="xl:col-span-2 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                        Employees · Today
                    </div>
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0" style={{ background: 'var(--bg-primary)' }}>
                                <tr>
                                    {['Employee', 'Shop', 'Punch In', 'Last Punch', 'Status'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 text-xs">No attendance yet today.</td></tr>
                                ) : sorted.map(r => {
                                    const online = r.punch_in_at && !r.punch_out_at;
                                    const st = ATT_STATUS[r.attendance_status];
                                    return (
                                        <tr key={r.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Circle className={`h-2 w-2 ${online ? 'fill-green-500 text-green-500' : 'fill-gray-300 text-gray-300'}`} />
                                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name || r.mobile}</span>
                                                    {online && <span className="text-[9px] font-bold text-green-600 bg-green-50 border border-green-200 px-1 rounded">ONLINE</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">{r.shop_name || '—'}</td>
                                            <td className="px-3 py-2 whitespace-nowrap font-mono text-teal-700 font-semibold">{fmtTime(r.punch_in_at)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap font-mono">{fmtTime(lastPunch(r))}</td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {online
                                                    ? <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded border bg-green-100 text-green-700 border-green-200">Present</span>
                                                    : st
                                                        ? <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${st.cls}`}>{st.label}</span>
                                                        : r.punch_in_at
                                                            ? <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded border bg-gray-100 text-gray-600 border-gray-200">Completed</span>
                                                            : <span className="text-gray-400">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent punch activity */}
                <div className="mt-4 xl:mt-0 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                        Recent Punch Activity
                    </div>
                    <div className="divide-y max-h-[360px] overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
                        {activity.length === 0 ? (
                            <p className="px-3 py-8 text-center text-xs text-gray-400">No punches yet.</p>
                        ) : activity.map((e, i) => (
                            <div key={`${e.session_id}-${e.kind}-${i}`} className="px-3 py-2 flex items-start gap-2">
                                <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${e.kind === 'IN' ? 'bg-green-100' : 'bg-amber-100'}`}>
                                    {e.kind === 'IN' ? <LogIn className="h-3.5 w-3.5 text-green-700" /> : <LogOut className="h-3.5 w-3.5 text-amber-700" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                        {e.name} <span className={`font-bold ${e.kind === 'IN' ? 'text-green-600' : 'text-amber-600'}`}>· Punch {e.kind === 'IN' ? 'In' : 'Out'}</span>
                                    </p>
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                                        {e.shop_name && <span className="flex items-center gap-0.5"><Store className="h-2.5 w-2.5" />{e.shop_name}</span>}
                                        {e.device && <span className="flex items-center gap-0.5"><Smartphone className="h-2.5 w-2.5" />{e.device}</span>}
                                    </p>
                                </div>
                                <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap mt-0.5">{fmtTime(e.ts)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
