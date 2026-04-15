import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

const ReportsPage = () => {
    const [filters, setFilters] = useState({ from_date: '', to_date: '', shop_id: '', city_id: '' });
    const [shops, setShops] = useState([]);
    const [cities, setCities] = useState([]);
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);

    useEffect(() => {
        api.get('/shops').then(r => setShops(r.data)).catch(() => { });
        api.get('/locations/states').then(() => { }).catch(() => { });
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
            const res = await api.get(`/reports/data?${params}`);
            setReportData(res.data.data);
            setSummary(res.data.summary);
            setFetched(true);
        } catch (e) { alert(e.response?.data?.error || 'Failed to fetch report'); }
        finally { setLoading(false); }
    };

    const downloadCSV = () => {
        const csv = Papa.unparse(reportData.map(r => ({
            Date: r.date?.split('T')[0],
            Shop: r.shop_name,
            City: r.city_name,
            'Total Sale': r.total_sale,
            Cash: r.cash,
            Paytm: r.paytm,
            Razorpay: r.razorpay,
            Expense: r.expense,
            Difference: r.difference,
        })));
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'erp_report.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        // Brand header
        doc.setFillColor(30, 30, 47);
        doc.rect(0, 0, 297, 20, 'F');
        doc.setFontSize(14);
        doc.setTextColor(255, 107, 0);
        doc.text('SIZE24 ERP', 10, 13);
        doc.setFontSize(10);
        doc.setTextColor(200, 200, 200);
        doc.text('SIZE24 ERP REPORT – Smart Retail Management', 45, 13);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 10, 26);
        autoTable(doc, {
            startY: 32,
            head: [['Date', 'Shop', 'City', 'Total Sale', 'Cash', 'Paytm', 'Razorpay', 'Expense', 'Diff']],
            body: reportData.map(r => [
                r.date?.split('T')[0], r.shop_name, r.city_name,
                `Rs${r.total_sale}`, `Rs${r.cash}`, `Rs${r.paytm}`, `Rs${r.razorpay}`, `Rs${r.expense}`, `Rs${r.difference}`
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 107, 0], textColor: 255 },
            alternateRowStyles: { fillColor: [255, 248, 240] },
            foot: [[`Total Records: ${reportData.length}`, '', '', '', '', '', '', '', '']],
            footStyles: { fillColor: [30, 30, 47], textColor: [255, 107, 0], fontStyle: 'bold' },
        });
        doc.save('SIZE24_ERP_Report.pdf');
    };

    const inputCls = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white";

    return (
        <Layout title="Reports & Exports">
            {/* Filters */}
            <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Filter Report</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div><label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>From Date</label>
                        <input type="date" className={inputCls + ' w-full'} value={filters.from_date} onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))} /></div>
                    <div><label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>To Date</label>
                        <input type="date" className={inputCls + ' w-full'} value={filters.to_date} onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))} /></div>
                    <div><label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Shop</label>
                        <select className={inputCls + ' w-full'} value={filters.shop_id} onChange={e => setFilters(f => ({ ...f, shop_id: e.target.value }))}>
                            <option value="">All Shops</option>
                            {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                        </select></div>
                    <div className="flex items-end">
                        <button onClick={fetchReport} disabled={loading}
                            className="w-full py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all"
                            style={{ backgroundColor: '#FF6B00' }}>
                            {loading ? 'Loading...' : 'Generate Report'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary */}
            {fetched && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[['Total Sales', summary.total_sale, 'text-emerald-600'], ['Total Cash', summary.total_cash, 'text-blue-600'], ['Total Online', summary.total_online, 'text-purple-600'], ['Total Expense', summary.total_expense, 'text-red-500']].map(([label, val, cls]) => (
                            <div key={label} className="rounded-xl p-4 shadow-sm border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                                <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                <p className={`text-xl font-bold ${cls}`}>₹{Number(val || 0).toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    {/* Actions + Table */}
                    <div className="rounded-xl shadow-sm border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
                        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Results ({reportData.length} records)</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={downloadCSV}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                                    <Download className="h-3.5 w-3.5" /> Download CSV
                                </button>
                                <button onClick={downloadPDF}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                                    <FileText className="h-3.5 w-3.5" /> Download PDF
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y">
                                <thead style={{ background: 'var(--bg-primary)' }}>
                                    <tr>{['Date', 'Shop', 'City', 'Total Sale', 'Cash', 'Paytm', 'Razorpay', 'Expense', 'Diff'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                                    ))}</tr>
                                </thead>
                                <tbody>
                                    {reportData.map((r, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{r.date?.split('T')[0]}</td>
                                            <td className="px-4 py-2 text-sm font-medium text-indigo-600">{r.shop_name}</td>
                                            <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.city_name}</td>
                                            <td className="px-4 py-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{r.total_sale}</td>
                                            <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{r.cash}</td>
                                            <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{r.paytm}</td>
                                            <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>₹{r.razorpay}</td>
                                            <td className="px-4 py-2 text-sm text-red-500">₹{r.expense}</td>
                                            <td className="px-4 py-2 text-sm">
                                                <span className={`font-semibold ${+r.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>₹{r.difference}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && <tr><td colSpan="9" className="text-center py-10 text-gray-400">No records found for selected filters</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
};

export default ReportsPage;
