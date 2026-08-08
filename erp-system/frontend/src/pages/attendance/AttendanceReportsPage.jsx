import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { BarChart3, Download, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';
import api from '../../services/api';

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function AttendanceReportsPage() {
    const [month, setMonth] = useState(thisMonth());
    const [shops, setShops] = useState([]);
    const [shopId, setShopId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { api.get('/attendance/shops').then(r => setShops(r.data)).catch(() => {}); }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/attendance/report', { params: { month, shop_id: shopId || undefined } });
            setData(r.data);
        } catch {} finally { setLoading(false); }
    }, [month, shopId]);
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

    const cols = ['Employee', 'Shop', 'Present', 'Absent', 'Late', 'Half Day', 'Early Arr.', 'Early Exit', 'Overtime', 'Attendance %', 'Total Hours'];

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
                    <div className="ml-auto flex gap-2">
                        <button onClick={() => downloadFile('csv')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800"><Download className="h-4 w-4" /> CSV</button>
                        <button onClick={() => downloadFile('excel')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-lg" style={{ background: '#059669' }}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"><Printer className="h-4 w-4" /> PDF / Print</button>
                    </div>
                </div>

                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                    <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
                        <BarChart3 className="h-4 w-4 text-teal-700" />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Report · {month}</h3>
                        {data && <span className="text-xs text-gray-400">({data.elapsed_days} working days elapsed)</span>}
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
                                    <tr key={r.user_id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name || r.mobile}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{r.shop_name || '—'}</td>
                                        <td className="px-3 py-2.5">{r.present}</td>
                                        <td className="px-3 py-2.5 text-red-600">{r.absent}</td>
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
        </Layout>
    );
}
