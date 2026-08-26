import React, { useEffect, useState, useCallback, useContext } from 'react';
import Layout from '../../components/Layout';
import {
    Wallet, Loader2, RefreshCw, IndianRupee, Save, CheckCircle2, AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const Th = ({ children, right }) => (
    <th className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}
        style={{ color: 'var(--text-secondary)' }}>{children}</th>
);
const Td = ({ children, right, bold }) => (
    <td className={`px-3 py-2 text-sm ${right ? 'text-right' : 'text-left'} ${bold ? 'font-bold' : ''}`}
        style={{ color: 'var(--text-primary)' }}>{children}</td>
);

export default function AttendancePayrollPage() {
    const { user } = useContext(AuthContext);
    const { can } = usePermissions();
    const isAdmin = user?.role === 'admin' && can('attendance_payroll.edit');
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [edits, setEdits] = useState({});   // user_id -> salary string being edited
    const [savingId, setSavingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setMsg(null);
        try {
            const r = await api.get('/attendance/payroll', { params: { month } });
            setRows(r.data.report || []);
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to load payroll' });
        } finally { setLoading(false); }
    }, [month]);

    useEffect(() => { load(); }, [load]);

    const saveSalary = async (userId) => {
        setSavingId(userId); setMsg(null);
        try {
            await api.put(`/attendance/employees/${userId}/salary`, { monthly_salary: Number(edits[userId]) });
            setEdits((p) => { const n = { ...p }; delete n[userId]; return n; });
            setMsg({ type: 'success', text: 'Salary updated.' });
            await load();
        } catch (e) {
            setMsg({ type: 'error', text: e.response?.data?.error || 'Save failed' });
        } finally { setSavingId(null); }
    };

    const totals = rows.reduce((a, r) => {
        a.gross += Number(r.gross_salary || 0);
        a.net += Number(r.net_salary || 0);
        return a;
    }, { gross: 0, net: 0 });

    return (
        <Layout title="Payroll">
            <div className="max-w-6xl mx-auto p-4 sm:p-6">
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3"
                        style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-teal-700" />
                            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Payroll</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-700"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            <button onClick={load} className="p-2 text-teal-700 hover:text-teal-800"><RefreshCw className="h-4 w-4" /></button>
                        </div>
                    </div>

                    {msg && (
                        <div className={`mx-5 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="p-10 text-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
                    ) : rows.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-400">No employees found for this month.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[880px]">
                                <thead style={{ background: 'var(--bg-primary)' }}>
                                    <tr>
                                        <Th>Employee</Th>
                                        <Th right>Monthly Salary</Th>
                                        <Th right>Present</Th>
                                        <Th right>Week Off</Th>
                                        <Th right>Paid Leave</Th>
                                        <Th right>Absent</Th>
                                        <Th right>Payable Days</Th>
                                        <Th right>Per Day</Th>
                                        <Th right>Gross</Th>
                                        <Th right>Net</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                    {rows.map((r) => {
                                        const editing = edits[r.user_id] !== undefined;
                                        return (
                                            <tr key={r.user_id}>
                                                <Td>
                                                    <div className="font-semibold">{r.name}</div>
                                                    <div className="text-[11px] text-gray-400">{r.role}{r.shop_name ? ` · ${r.shop_name}` : ''}</div>
                                                </Td>
                                                <Td right>
                                                    {isAdmin ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input type="number" min="0"
                                                                value={editing ? edits[r.user_id] : r.monthly_salary}
                                                                onChange={(e) => setEdits((p) => ({ ...p, [r.user_id]: e.target.value }))}
                                                                className="w-24 px-2 py-1 border rounded text-sm text-right outline-none focus:ring-1 focus:ring-teal-700"
                                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                                            {editing && (
                                                                <button onClick={() => saveSalary(r.user_id)} disabled={savingId === r.user_id}
                                                                    className="p-1 text-teal-700 hover:text-teal-800">
                                                                    {savingId === r.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : money(r.monthly_salary)}
                                                </Td>
                                                <Td right>{r.present}{r.half_day ? ` +½×${r.half_day}` : ''}</Td>
                                                <Td right>{r.week_off}</Td>
                                                <Td right>{r.paid_leave}</Td>
                                                <Td right>{r.absent}</Td>
                                                <Td right bold>{r.payable_days}</Td>
                                                <Td right>{money(r.per_day_rate)}</Td>
                                                <Td right bold>{money(r.gross_salary)}</Td>
                                                <Td right bold><span className="text-teal-700 flex items-center justify-end"><IndianRupee className="h-3 w-3" />{Number(r.net_salary).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'var(--bg-primary)' }}>
                                        <Td bold>Total</Td>
                                        <Td /><Td /><Td /><Td /><Td /><Td /><Td />
                                        <Td right bold>{money(totals.gross)}</Td>
                                        <Td right bold><span className="text-teal-700">{money(totals.net)}</span></Td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
