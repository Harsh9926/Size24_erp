import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Clock, MapPin, Camera, LogIn, LogOut, Loader2, CheckCircle2,
    AlertCircle, CalendarDays, TrendingUp, TrendingDown, Timer, Percent,
    ShieldCheck, ShieldAlert, RefreshCw, MapPinned,
} from 'lucide-react';
import SelfieCapture from './SelfieCapture';
import CompleteRegistrationModal from './CompleteRegistrationModal';
import AttendanceCalendar from './AttendanceCalendar';
import {
    getPosition, buildFormData, attApi, to12h, fmtTime,
    PUNCH_IN_STATUS, PUNCH_OUT_STATUS,
} from './attendanceUtils';

const StatCell = ({ icon: Icon, label, value, color }) => (
    <div className="rounded-lg p-3 border flex flex-col gap-1"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" style={{ color }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <span className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
);

// Self-service attendance card. Works for employee / manager / admin.
const EmployeeAttendanceCard = () => {
    const [data, setData]       = useState(null);   // { settings, registration, today }
    const [monthly, setMonthly] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showReg, setShowReg]     = useState(false);
    const [showLoc, setShowLoc]     = useState(false);
    const [punchMode, setPunchMode] = useState(null); // 'in' | 'out' | null
    const [selfie, setSelfie]   = useState(null);
    const [busy, setBusy]       = useState(false);
    const [msg, setMsg]         = useState(null); // {type, text}
    const [liveTimer, setLiveTimer] = useState('');
    const [loadErr, setLoadErr] = useState('');

    const load = useCallback(async () => {
        setLoadErr('');
        try {
            const [me, mo] = await Promise.all([
                attApi.get('/attendance/me'),
                attApi.get('/attendance/me/monthly'),
            ]);
            setData(me.data);
            setMonthly(mo.data);
        } catch (e) {
            setLoadErr(e.response?.data?.error || e.message || 'Failed to load attendance.');
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Live working-hours timer once punched in (and not out).
    useEffect(() => {
        const t = data?.today;
        if (!t?.punch_in_at || t?.punch_out_at) { setLiveTimer(''); return; }
        const tick = () => {
            const ms = Date.now() - new Date(t.punch_in_at).getTime();
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setLiveTimer(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [data?.today?.punch_in_at, data?.today?.punch_out_at]);

    const doPunch = async () => {
        setBusy(true); setMsg(null);
        try {
            const s = data.settings;
            let gps = { latitude: undefined, longitude: undefined, accuracy: undefined };
            if (s.require_gps) {
                gps = await getPosition();
                if (gps.accuracy > s.max_gps_accuracy_m) {
                    throw new Error(`GPS accuracy ±${Math.round(gps.accuracy)}m is too low (max ${s.max_gps_accuracy_m}m). Move to an open area.`);
                }
            }
            if (s.require_selfie && !selfie) throw new Error('Please take a selfie first.');
            const fd = buildFormData({ selfie, latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy });
            await attApi.post(`/attendance/punch-${punchMode}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setMsg({ type: 'success', text: `Punch ${punchMode === 'in' ? 'In' : 'Out'} successful!` });
            setPunchMode(null); setSelfie(null);
            await load();
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || err.message || 'Punch failed.' });
        } finally {
            setBusy(false);
        }
    };

    if (loading) return (
        <div className="rounded-xl border p-6 mb-6 flex items-center gap-2 text-sm text-gray-500"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance…
        </div>
    );
    if (!data) return (
        <div className="rounded-xl border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Attendance unavailable</h3>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{loadErr || 'Could not load attendance.'}</p>
            <button onClick={() => { setLoading(true); load(); }}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Retry
            </button>
        </div>
    );

    const { settings, registration, today } = data;
    const reg = registration;
    const sum = monthly?.summary || {};

    /* ── Registration gates ───────────────────────────────────────── */
    if (!reg || reg.status === 'rejected') {
        return (
            <div className="rounded-xl border p-6 mb-6"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Complete Your Registration</h3>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    {reg?.status === 'rejected'
                        ? `Your previous registration was rejected${reg.reject_reason ? `: ${reg.reject_reason}` : ''}. Please re-submit.`
                        : 'Register your office location with GPS + selfie to start marking attendance.'}
                </p>
                <button onClick={() => setShowReg(true)}
                    className="px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 flex items-center gap-2">
                    <MapPinned className="h-4 w-4" /> Complete Registration
                </button>
                {showReg && <CompleteRegistrationModal mode="register" onClose={() => setShowReg(false)} onDone={load} />}
            </div>
        );
    }
    if (reg.status === 'pending') {
        return (
            <div className="rounded-xl border p-6 mb-6 flex items-center gap-3"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <Clock className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Registration Pending Approval</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Your registration is awaiting admin approval. You'll be able to punch in once approved.
                    </p>
                </div>
            </div>
        );
    }

    /* ── Approved — full attendance UI ────────────────────────────── */
    const inS  = today?.punch_in_status  && PUNCH_IN_STATUS[today.punch_in_status];
    const outS = today?.punch_out_status && PUNCH_OUT_STATUS[today.punch_out_status];
    const canPunchIn  = !today?.punch_in_at;
    const canPunchOut = today?.punch_in_at && !today?.punch_out_at;

    return (
        <div className="mb-6 space-y-4">
            {/* ── Today's Attendance ──────────────────────────────── */}
            <div className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="px-5 py-3 border-b flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-white" />
                        <h3 className="text-sm font-bold text-white">Today's Attendance</h3>
                    </div>
                    <span className="text-[11px] text-teal-50 font-semibold">
                        Shift {to12h(settings.shift_start)} – {to12h(settings.shift_end)}
                    </span>
                </div>

                <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase text-gray-400">Status</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                {today?.punch_out_at ? 'Completed' : today?.punch_in_at ? 'Working' : 'Not Punched In'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase text-gray-400">Punch In</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtTime(today?.punch_in_at)}</p>
                            {inS && <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${inS.cls}`}>{inS.label}</span>}
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase text-gray-400">Punch Out</p>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtTime(today?.punch_out_at)}</p>
                            {outS && <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${outS.cls}`}>{outS.label}</span>}
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase text-gray-400">Working Hours</p>
                            <p className="text-sm font-bold font-mono text-teal-700">
                                {liveTimer || (today?.working_hours ? `${today.working_hours} h` : '—')}
                            </p>
                        </div>
                    </div>

                    {msg && (
                        <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                            msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            {msg.text}
                        </div>
                    )}

                    {/* Punch capture panel */}
                    {punchMode ? (
                        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                            <p className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                <Camera className="h-4 w-4 text-teal-700" />
                                {punchMode === 'in' ? 'Punch In' : 'Punch Out'} — take a selfie {settings.require_gps && '· GPS will be captured'}
                            </p>
                            {settings.require_selfie && <SelfieCapture onCapture={setSelfie} />}
                            <div className="flex gap-2 mt-3">
                                <button onClick={doPunch} disabled={busy || (settings.require_selfie && !selfie)}
                                    className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-gray-300 flex items-center justify-center gap-2">
                                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                                        : punchMode === 'in' ? <><LogIn className="h-4 w-4" /> Confirm Punch In</>
                                        : <><LogOut className="h-4 w-4" /> Confirm Punch Out</>}
                                </button>
                                <button onClick={() => { setPunchMode(null); setSelfie(null); setMsg(null); }}
                                    className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 border border-gray-200 hover:bg-gray-200">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setPunchMode('in'); setMsg(null); }} disabled={!canPunchIn}
                                className="flex-1 min-w-[140px] py-3 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                style={{ background: canPunchIn ? '#0f766e' : undefined }}>
                                <LogIn className="h-4 w-4" /> {canPunchIn ? 'Punch In' : 'Punched In ✓'}
                            </button>
                            <button onClick={() => { setPunchMode('out'); setMsg(null); }} disabled={!canPunchOut}
                                className="flex-1 min-w-[140px] py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ borderColor: '#0f766e', color: canPunchOut ? '#0f766e' : '#9ca3af' }}>
                                <LogOut className="h-4 w-4" /> {today?.punch_out_at ? 'Punched Out ✓' : 'Punch Out'}
                            </button>
                        </div>
                    )}

                    <button onClick={() => setShowLoc(true)}
                        className="mt-3 text-[11px] text-teal-700 underline hover:text-teal-800 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Request Location Change
                    </button>
                </div>
            </div>

            {/* ── Monthly Summary ─────────────────────────────────── */}
            <div className="rounded-xl border p-5"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <CalendarDays className="h-4 w-4 text-teal-700" /> Monthly Summary · {monthly?.month}
                    </h3>
                    <button onClick={load} className="p-1 text-teal-700 hover:text-teal-800"><RefreshCw className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <StatCell icon={CheckCircle2} label="Present"    value={sum.present ?? 0}       color="#16a34a" />
                    <StatCell icon={AlertCircle}  label="Absent"     value={sum.absent ?? 0}        color="#dc2626" />
                    <StatCell icon={Clock}        label="Late"       value={sum.late ?? 0}          color="#d97706" />
                    <StatCell icon={Timer}        label="Half Day"   value={sum.half_day ?? 0}      color="#ea580c" />
                    <StatCell icon={TrendingUp}   label="Early Arr." value={sum.early_arrival ?? 0} color="#2563eb" />
                    <StatCell icon={TrendingDown} label="Early Exit" value={sum.early_exit ?? 0}    color="#d97706" />
                    <StatCell icon={TrendingUp}   label="Overtime"   value={sum.overtime ?? 0}      color="#4f46e5" />
                    <StatCell icon={Percent}      label="Attendance" value={`${sum.attendance_percentage ?? 0}%`} color="#0f766e" />
                </div>
                <div className="mb-3">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        Total Working Hours: <span className="font-bold text-teal-700">{sum.total_working_hours ?? 0} h</span>
                    </p>
                </div>
                <AttendanceCalendar month={monthly?.month} days={monthly?.days || []} />
            </div>

            {showLoc && <CompleteRegistrationModal mode="location" onClose={() => setShowLoc(false)} onDone={load} />}
        </div>
    );
};

export default EmployeeAttendanceCard;
