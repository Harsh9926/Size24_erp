import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { FileText } from 'lucide-react';

const AuditLogsPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/audit').then(r => setLogs(r.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <Layout title="Audit Logs"><div className="text-center py-20 text-gray-400 animate-pulse">Loading logs...</div></Layout>;

    return (
        <Layout title="Audit Logs">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <h3 className="text-base font-semibold text-gray-800">System Audit Trail ({logs.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>{['Time', 'Table', 'Record ID', 'Edited By', 'Old Value', 'New Value'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-mono text-xs">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                                    <td className="px-5 py-3 font-semibold text-indigo-600">{log.table_name}</td>
                                    <td className="px-5 py-3 text-gray-700">#{log.record_id}</td>
                                    <td className="px-5 py-3 text-gray-600">{log.edited_by_name || log.edited_by_mobile || `#${log.edited_by}`}</td>
                                    <td className="px-5 py-3 text-red-500 max-w-xs truncate" title={JSON.stringify(log.old_value)}>{JSON.stringify(log.old_value)}</td>
                                    <td className="px-5 py-3 text-green-600 max-w-xs truncate" title={JSON.stringify(log.new_value)}>{JSON.stringify(log.new_value)}</td>
                                </tr>
                            ))}
                            {logs.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-gray-400 font-sans">No audit logs yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default AuditLogsPage;
