import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import {
    Clock, MapPin, Camera, LogIn, LogOut, Loader2, CheckCircle2,
    AlertCircle, CalendarDays, TrendingUp, TrendingDown, Timer, Percent,
    ShieldCheck, ShieldAlert, RefreshCw, MapPinned,
} from 'lucide-react';
import SelfieCapture from './SelfieCapture';
import CompleteRegistrationModal from './CompleteRegistrationModal';
import AttendanceCalendar from './AttendanceCalendar';
import { AuthContext } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
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
    const { user } = useContext(AuthContext);
    const { can }  = usePermissions();
    // shop_user's own punch is exempt from this RBAC surface on the backend
    // (see routes/attendance.js — exemptRoles: ['shop_user']); mirror that
    // here so the button doesn't disappear for every employee just because
    // ROLE_DEFAULTS.shop_user.attendance is NO_ACCESS at the module level.
    // admin/manager (who ARE covered by the permission) get the real check.
    const canPunchPermission = user?.role === 'shop_user' ? true : can('attendance.punch');
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

    // Live timer for the currently open session (In with no Out yet).
    const openSession = (data?.today?.sessions || []).find((s) => !s.punch_out_at);
    useEffect(() => {
        if (!openSession?.punch_in_at) { setLiveTimer(''); return; }
        const base = new Date(openSession.punch_in_at).getTime();
        const priorH = (data?.today?.sessions || [])
            .filter((s) => s.punch_out_at)
            .reduce((a, s) => a + Number(s.working_hours || 0), 0);
        const tick = () => {
            const ms = Date.now() - base + priorH * 3600000;
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setLiveTimer(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [openSession?.id, openSession?.punch_in_at]);

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
            // Punch-in always requires a live selfie for face verification, regardless
            // of the require_selfie setting (which only governs punch-out).
            if ((punchMode === 'in' || s.require_selfie) && !selfie) throw new Error('Please take a selfie first.');
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
    const sessions = today?.sessions || [];
    const hasOpen = today?.has_open_session;
    const canPunchIn  = !hasOpen && canPunchPermission;   // start a new session unless one is open
    const canPunchOut = !!hasOpen && canPunchPermission;  // close the currently open session

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
                            {(punchMode === 'in' || settings.require_selfie) && <SelfieCapture onCapture={setSelfie} />}
                            {punchMode === 'in' && (
                                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    Your live selfie is matched against your registered photo — attendance is marked only on a face match.
                                </p>
                            )}
                            <div className="flex gap-2 mt-3">
                                <button onClick={doPunch} disabled={busy || ((punchMode === 'in' || settings.require_selfie) && !selfie)}
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
                                <LogIn className="h-4 w-4" /> {sessions.length ? 'Punch In Again' : 'Punch In'}
                            </button>
                            <button onClick={() => { setPunchMode('out'); setMsg(null); }} disabled={!canPunchOut}
                                className="flex-1 min-w-[140px] py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ borderColor: '#0f766e', color: canPunchOut ? '#0f766e' : '#9ca3af' }}>
                                <LogOut className="h-4 w-4" /> Punch Out
                            </button>
                        </div>
                    )}

                    {sessions.length > 0 && (
                        <div className="mt-4 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide"
                                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                                Today's Sessions ({sessions.length})
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                {sessions.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                                        <span className="font-mono font-semibold text-gray-400">#{s.seq}</span>
                                        <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-teal-700" /> {fmtTime(s.punch_in_at)}</span>
                                        <span className="flex items-center gap-1"><LogOut className="h-3 w-3 text-teal-700" /> {s.punch_out_at ? fmtTime(s.punch_out_at) : <span className="text-amber-600 font-semibold">Open</span>}</span>
                                        <span className="font-mono font-bold text-teal-700">{s.working_hours ? `${s.working_hours}h` : '—'}</span>
                                    </div>
                                ))}
                            </div>
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
                    <StatCell icon={CheckCircle2} label="Present"     value={sum.present ?? 0}       color="#16a34a" />
                    <StatCell icon={AlertCircle}  label="Absent"      value={sum.absent ?? 0}        color="#dc2626" />
                    <StatCell icon={CalendarDays} label="Week Off"    value={sum.week_off ?? 0}      color="#0284c7" />
                    <StatCell icon={CheckCircle2} label="Paid Leave"  value={sum.paid_leave ?? 0}    color="#0d9488" />
                    <StatCell icon={Timer}        label="Half Day"    value={sum.half_day ?? 0}      color="#ea580c" />
                    <StatCell icon={Clock}        label="Late"        value={sum.late ?? 0}          color="#d97706" />
                    <StatCell icon={TrendingUp}   label="Payable Days" value={sum.payable_days ?? 0} color="#4f46e5" />
                    <StatCell icon={Percent}      label="Attendance"  value={`${sum.attendance_percentage ?? 0}%`} color="#0f766e" />
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
