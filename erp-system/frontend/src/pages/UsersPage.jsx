import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { UserPlus, Store, CheckCircle, XCircle, Clock, Pencil, Trash2, KeyRound, X } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";
const roleColors = { admin: 'bg-purple-100 text-purple-700', manager: 'bg-blue-100 text-blue-700', shop_user: 'bg-green-100 text-green-700' };

/* ── Small modal shell ──────────────────────────────────────────── */
const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">{title}</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                </button>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    </div>
);

const UsersPage = () => {
    const [users,      setUsers]      = useState([]);
    const [shops,      setShops]      = useState([]);
    const [form,       setForm]       = useState({ name: '', mobile: '', password: '', role: 'shop_user' });
    const [assignForm, setAssignForm] = useState({ userId: '', shopId: '' });
    const [msg,        setMsg]        = useState({ text: '', type: 'info' });

    // Edit modal
    const [editUser,   setEditUser]   = useState(null); // user object being edited
    const [editForm,   setEditForm]   = useState({ name: '', mobile: '', role: 'shop_user' });

    // Reset password modal
    const [resetUser,  setResetUser]  = useState(null); // user object
    const [newPwd,     setNewPwd]     = useState('');

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        const [u, s] = await Promise.all([api.get('/users'), api.get('/shops')]);
        setUsers(u.data);
        setShops(s.data);
    };

    const notify = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    };

    /* ── Create ─────────────────────────────────────────────────── */
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', form);
            setForm({ name: '', mobile: '', password: '', role: 'shop_user' });
            loadAll();
            notify('User created and approved automatically!');
        } catch (err) { notify(err.response?.data?.error || 'Error creating user', 'error'); }
    };

    /* ── Assign shop ─────────────────────────────────────────────── */
    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${assignForm.userId}/assign-shop`, { shopId: assignForm.shopId });
            loadAll();
            notify('Shop assigned!');
        } catch (err) { notify(err.response?.data?.error || 'Error assigning shop', 'error'); }
    };

    /* ── Approve / Reject (pending users) ───────────────────────── */
    const handleApprove = async (id) => {
        try { await api.put(`/users/${id}/approve`); loadAll(); notify('User approved!'); }
        catch (err) { notify('Error approving user', 'error'); }
    };

    const handleReject = async (id) => {
        if (!confirm('Reject and delete this user?')) return;
        try { await api.delete(`/users/${id}/reject`); loadAll(); notify('User rejected and removed.', 'warn'); }
        catch (err) { notify('Error rejecting user', 'error'); }
    };

    /* ── Edit user ───────────────────────────────────────────────── */
    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({ name: u.name || '', mobile: u.mobile, role: u.role });
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${editUser.id}`, editForm);
            setEditUser(null);
            loadAll();
            notify('User updated successfully!');
        } catch (err) { notify(err.response?.data?.error || 'Error updating user', 'error'); }
    };

    /* ── Reset password ──────────────────────────────────────────── */
    const handleResetPwd = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${resetUser.id}/reset-password`, { password: newPwd });
            setResetUser(null);
            setNewPwd('');
            notify('Password reset successfully!');
        } catch (err) { notify(err.response?.data?.error || 'Error resetting password', 'error'); }
    };

    /* ── Delete user ─────────────────────────────────────────────── */
    const handleDelete = async (u) => {
        if (!confirm(`Delete user "${u.name || u.mobile}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/users/${u.id}`);
            loadAll();
            notify('User deleted.', 'warn');
        } catch (err) { notify(err.response?.data?.error || 'Error deleting user', 'error'); }
    };

    const pendingUsers  = users.filter(u => !u.is_approved);
    const approvedUsers = users.filter(u => u.is_approved);

    return (
        <Layout title="User Management">
            {msg.text && (
                <div className={`mb-4 p-3 text-sm rounded-lg border ${
                    msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                    msg.type === 'warn'  ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                          'bg-green-50 border-green-200 text-green-700'}`}>
                    {msg.text}
                </div>
            )}

            {/* Pending Approvals */}
            {pendingUsers.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                    <h3 className="text-base font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <Clock className="h-5 w-5" /> Pending Approvals ({pendingUsers.length})
                    </h3>
                    <div className="space-y-2">
                        {pendingUsers.map(u => (
                            <div key={u.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-100 shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{u.name || '(No Name)'}</p>
                                    <p className="text-xs text-gray-500 font-mono">{u.mobile} · <span className="font-semibold">{u.role}</span></p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleApprove(u.id)}
                                        className="flex items-center gap-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors">
                                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button onClick={() => handleReject(u.id)}
                                        className="flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors">
                                        <XCircle className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Create User */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-indigo-500" /> Create New User
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div><label className={labelCls}>Full Name</label><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name" /></div>
                        <div><label className={labelCls}>Mobile Number</label><input className={inputCls} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="Mobile" required /></div>
                        <div><label className={labelCls}>Password</label><input type="password" className={inputCls} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password" required /></div>
                        <div>
                            <label className={labelCls}>Role</label>
                            <select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="shop_user">Shop User</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-400">Users created here are auto-approved.</p>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Create User</button>
                    </form>
                </div>

                {/* Assign Shop */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Store className="h-4 w-4 text-teal-500" /> Assign Shop to User
                    </h3>
                    <form onSubmit={handleAssign} className="space-y-4">
                        <div>
                            <label className={labelCls}>Select User (Shop Users)</label>
                            <select className={inputCls} value={assignForm.userId} onChange={e => setAssignForm({ ...assignForm, userId: e.target.value })} required>
                                <option value="">-- Select User --</option>
                                {users.filter(u => u.role === 'shop_user' && u.is_approved).map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.mobile} ({u.mobile}){u.shop_name ? ` → ${u.shop_name}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Select Shop</label>
                            <select className={inputCls} value={assignForm.shopId} onChange={e => setAssignForm({ ...assignForm, shopId: e.target.value })} required>
                                <option value="">-- Select Shop --</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="w-full py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors">Assign Shop</button>
                    </form>
                </div>
            </div>

            {/* All Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800">All Users ({approvedUsers.length} approved)</h3>
                    {pendingUsers.length > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{pendingUsers.length} pending</span>}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Name', 'Mobile', 'Role', 'Shop', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map(u => (
                                <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_approved ? 'bg-amber-50/40' : ''}`}>
                                    <td className="px-5 py-3 text-sm font-semibold text-gray-800">{u.name || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-gray-600 font-mono">{u.mobile}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                                            {u.role?.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-sm text-indigo-600">{u.shop_name || <span className="text-gray-400">—</span>}</td>
                                    <td className="px-5 py-3">
                                        {u.is_approved
                                            ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Approved</span>
                                            : <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Clock className="h-3.5 w-3.5" /> Pending</span>}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-1">
                                            {/* Edit */}
                                            <button onClick={() => openEdit(u)} title="Edit user"
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            {/* Reset Password */}
                                            <button onClick={() => { setResetUser(u); setNewPwd(''); }} title="Reset password"
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                                                <KeyRound className="h-3.5 w-3.5" />
                                            </button>
                                            {/* Delete */}
                                            <button onClick={() => handleDelete(u)} title="Delete user"
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && <tr><td colSpan="6" className="text-center py-10 text-gray-400">No users yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Edit User Modal ──────────────────────────────────── */}
            {editUser && (
                <Modal title={`Edit User — ${editUser.name || editUser.mobile}`} onClose={() => setEditUser(null)}>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div>
                            <label className={labelCls}>Full Name</label>
                            <input className={inputCls} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Full Name" required />
                        </div>
                        <div>
                            <label className={labelCls}>Mobile Number</label>
                            <input className={inputCls} value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} placeholder="Mobile" required />
                        </div>
                        <div>
                            <label className={labelCls}>Role</label>
                            <select className={inputCls} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                <option value="admin">Admin</option>
                                <option value="manager">Manager</option>
                                <option value="shop_user">Shop User</option>
                            </select>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setEditUser(null)}
                                className="flex-1 py-2 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── Reset Password Modal ─────────────────────────────── */}
            {resetUser && (
                <Modal title={`Reset Password — ${resetUser.name || resetUser.mobile}`} onClose={() => setResetUser(null)}>
                    <form onSubmit={handleResetPwd} className="space-y-4">
                        <div>
                            <label className={labelCls}>New Password</label>
                            <input type="password" className={inputCls} value={newPwd}
                                onChange={e => setNewPwd(e.target.value)}
                                placeholder="Enter new password" minLength={4} required />
                            <p className="text-xs text-gray-400 mt-1">Minimum 4 characters</p>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setResetUser(null)}
                                className="flex-1 py-2 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors">
                                Reset Password
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </Layout>
    );
};

export default UsersPage;
