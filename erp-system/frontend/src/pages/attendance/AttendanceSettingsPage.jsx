import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { Settings, Save, Loader2, CheckCircle2, AlertCircle, User, MapPin, Wallet } from 'lucide-react';
import api from '../../services/api';
import { WEEKDAYS } from '../../components/attendance/attendanceUtils';
import { usePermissions } from '../../context/PermissionsContext';

const Field = ({ label, hint, children }) => (
    <div>
        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
            {label}{hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
        </label>
        {children}
    </div>
);

export default function AttendanceSettingsPage() {
    const { can } = usePermissions();
    const canEdit = can('attendance_settings.edit');
    const [f, setF] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    const iCls = 'w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700';
    const iStyle = { background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

    useEffect(() => { api.get('/attendance/settings').then(r => setF(r.data)).catch(() => {}); }, []);

    const upd = (k) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setF(p => ({ ...p, [k]: v }));
    };

    const weekOff = Array.isArray(f?.week_off_days) ? f.week_off_days.map(Number) : [];
    const toggleWeekOff = (d) => setF(p => {
        const cur = Array.isArray(p.week_off_days) ? p.week_off_days.map(Number) : [];
        return { ...p, week_off_days: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort() };
    });

    const save = async () => {
        setSaving(true); setMsg(null);
        try {
            const r = await api.put('/attendance/settings', {
                shift_start: f.shift_start, shift_end: f.shift_end,
                grace_minutes: Number(f.grace_minutes), half_day_after: f.half_day_after,
                office_radius_m: Number(f.office_radius_m), min_working_hours: Number(f.min_working_hours),
                require_gps: f.require_gps, require_selfie: f.require_selfie,
                max_gps_accuracy_m: Number(f.max_gps_accuracy_m),
                week_off_days: weekOff, payroll_days_basis: f.payroll_days_basis,
            });
            setF(r.data);
            setMsg({ type: 'success', text: 'Settings saved.' });
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Save failed' });
        } finally { setSaving(false); }
    };

    if (!f) return <Layout title="Attendance Settings"><div className="p-8 text-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin inline" /></div></Layout>;

    return (
        <Layout title="Attendance Settings">
            <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
                <div className="rounded-xl border p-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <Settings className="h-5 w-5 text-teal-700" />
                        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Attendance Configuration</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Shift Start"><input type="time" value={f.shift_start?.slice(0,5)} onChange={upd('shift_start')} className={iCls} style={iStyle} /></Field>
                        <Field label="Shift End"><input type="time" value={f.shift_end?.slice(0,5)} onChange={upd('shift_end')} className={iCls} style={iStyle} /></Field>
                        <Field label="Grace Time" hint="(minutes)"><input type="number" min="0" value={f.grace_minutes} onChange={upd('grace_minutes')} className={iCls} style={iStyle} /></Field>
                        <Field label="Half Day After"><input type="time" value={f.half_day_after?.slice(0,5)} onChange={upd('half_day_after')} className={iCls} style={iStyle} /></Field>
                        <Field label="Office Radius" hint="(metres)"><input type="number" min="1" value={f.office_radius_m} onChange={upd('office_radius_m')} className={iCls} style={iStyle} /></Field>
                        <Field label="Minimum Working Hours"><input type="number" min="0" step="0.5" value={f.min_working_hours} onChange={upd('min_working_hours')} className={iCls} style={iStyle} /></Field>
                        <Field label="Max GPS Accuracy" hint="(metres, lower=stricter)"><input type="number" min="1" value={f.max_gps_accuracy_m} onChange={upd('max_gps_accuracy_m')} className={iCls} style={iStyle} /></Field>
                    </div>

                    <div className="flex flex-wrap gap-6 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={f.require_gps} onChange={upd('require_gps')} className="h-4 w-4 rounded text-teal-700 focus:ring-teal-700" />
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Require GPS</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={f.require_selfie} onChange={upd('require_selfie')} className="h-4 w-4 rounded text-teal-700 focus:ring-teal-700" />
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Require Selfie</span>
                        </label>
                    </div>

                    {/* ── Weekly Off + Payroll ─────────────────────────── */}
                    <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                            Weekly Off Days <span className="font-normal text-gray-400">(paid, not counted absent)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((name, d) => {
                                const on = weekOff.includes(d);
                                return (
                                    <button key={d} type="button" onClick={() => toggleWeekOff(d)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${on
                                            ? 'bg-teal-700 text-white border-teal-700'
                                            : 'bg-transparent border-gray-300 text-gray-500 hover:border-teal-500'}`}>
                                        {name.slice(0, 3)}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-4 max-w-xs">
                            <Field label="Payroll Days Basis" hint="(salary divisor)">
                                <select value={f.payroll_days_basis || 'calendar'} onChange={upd('payroll_days_basis')} className={iCls} style={iStyle}>
                                    <option value="calendar">Calendar days in month</option>
                                    <option value="fixed30">Fixed 30 days</option>
                                </select>
                            </Field>
                        </div>
                    </div>

                    {msg && (
                        <div className={`mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </div>
                    )}

                    <button onClick={save} disabled={saving || !canEdit}
                        className="mt-5 w-full py-2.5 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 flex items-center justify-center gap-2 disabled:bg-gray-300">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Settings</>}
                    </button>
                </div>

                <PerEmployeeSettings global={f} iCls={iCls} iStyle={iStyle} />
            </div>
        </Layout>
    );
}

/* ══════════════════════════════════════════════════════════════════
   Per-Employee attendance + payroll overrides
   Empty field = inherit global. Booleans use a tri-state select.
══════════════════════════════════════════════════════════════════ */
function PerEmployeeSettings({ global, iCls, iStyle }) {
    const [emps, setEmps] = useState([]);
    const [userId, setUserId] = useState('');
    const [data, setData] = useState(null);   // full GET /user-settings response
    const [ov, setOv] = useState({});         // editable override draft
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        api.get('/attendance/employees').then(r => setEmps(r.data)).catch(() => {});
    }, []);

    const load = useCallback(async (uid) => {
        if (!uid) { setData(null); return; }
        setLoading(true); setMsg(null);
        try {
            const r = await api.get(`/attendance/user-settings/${uid}`);
            setData(r.data);
            const o = r.data.override || {};
            setOv({
                shift_start: o.shift_start?.slice(0, 5) || '',
                shift_end: o.shift_end?.slice(0, 5) || '',
                grace_minutes: o.grace_minutes ?? '',
                half_day_after: o.half_day_after?.slice(0, 5) || '',
                min_working_hours: o.min_working_hours ?? '',
                max_gps_accuracy_m: o.max_gps_accuracy_m ?? '',
                office_radius_m: o.office_radius_m ?? '',
                require_gps: o.require_gps == null ? '' : String(o.require_gps),
                require_selfie: o.require_selfie == null ? '' : String(o.require_selfie),
                enforce_shop_location: !!o.enforce_shop_location,
                override_week_off: Array.isArray(o.week_off_days),
                week_off_days: Array.isArray(o.week_off_days) ? o.week_off_days.map(Number)
                    : (r.data.effective?.week_off_days || []).map(Number),
                monthly_salary: o.monthly_salary ?? (r.data.registration?.monthly_salary ?? ''),
            });
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to load' });
        } finally { setLoading(false); }
    }, []);

    const onPick = (e) => { const v = e.target.value; setUserId(v); load(v); };
    const set = (k) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setOv(p => ({ ...p, [k]: v }));
    };
    const toggleDay = (d) => setOv(p => {
        const cur = p.week_off_days || [];
        return { ...p, week_off_days: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort() };
    });

    const save = async () => {
        setSaving(true); setMsg(null);
        try {
            const body = {
                shift_start: ov.shift_start || '', shift_end: ov.shift_end || '',
                grace_minutes: ov.grace_minutes === '' ? '' : Number(ov.grace_minutes),
                half_day_after: ov.half_day_after || '',
                min_working_hours: ov.min_working_hours === '' ? '' : Number(ov.min_working_hours),
                max_gps_accuracy_m: ov.max_gps_accuracy_m === '' ? '' : Number(ov.max_gps_accuracy_m),
                office_radius_m: ov.office_radius_m === '' ? '' : Number(ov.office_radius_m),
                require_gps: ov.require_gps === '' ? null : ov.require_gps === 'true',
                require_selfie: ov.require_selfie === '' ? null : ov.require_selfie === 'true',
                enforce_shop_location: !!ov.enforce_shop_location,
                week_off_days: ov.override_week_off ? (ov.week_off_days || []) : null,
                monthly_salary: ov.monthly_salary === '' ? '' : Number(ov.monthly_salary),
            };
            await api.put(`/attendance/user-settings/${userId}`, body);
            setMsg({ type: 'success', text: 'Employee settings saved.' });
            await load(userId);
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Save failed' });
        } finally { setSaving(false); }
    };

    const g = global || {};
    const shop = data?.shop;
    const pay = data?.payroll;
    const Ph = (v) => (v == null ? '' : `Global: ${v}`);

    return (
        <div className="rounded-xl border p-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2 mb-5 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <User className="h-5 w-5 text-teal-700" />
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Per-Employee Settings</h3>
            </div>

            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Select Employee</label>
            <select value={userId} onChange={onPick} className={iCls} style={iStyle}>
                <option value="">— Choose an employee —</option>
                {emps.map(e => (
                    <option key={e.user_id} value={e.user_id}>{e.name} · {e.role}{e.shop_name ? ` · ${e.shop_name}` : ''}</option>
                ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Leave a field blank to inherit the global default above.</p>

            {loading && <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>}

            {data && !loading && (
                <div className="mt-5 space-y-5">
                    {/* Assigned shops / geofences */}
                    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                        <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <MapPin className="h-4 w-4 text-teal-700" /> Assigned Shop Geofences
                        </p>
                        {Array.isArray(data.assigned_shops) && data.assigned_shops.length > 0 ? (
                            <div className="space-y-1.5">
                                {data.assigned_shops.map(s => (
                                    <p key={s.id} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        <b>{s.shop_name}</b> — {s.latitude != null && s.longitude != null
                                            ? `GPS ${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)} · radius ${s.geofence_radius_m || 50}m`
                                            : <span className="text-amber-600">no GPS set on this shop</span>}
                                    </p>
                                ))}
                            </div>
                        ) : shop ? (
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <b>{shop.shop_name}</b> — {shop.latitude != null && shop.longitude != null
                                    ? `GPS ${Number(shop.latitude).toFixed(5)}, ${Number(shop.longitude).toFixed(5)} · radius ${shop.geofence_radius_m || 50}m`
                                    : <span className="text-amber-600">no GPS set on this shop</span>}
                            </p>
                        ) : <p className="text-xs text-amber-600">No shops assigned to this employee. Attendance will be blocked until assigned to a shop with GPS.</p>}
                        <p className="text-[11px] text-gray-400 mt-2">
                            Attendance is checked against all assigned shops. Employees can punch in/out if they are inside any assigned shop's geofence.
                        </p>
                    </div>

                    {/* Attendance rule overrides */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Shift Start"><input type="time" value={ov.shift_start} onChange={set('shift_start')} className={iCls} style={iStyle} /></Field>
                        <Field label="Shift End"><input type="time" value={ov.shift_end} onChange={set('shift_end')} className={iCls} style={iStyle} /></Field>
                        <Field label="Grace Time" hint="(min)"><input type="number" min="0" placeholder={Ph(g.grace_minutes)} value={ov.grace_minutes} onChange={set('grace_minutes')} className={iCls} style={iStyle} /></Field>
                        <Field label="Half Day After"><input type="time" value={ov.half_day_after} onChange={set('half_day_after')} className={iCls} style={iStyle} /></Field>
                        <Field label="Min Working Hours"><input type="number" min="0" step="0.5" placeholder={Ph(g.min_working_hours)} value={ov.min_working_hours} onChange={set('min_working_hours')} className={iCls} style={iStyle} /></Field>
                        <Field label="Office Radius" hint="(m)"><input type="number" min="1" placeholder={Ph(g.office_radius_m)} value={ov.office_radius_m} onChange={set('office_radius_m')} className={iCls} style={iStyle} /></Field>
                        <Field label="Max GPS Accuracy" hint="(m)"><input type="number" min="1" placeholder={Ph(g.max_gps_accuracy_m)} value={ov.max_gps_accuracy_m} onChange={set('max_gps_accuracy_m')} className={iCls} style={iStyle} /></Field>
                        <Field label="Require GPS">
                            <select value={ov.require_gps} onChange={set('require_gps')} className={iCls} style={iStyle}>
                                <option value="">Inherit ({String(g.require_gps)})</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        </Field>
                        <Field label="Require Selfie">
                            <select value={ov.require_selfie} onChange={set('require_selfie')} className={iCls} style={iStyle}>
                                <option value="">Inherit ({String(g.require_selfie)})</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                            </select>
                        </Field>
                    </div>

                    {/* Weekly off override */}
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" checked={!!ov.override_week_off} onChange={set('override_week_off')} className="h-4 w-4 rounded text-teal-700 focus:ring-teal-700" />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Override weekly off days for this employee</span>
                        </label>
                        {ov.override_week_off && (
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map((name, d) => {
                                    const on = (ov.week_off_days || []).includes(d);
                                    return (
                                        <button key={d} type="button" onClick={() => toggleDay(d)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${on
                                                ? 'bg-teal-700 text-white border-teal-700'
                                                : 'bg-transparent border-gray-300 text-gray-500 hover:border-teal-500'}`}>
                                            {name.slice(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Payroll */}
                    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                        <p className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Wallet className="h-4 w-4 text-teal-700" /> Payroll {pay ? `· ${pay.month}` : ''}
                        </p>
                        <div className="max-w-xs mb-4">
                            <Field label="Monthly Salary" hint="(₹)">
                                <input type="number" min="0" placeholder="e.g. 35000" value={ov.monthly_salary} onChange={set('monthly_salary')} className={iCls} style={iStyle} />
                            </Field>
                        </div>
                        {pay && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <PayCell label="Present" value={pay.present} />
                                <PayCell label="Paid Week Off" value={pay.week_off} />
                                <PayCell label="Paid Leave" value={pay.paid_leave} />
                                <PayCell label="Unpaid Leave" value={pay.unpaid_leave} />
                                <PayCell label="Absent" value={pay.absent} />
                                <PayCell label="Payable Days" value={pay.payable_days} strong />
                                <PayCell label="Per Day" value={`₹${pay.per_day_rate}`} />
                                <PayCell label="Net Salary" value={`₹${Number(pay.net_salary).toLocaleString('en-IN')}`} strong />
                            </div>
                        )}
                        <p className="text-[11px] text-gray-400 mt-2">Preview from this month's attendance. Save to persist, then it recalculates.</p>
                    </div>

                    {msg && (
                        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </div>
                    )}

                    <button onClick={save} disabled={saving || !canEdit}
                        className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 flex items-center justify-center gap-2 disabled:bg-gray-300">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Employee Settings</>}
                    </button>
                </div>
            )}
        </div>
    );
}

const PayCell = ({ label, value, strong }) => (
    <div className="rounded-lg p-2.5 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <p className="text-[10px] font-semibold uppercase text-gray-400">{label}</p>
        <p className={`${strong ? 'text-teal-700 font-extrabold' : 'font-bold'} text-sm`} style={strong ? {} : { color: 'var(--text-primary)' }}>{value}</p>
    </div>
);
