import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { Settings, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const Field = ({ label, hint, children }) => (
    <div>
        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>
            {label}{hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
        </label>
        {children}
    </div>
);

export default function AttendanceSettingsPage() {
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

    const save = async () => {
        setSaving(true); setMsg(null);
        try {
            const r = await api.put('/attendance/settings', {
                shift_start: f.shift_start, shift_end: f.shift_end,
                grace_minutes: Number(f.grace_minutes), half_day_after: f.half_day_after,
                office_radius_m: Number(f.office_radius_m), min_working_hours: Number(f.min_working_hours),
                require_gps: f.require_gps, require_selfie: f.require_selfie,
                max_gps_accuracy_m: Number(f.max_gps_accuracy_m),
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
            <div className="max-w-2xl mx-auto p-4 sm:p-6">
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

                    {msg && (
                        <div className={`mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </div>
                    )}

                    <button onClick={save} disabled={saving}
                        className="mt-5 w-full py-2.5 rounded-lg text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 flex items-center justify-center gap-2 disabled:bg-gray-300">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Settings</>}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
