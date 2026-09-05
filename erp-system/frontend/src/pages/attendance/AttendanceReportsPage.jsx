import React, { useEffect, useState, useCallback, useContext } from 'react';
import Layout from '../../components/Layout';
import { BarChart3, Download, FileSpreadsheet, Loader2, Printer, UserCog, X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import { AuthContext } from '../../context/AuthContext';
import { DAY_STATUS_OPTIONS } from '../../components/attendance/attendanceUtils';
import EmployeeCalendarModal from '../../components/attendance/EmployeeCalendarModal';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AttendanceReportsPage() {
    const { user } = useContext(AuthContext);
    const { can } = usePermissions();
    const canExport = can('attendance_reports.export');
    const isAdmin = user?.role === 'admin';
    const [month, setMonth] = useState(thisMonth());
    const [shops, setShops] = useState([]);
    const [shopId, setShopId] = useState('');
    const [employees, setEmployees] = useState([]);
    const [userId, setUserId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMarkModal, setShowMarkModal] = useState(false);
    const [calUser, setCalUser] = useState(null); // { user_id, name } when calendar modal open

    useEffect(() => { api.get('/attendance/shops').then(r => setShops(r.data)).catch(() => {}); }, []);

    useEffect(() => {
        api.get('/attendance/employees', { params: { shop_id: shopId || undefined } })
            .then(r => setEmployees(r.data)).catch(() => setEmployees([]));
        setUserId('');
    }, [shopId]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/attendance/report', { params: { month, shop_id: shopId || undefined, user_id: userId || undefined } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    }, [month, shopId, userId]);
    useEffect(() => { load(); }, [load]);

    const downloadFile = async (format) => {
        const res = await api.get('/attendance/export', {
            params: { month, shop_id: shopId || undefined, format },
            responseType: 'blob',
        });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${month}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const cols = ['Employee', 'Shop', 'Present', 'Absent', 'Week Off', 'Paid Leave', 'Unpaid Leave', 'Holiday', 'Late', 'Half Day', 'Early Arr.', 'Early Exit', 'Overtime', 'Attendance %', 'Total Hours'];

    return (
        <Layout title="Attendance Reports">
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                    <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <select value={shopId} onChange={e => setShopId(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Shops</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                    </select>
                    <select value={userId} onChange={e => setUserId(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                        <option value="">All Employees</option>
                        {employees.map(e => <option key={e.user_id} value={e.user_id}>{e.name || e.mobile}</option>)}
                    </select>
                    <div className="ml-auto flex gap-2">
                        {isAdmin && (
                            <button onClick={() => setShowMarkModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                                <UserCog className="h-4 w-4" /> Mark/Edit Attendance
                            </button>
                        )}
                        {canExport && (<>
                        <button onClick={() => downloadFile('csv')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800"><Download className="h-4 w-4" /> CSV</button>
                        <button onClick={() => downloadFile('excel')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: '#059669' }}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                        </>)}
                        {/* Print uses already-visible report data (attendance_reports.view), not the export endpoint — not gated by attendance_reports.export */}
                        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"><Printer className="h-4 w-4" /> PDF / Print</button>
                    </div>
                </div>

                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
                        <BarChart3 className="h-4 w-4 text-teal-700" />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Report · {month}</h3>
                        {data && <span className="text-xs text-gray-400">({data.elapsed_days} working days elapsed)</span>}
                        {isAdmin && <span className="text-xs text-gray-400 ml-auto print:hidden">Click a row to view/edit day-wise attendance</span>}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left" style={{ background: 'var(--bg-primary)' }}>
                                    {cols.map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
                                ) : !data?.report?.length ? (
                                    <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-gray-400">No records for this month.</td></tr>
                                ) : data.report.map(r => (
                                    <tr key={r.user_id} className="border-t hover:bg-teal-50/40 cursor-pointer" style={{ borderColor: 'var(--border-color)' }}
                                        onClick={() => isAdmin && setCalUser({ user_id: r.user_id, name: r.name || r.mobile })}>
                                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name || r.mobile}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.shop_name || '—'}</td>
                                        <td className="px-3 py-2.5">{r.present}</td>
                                        <td className="px-3 py-2.5 text-red-600">{r.absent}</td>
                                        <td className="px-3 py-2.5 text-sky-600">{r.week_off}</td>
                                        <td className="px-3 py-2.5 text-teal-600">{r.paid_leave}</td>
                                        <td className="px-3 py-2.5 text-rose-600">{r.unpaid_leave}</td>
                                        <td className="px-3 py-2.5 text-violet-600">{r.holiday}</td>
                                        <td className="px-3 py-2.5">{r.late}</td>
                                        <td className="px-3 py-2.5">{r.half_day}</td>
                                        <td className="px-3 py-2.5">{r.early_arrival}</td>
                                        <td className="px-3 py-2.5">{r.early_exit}</td>
                                        <td className="px-3 py-2.5">{r.overtime}</td>
                                        <td className="px-3 py-2.5 font-bold text-teal-700">{r.attendance_percentage}%</td>
                                        <td className="px-3 py-2.5 font-mono">{r.total_working_hours}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showMarkModal && (
                <MarkAttendanceModal
                    employees={employees.length ? employees : null}
                    onClose={() => setShowMarkModal(false)}
                    onSaved={() => { setShowMarkModal(false); load(); }}
                />
            )}

            {calUser && (
                <EmployeeCalendarModal
                    userId={calUser.user_id}
                    name={calUser.name}
                    month={month}
                    onClose={() => setCalUser(null)}
                    onSaved={load}
                />
            )}
        </Layout>
    );
}

/* ── Admin-only: back-date Mark/Edit Attendance modal ───────────────
   Loads its own full employee list (ignores the page's shop filter) so
   admin can pick any employee regardless of what's currently filtered. */
function MarkAttendanceModal({ onClose, onSaved }) {
    const [employees, setEmployees] = useState([]);
    const [userId, setUserId] = useState('');
    const [date, setDate] = useState(todayISO());
    const [status, setStatus] = useState('present');
    const [punchIn, setPunchIn] = useState('');
    const [punchOut, setPunchOut] = useState('');
    const [remarks, setRemarks] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => { api.get('/attendance/employees').then(r => setEmployees(r.data)).catch(() => {}); }, []);

    const save = async () => {
        if (!userId || !date || !status) { setMsg({ type: 'error', text: 'Employee, date and status are required.' }); return; }
        setSaving(true); setMsg(null);
        try {
            await api.put('/attendance/manual', {
                user_id: userId, date, status,
                punch_in_time: punchIn || undefined, punch_out_time: punchOut || undefined,
                remarks: remarks || undefined,
            });
            onSaved();
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save attendance' });
            setConfirming(false);
        } finally { setSaving(false); }
    };

    const inputCls = "w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700";
    const inputStyle = { background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <UserCog className="h-5 w-5 text-indigo-600" /> Mark/Edit Attendance
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200" style={{ color: 'var(--text-secondary)' }}><X className="h-5 w-5" /></button>
                </div>

                <div className="p-5 space-y-3">
                    {msg && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Employee</label>
                        <select value={userId} onChange={e => setUserId(e.target.value)} className={inputCls} style={inputStyle}>
                            <option value="">Select employee…</option>
                            {employees.map(e => <option key={e.user_id} value={e.user_id}>{e.name || e.mobile}{e.shop_name ? ` · ${e.shop_name}` : ''}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                        <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} className={inputCls} style={inputStyle} />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls} style={inputStyle}>
                            {DAY_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {(status === 'present' || status === 'half_day') && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Punch-in Time</label>
                                <input type="time" value={punchIn} onChange={e => setPunchIn(e.target.value)} className={inputCls} style={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Punch-out Time</label>
                                <input type="time" value={punchOut} onChange={e => setPunchOut(e.target.value)} className={inputCls} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Remarks (optional)</label>
                        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} className={inputCls} style={inputStyle} />
                    </div>

                    {confirming ? (
                        <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                                Confirm: set <b>{status.replace('_', ' ')}</b> for this employee on <b>{date}</b>? This will be recorded as an admin manual edit.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setConfirming(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>Cancel</button>
                                <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5">
                                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm & Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setConfirming(true)}
                            className="w-full px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                            Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
