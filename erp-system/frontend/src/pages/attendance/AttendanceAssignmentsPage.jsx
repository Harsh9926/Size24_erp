import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { MapPin, Plus, Trash2, Search, Loader2, UserCheck, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

export default function AttendanceAssignmentsPage() {
    const { can } = usePermissions();
    const canEdit = can('attendance_assignments.edit');
    const [users, setUsers] = useState([]);
    const [allShops, setAllShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [manageModal, setManageModal] = useState(null); // { user, shops: [], loading, addShopId, addLoading }
    const [msg, setMsg] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, shopsRes] = await Promise.all([
                api.get('/attendance/assignments'),
                api.get('/shops'),
            ]);
            setUsers(usersRes.data);
            setAllShops(shopsRes.data);
        } catch (e) {
            console.error('[AttendanceAssignmentsPage] Load failed:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openManageModal = async (u) => {
        setManageModal({ user: u, shops: [], loading: true, addShopId: '', addLoading: false });
        try {
            const res = await api.get(`/attendance/assignments/user/${u.id}`);
            setManageModal(prev => prev ? { ...prev, shops: res.data, loading: false } : null);
        } catch (e) {
            console.error(e);
            setManageModal(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const handleAddShop = async () => {
        if (!manageModal?.addShopId) return;
        const shopId = manageModal.addShopId;
        const userId = manageModal.user.id;

        setManageModal(prev => prev ? { ...prev, addLoading: true } : null);
        try {
            await api.post(`/attendance/assignments/user/${userId}`, { shopId });
            const shopsRes = await api.get(`/attendance/assignments/user/${userId}`);
            setManageModal(prev => prev ? { ...prev, shops: shopsRes.data, addShopId: '', addLoading: false } : null);
            setMsg({ type: 'success', text: 'Attendance shop assigned successfully.' });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to assign shop');
            setManageModal(prev => prev ? { ...prev, addLoading: false } : null);
        }
    };

    const handleRemoveShop = async (shopId) => {
        if (!manageModal) return;
        const userId = manageModal.user.id;
        try {
            await api.delete(`/attendance/assignments/user/${userId}/shop/${shopId}`);
            setManageModal(prev => prev ? { ...prev, shops: prev.shops.filter(s => s.id !== shopId) } : null);
            setMsg({ type: 'success', text: 'Attendance shop unassigned.' });
            loadData();
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to remove shop');
        }
    };

    const filteredUsers = users.filter(u => {
        const query = search.toLowerCase();
        const nameMatch = (u.name || '').toLowerCase().includes(query);
        const mobileMatch = (u.mobile || '').includes(query);
        const shopMatch = (u.attendance_shops || []).some(s => (s.name || '').toLowerCase().includes(query));
        return nameMatch || mobileMatch || shopMatch;
    });

    const modalAssignedShopIds = new Set((manageModal?.shops || []).map(s => s.id));
    const availableShopsToAdd = allShops.filter(s => !modalAssignedShopIds.has(s.id));

    return (
        <Layout title="Attendance Assignments">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
                {/* Module Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-teal-700" /> Attendance Geofence Shop Assignments
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Independently assign employees to multiple shops strictly for <strong>Attendance Geofencing</strong>. These assignments do not affect daily sheet upload shop assignments.
                        </p>
                    </div>
                </div>

                {msg && (
                    <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <span className="flex items-center gap-2">
                            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {msg.text}
                        </span>
                        <button onClick={() => setMsg(null)} className="text-xs underline">Dismiss</button>
                    </div>
                )}

                {/* Filter & Search Bar */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search employee by name, mobile or assigned shop..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600"
                        />
                    </div>
                </div>

                {/* Employee Attendance Assignments Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-800">
                            Employees & Attendance Shops {!loading && `(${filteredUsers.length})`}
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Employee', 'Role', 'Status', 'Attendance Shops', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-10 text-gray-400">
                                            <Loader2 className="h-6 w-6 animate-spin inline mb-2" /><br />Loading assignments...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-10 text-gray-400">No employees found.</td>
                                    </tr>
                                ) : filteredUsers.map(u => {
                                    const attShops = u.attendance_shops || [];
                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                                <div>{u.name || 'Unnamed User'}</div>
                                                <div className="text-xs text-gray-400 font-mono font-normal">{u.mobile}</div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-gray-600 capitalize">
                                                <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md">{u.role}</span>
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {attShops.length === 0 ? (
                                                    <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md font-semibold">
                                                        No Attendance Shop Assigned
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {attShops.map(s => (
                                                            <span key={s.id} className="bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
                                                                <Building2 className="h-3 w-3 text-teal-600" />
                                                                {s.name}
                                                                {s.latitude != null && s.longitude != null ? (
                                                                    <span className="text-[10px] text-teal-600 font-mono">({s.geofence_radius_m || 50}m)</span>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 font-bold">⚠ No GPS</span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {canEdit ? (
                                                <button
                                                    onClick={() => openManageModal(u)}
                                                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-1.5"
                                                >
                                                    <MapPin className="h-3.5 w-3.5" /> Manage Shops ({attShops.length})
                                                </button>
                                                ) : (
                                                    <span className="text-gray-400">{attShops.length} shop(s)</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Manage Attendance Shops Modal */}
                {manageModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <div>
                                    <h3 className="text-base font-bold text-gray-800">
                                        Attendance Shops — {manageModal.user.name || manageModal.user.mobile}
                                    </h3>
                                    <p className="text-xs text-gray-500">Configure attendance geofence locations for this employee</p>
                                </div>
                                <button onClick={() => setManageModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div>
                                <label className={labelCls}>Assigned Attendance Shops</label>
                                {manageModal.loading ? (
                                    <div className="py-4 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
                                ) : manageModal.shops.length === 0 ? (
                                    <p className="text-xs text-amber-600 py-2">No attendance shops assigned yet. Select a shop below to assign.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {manageModal.shops.map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-800">{s.shop_name}</span>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        {s.latitude != null && s.longitude != null ? (
                                                            `📍 GPS: ${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)} · Radius: ${s.geofence_radius_m}m`
                                                        ) : (
                                                            <span className="text-amber-600 font-semibold">⚠ No GPS set on shop</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveShop(s.id)}
                                                    className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md flex items-center gap-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add Attendance Shop Section */}
                            <div className="pt-3 border-t border-gray-100">
                                <label className={labelCls}>Add Shop for Attendance</label>
                                <div className="flex gap-2">
                                    <select
                                        value={manageModal.addShopId}
                                        onChange={e => setManageModal(prev => prev ? { ...prev, addShopId: e.target.value } : null)}
                                        className={inputCls}
                                    >
                                        <option value="">-- Choose shop to add --</option>
                                        {availableShopsToAdd.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.shop_name} {s.latitude != null ? `(GPS ${s.geofence_radius_m || 50}m)` : '(No GPS)'}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddShop}
                                        disabled={!manageModal.addShopId || manageModal.addLoading}
                                        className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5"
                                    >
                                        {manageModal.addLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Shop
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setManageModal(null)}
                                    className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
