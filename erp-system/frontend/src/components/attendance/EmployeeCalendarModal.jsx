import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import api from '../../services/api';
import { DAY_STATUS_OPTIONS, ATT_STATUS, fmtTime } from './attendanceUtils';

/* ── Admin: month calendar for one employee — shows every day's status
   (present/absent/week off/…), click a day to edit it. Saves via the same
   day-status endpoint the bulk grid uses, so payroll/salary recompute from
   the same attendance rows immediately. Shared by Attendance Reports and
   the HR & Payroll page's month-wise Attendance tab. ────────────────── */
export default function EmployeeCalendarModal({ userId, name, month, onClose, onSaved }) {
    const [cal, setCal] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editDay, setEditDay] = useState(null); // date string being edited
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get(`/attendance/user-month/${userId}`, { params: { month } });
            setCal(r.data);
        } catch {} finally { setLoading(false); }
    }, [userId, month]);
    useEffect(() => { load(); }, [load]);

    const setStatus = async (date, status) => {
        setSaving(true);
        try {
            await api.put('/attendance/day-status', { user_id: userId, date, status });
            setEditDay(null);
            await load();
            onSaved();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to save');
        } finally { setSaving(false); }
    };

    const days = cal?.calendar || [];
    const leadBlanks = days.length ? days[0].weekday : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{name} · {month}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200" style={{ color: 'var(--text-secondary)' }}><X className="h-5 w-5" /></button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {loading || !cal ? (
                        <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-3 mb-3 text-xs">
                                {Object.entries(ATT_STATUS).map(([k, v]) => (
                                    <span key={k} className={`px-2 py-0.5 rounded-full border ${v.cls}`}>{v.label}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>
                                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1.5">
                                {Array.from({ length: leadBlanks }).map((_, i) => <div key={'b'+i} />)}
                                {days.map(d => {
                                    const st = ATT_STATUS[d.status];
                                    const dayNum = Number(d.date.slice(8, 10));
                                    return (
                                        <button key={d.date} disabled={!d.status}
                                            onClick={() => setEditDay(d.date)}
                                            className={`relative rounded-lg border p-1.5 text-left min-h-[64px] text-[11px] font-semibold transition-all ${st ? st.cls : 'bg-gray-50 text-gray-300 border-gray-100'} ${d.status ? 'hover:ring-2 hover:ring-teal-400 cursor-pointer' : 'cursor-default'}`}>
                                            <div>{dayNum}</div>
                                            {d.status && <div className="text-[9px] font-normal leading-tight mt-0.5">{st.label}{d.is_auto_week_off ? ' (auto)' : ''}</div>}
                                            {(d.punch_in_at || d.punch_out_at) && (
                                                <div className="text-[8px] font-normal leading-tight mt-0.5 opacity-80">
                                                    {fmtTime(d.punch_in_at)} – {fmtTime(d.punch_out_at)}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {editDay && (
                    <div className="border-t px-5 py-4 flex-shrink-0 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Set status for {editDay}</p>
                        <div className="flex flex-wrap gap-2">
                            {DAY_STATUS_OPTIONS.map(o => (
                                <button key={o.value} disabled={saving} onClick={() => setStatus(editDay, o.value)}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-full border hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all"
                                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                                    {o.label}
                                </button>
                            ))}
                            <button onClick={() => setEditDay(null)} className="px-2.5 py-1 text-[11px] font-semibold rounded-full" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
