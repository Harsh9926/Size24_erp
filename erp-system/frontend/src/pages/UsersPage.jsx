import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import {
    UserPlus, Store, CheckCircle2, XCircle, Clock,
    Pencil, Trash2, KeyRound, X, Users, Search, Filter,
    Plus, Loader2,
} from 'lucide-react';

/* ── Shared styles ───────────────────────────────────────────────── */
const inputCls =
    'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none ' +
    'transition-colors focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white text-gray-800';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

const roleBadge = {
    admin:     'bg-purple-100 text-purple-700 border-purple-200',
    manager:   'bg-blue-100   text-blue-700   border-blue-200',
    shop_user: 'bg-teal-100   text-teal-700   border-teal-200',
};

/* ── Modal shell ─────────────────────────────────────────────────── */
const Modal = ({ title, onClose, children, wide }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
        <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800">{title}</h3>
                <button onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                    <X className="h-4 w-4 text-gray-500" />
                </button>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    </div>
);

/* ── Status toggle switch ─────────────────────────────────────────── */
const StatusToggle = ({ userId, status, loading, onToggle }) => {
    const active = status === 'active';
    return (
        <button
            onClick={() => onToggle(userId)}
            disabled={loading}
            title={active ? 'Click to deactivate' : 'Click to activate'}
            className={[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
                'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                active ? 'bg-green-500' : 'bg-gray-300',
                loading ? 'opacity-50 cursor-wait' : 'cursor-pointer',
            ].join(' ')}>
            <span className={[
                'inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200',
                active ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')} />
        </button>
    );
};

/* ══════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════ */
const UsersPage = () => {
    const [users,      setUsers]      = useState([]);
    const [shops,      setShops]      = useState([]);
    const [form,       setForm]       = useState({ name: '', mobile: '', password: '', role: 'shop_user' });
    const [assignForm, setAssignForm] = useState({ userId: '', shopId: '' });
    const [msg,        setMsg]        = useState({ text: '', type: '' });
    const [search,     setSearch]     = useState('');
    const [shopFilter, setShopFilter] = useState('');
    const [toggling,   setToggling]   = useState(null);

    const [editUser,  setEditUser]  = useState(null);
    const [editForm,  setEditForm]  = useState({ name: '', mobile: '', role: 'shop_user' });
    const [resetUser, setResetUser] = useState(null);
    const [newPwd,    setNewPwd]    = useState('');

    // Manage shops modal state
    const [manageModal, setManageModal] = useState(null);
    // { user, shops: [], loading, addShopId, addLoading }

    const loadAll = useCallback(async () => {
        const [u, s] = await Promise.all([api.get('/users'), api.get('/shops')]);
        setUsers(u.data);
        setShops(s.data);
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const notify = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 3500);
    };

    /* ── Create ─────────────────────────────────────────────────── */
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', form);
            setForm({ name: '', mobile: '', password: '', role: 'shop_user' });
            loadAll();
            notify('User created successfully!');
        } catch (err) { notify(err.response?.data?.error || 'Error creating user', 'error'); }
    };

    /* ── Assign shop (quick panel) ──────────────────────────────── */
    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            const res = await api.put(`/users/${assignForm.userId}/assign-shop`, { shopId: assignForm.shopId });
            setAssignForm({ userId: '', shopId: '' });
            loadAll();
            notify(res.data.message);
        } catch (err) { notify(err.response?.data?.error || 'Error assigning shop', 'error'); }
    };

    /* ── Approve / Reject ───────────────────────────────────────── */
    const handleApprove = async (id) => {
        try { await api.put(`/users/${id}/approve`); loadAll(); notify('User approved!'); }
        catch { notify('Error approving user', 'error'); }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Reject and deactivate this user?')) return;
        try { await api.delete(`/users/${id}/reject`); loadAll(); notify('User rejected.', 'warn'); }
        catch { notify('Error rejecting user', 'error'); }
    };

    /* ── Toggle active / inactive ───────────────────────────────── */
    const handleToggleStatus = async (userId) => {
        setToggling(userId);
        try {
            const res = await api.patch(`/users/${userId}/toggle-status`);
            setUsers(prev =>
                prev.map(u => u.id === userId ? { ...u, status: res.data.user.status } : u)
            );
            notify(res.data.message);
        } catch (err) {
            notify(err.response?.data?.error || 'Error updating status', 'error');
        } finally {
            setToggling(null);
        }
    };

    /* ── Edit ───────────────────────────────────────────────────── */
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
            notify('User updated!');
        } catch (err) { notify(err.response?.data?.error || 'Error updating user', 'error'); }
    };

    /* ── Reset password ─────────────────────────────────────────── */
    const handleResetPwd = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/users/${resetUser.id}/reset-password`, { password: newPwd });
            setResetUser(null); setNewPwd('');
            notify('Password reset successfully!');
        } catch (err) { notify(err.response?.data?.error || 'Error resetting password', 'error'); }
    };

    /* ── Remove user ────────────────────────────────────────────── */
    const handleDelete = async (u) => {
        if (!window.confirm(`Remove "${u.name || u.mobile}" from the system? This will deactivate their account.`)) return;
        try {
            await api.delete(`/users/${u.id}`);
            loadAll();
            notify('User removed.', 'warn');
        } catch (err) { notify(err.response?.data?.error || 'Error removing user', 'error'); }
    };

    /* ── Manage shops modal ─────────────────────────────────────── */
    const openManageModal = async (user) => {
        setManageModal({ user, shops: [], loading: true, addShopId: '', addLoading: false });
        try {
            const res = await api.get(`/users/${user.id}/shops`);
            setManageModal(prev => prev ? { ...prev, shops: res.data, loading: false } : null);
        } catch {
            setManageModal(prev => prev ? { ...prev, loading: false } : null);
        }
    };

    const handleUnassignInModal = async (shopId) => {
        const userId = manageModal.user.id;
        try {
            await api.delete(`/users/${userId}/shops/${shopId}`);
            setManageModal(prev => prev ? ({
                ...prev,
                shops: prev.shops.filter(s => s.id !== shopId),
            }) : null);
            setUsers(prev => prev.map(u =>
                u.id === userId
                    ? { ...u, assigned_shops: (u.assigned_shops || []).filter(s => s.id !== shopId) }
                    : u
            ));
            notify('Shop removed from user.');
        } catch (err) {
            notify(err.response?.data?.error || 'Error removing shop', 'error');
        }
    };

    const handleAddInModal = async () => {
        if (!manageModal?.addShopId) return;
        const userId = manageModal.user.id;
        setManageModal(prev => prev ? { ...prev, addLoading: true } : null);
        try {
            const res = await api.put(`/users/${userId}/assign-shop`, { shopId: manageModal.addShopId });
            // Reload the user's shop list
            const shopsRes = await api.get(`/users/${userId}/shops`);
            setManageModal(prev => prev ? ({
                ...prev,
                shops: shopsRes.data,
                addShopId: '',
                addLoading: false,
            }) : null);
            // Update the users list
            setUsers(prev => prev.map(u =>
                u.id === userId
                    ? { ...u, assigned_shops: shopsRes.data.map(s => ({ id: s.id, name: s.shop_name })) }
                    : u
            ));
            notify(res.data.message);
        } catch (err) {
            setManageModal(prev => prev ? { ...prev, addLoading: false } : null);
            notify(err.response?.data?.error || 'Error adding shop', 'error');
        }
    };

    /* ── Derived data ───────────────────────────────────────────── */
    const pending  = users.filter(u => !u.is_approved);
    const approved = users.filter(u => u.is_approved);

    const filtered = approved.filter(u => {
        const q = search.toLowerCase();
        const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.mobile.includes(q);
        // Match against any assigned shop
        const matchShop = !shopFilter ||
            (u.assigned_shops || []).some(s => String(s.id) === shopFilter);
        return matchSearch && matchShop;
    });

    const activeCount   = approved.filter(u => u.status === 'active').length;
    const inactiveCount = approved.length - activeCount;

    // Shops already assigned in the manage modal (for excluding from "add" dropdown)
    const modalAssignedShopIds = new Set((manageModal?.shops || []).map(s => s.id));

    /* ── Render ─────────────────────────────────────────────────── */
    return (
        <Layout title="User Management">

            {/* Toast notification */}
            {msg.text && (
                <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
                    msg.type === 'error' ? 'bg-red-50   border-red-200   text-red-700'   :
                    msg.type === 'warn'  ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                          'bg-green-50 border-green-200 text-green-700'}`}>
                    {msg.type === 'error'
                        ? <XCircle className="h-4 w-4 shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* ── Stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Users', value: approved.length, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
                    { label: 'Active',      value: activeCount,     color: 'text-green-600',  bg: 'bg-green-50  border-green-100'  },
                    { label: 'Inactive',    value: inactiveCount,   color: 'text-gray-500',   bg: 'bg-gray-50   border-gray-100'   },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`rounded-xl p-4 border ${bg}`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                        <p className={`text-2xl font-extrabold mt-0.5 ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Pending Approvals ──────────────────────────────── */}
            {pending.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                    <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Pending Approvals ({pending.length})
                    </h3>
                    <div className="space-y-2">
                        {pending.map(u => (
                            <div key={u.id}
                                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-100 shadow-sm">
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{u.name || '(No Name)'}</p>
                                    <p className="text-xs text-gray-500 font-mono">
                                        {u.mobile} · <span className="font-semibold">{u.role}</span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleApprove(u.id)}
                                        className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                    </button>
                                    <button onClick={() => handleReject(u.id)}
                                        className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <XCircle className="h-3.5 w-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Create + Assign ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* Create user */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-indigo-500" /> Add New User
                    </h3>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div>
                            <label className={labelCls}>Full Name</label>
                            <input className={inputCls} value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Full name" />
                        </div>
                        <div>
                            <label className={labelCls}>Mobile Number</label>
                            <input className={inputCls} value={form.mobile}
                                onChange={e => setForm({ ...form, mobile: e.target.value })}
                                placeholder="10-digit mobile" required />
                        </div>
                        <div>
                            <label className={labelCls}>Password</label>
                            <input type="password" className={inputCls} value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder="Set password" required />
                        </div>
                        <div>
                            <label className={labelCls}>Role</label>
                            <select className={inputCls} value={form.role}
                                onChange={e => setForm({ ...form, role: e.target.value })}>
                                <option value="shop_user">Shop User</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-400">
                            Manager &amp; Shop User accounts are activated instantly.
                            Admin accounts require approval before login.
                        </p>
                        <button type="submit"
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors">
                            Create User
                        </button>
                    </form>
                </div>

                {/* Assign shop (quick panel) */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Store className="h-4 w-4 text-teal-500" /> Add User to Shop
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                        Adds the user to the selected shop. Existing shop assignments are kept.
                    </p>
                    <form onSubmit={handleAssign} className="space-y-3">
                        <div>
                            <label className={labelCls}>Select User</label>
                            <select className={inputCls} value={assignForm.userId}
                                onChange={e => setAssignForm({ ...assignForm, userId: e.target.value })} required>
                                <option value="">— Select user —</option>
                                {users.filter(u => u.is_approved).map(u => {
                                    const shopCount = u.assigned_shops?.length || 0;
                                    return (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.mobile}
                                            {shopCount > 0 ? ` (${shopCount} shop${shopCount > 1 ? 's' : ''})` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Select Shop</label>
                            <select className={inputCls} value={assignForm.shopId}
                                onChange={e => setAssignForm({ ...assignForm, shopId: e.target.value })} required>
                                <option value="">— Select shop —</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                        </div>
                        <button type="submit"
                            className="w-full py-2.5 mt-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                            <Plus className="h-4 w-4" /> Add to Shop
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Users Table ────────────────────────────────────── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Table toolbar */}
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Users className="h-4 w-4 text-indigo-500 shrink-0" />
                        <h3 className="text-sm font-bold text-gray-800 truncate">
                            All Users
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                                ({filtered.length} shown)
                            </span>
                        </h3>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search name / mobile…"
                            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 w-44" />
                    </div>

                    {/* Shop filter */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <select value={shopFilter} onChange={e => setShopFilter(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400">
                            <option value="">All shops</option>
                            {shops.map(s => (
                                <option key={s.id} value={String(s.id)}>{s.shop_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Name & Mobile', 'Role', 'Shops', 'Active Status', 'Actions'].map(h => (
                                    <th key={h}
                                        className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-14 text-center text-sm text-gray-400">
                                        No users found
                                    </td>
                                </tr>
                            )}
                            {filtered.map(u => {
                                const isActive      = u.status === 'active';
                                const assignedShops = u.assigned_shops || [];
                                return (
                                    <tr key={u.id}
                                        className={`transition-colors hover:bg-gray-50 ${!isActive ? 'opacity-55' : ''}`}>

                                        {/* Name + Mobile */}
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-semibold text-gray-800 leading-tight">
                                                {u.name || '—'}
                                            </p>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{u.mobile}</p>
                                        </td>

                                        {/* Role badge */}
                                        <td className="px-5 py-3.5">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${roleBadge[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {u.role?.replace('_', ' ')}
                                            </span>
                                        </td>

                                        {/* Shops — all assignments */}
                                        <td className="px-5 py-3.5">
                                            {assignedShops.length === 0 ? (
                                                <button
                                                    onClick={() => openManageModal(u)}
                                                    className="text-xs text-gray-300 hover:text-teal-500 transition-colors"
                                                    title="Assign shops">
                                                    — add
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => openManageModal(u)}
                                                    className="flex items-center gap-1.5 text-left group"
                                                    title="Manage shops">
                                                    <span className="text-sm font-medium text-teal-600 group-hover:text-teal-700">
                                                        {assignedShops[0].name}
                                                    </span>
                                                    {assignedShops.length > 1 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 rounded-full whitespace-nowrap">
                                                            +{assignedShops.length - 1}
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </td>

                                        {/* Status toggle */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <StatusToggle
                                                    userId={u.id}
                                                    status={u.status}
                                                    loading={toggling === u.id}
                                                    onToggle={handleToggleStatus}
                                                />
                                                <span className={`text-xs font-semibold ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openManageModal(u)} title="Manage shops"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                                                    <Store className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => openEdit(u)} title="Edit user"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => { setResetUser(u); setNewPwd(''); }} title="Reset password"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                                                    <KeyRound className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => handleDelete(u)} title="Remove user"
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Manage Shops Modal ──────────────────────────────── */}
            {manageModal && (
                <Modal
                    title={`Shops — ${manageModal.user.name || manageModal.user.mobile}`}
                    onClose={() => setManageModal(null)}
                    wide>
                    {/* Current assignments */}
                    <div className="mb-5">
                        <p className={labelCls}>Assigned Shops</p>
                        {manageModal.loading ? (
                            <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : manageModal.shops.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No shops assigned yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {manageModal.shops.map(s => (
                                    <div key={s.id}
                                        className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{s.shop_name}</p>
                                            {s.assigned_at && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    Added {new Date(s.assigned_at).toLocaleDateString('en-IN')}
                                                    {s.assigned_by_name ? ` by ${s.assigned_by_name}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleUnassignInModal(s.id)}
                                            title="Remove from this shop"
                                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add to another shop */}
                    <div className="border-t border-gray-100 pt-4">
                        <p className={labelCls}>Add to Shop</p>
                        <div className="flex gap-2">
                            <select
                                value={manageModal.addShopId}
                                onChange={e => setManageModal(prev => prev ? { ...prev, addShopId: e.target.value } : null)}
                                className={inputCls + ' flex-1'}>
                                <option value="">— Select shop —</option>
                                {shops
                                    .filter(s => !modalAssignedShopIds.has(s.id))
                                    .map(s => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                            </select>
                            <button
                                onClick={handleAddInModal}
                                disabled={!manageModal.addShopId || manageModal.addLoading}
                                className="px-4 py-2.5 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                                {manageModal.addLoading
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Plus className="h-4 w-4" />}
                                Add
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Edit User Modal ─────────────────────────────────── */}
            {editUser && (
                <Modal title={`Edit — ${editUser.name || editUser.mobile}`} onClose={() => setEditUser(null)}>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <div>
                            <label className={labelCls}>Full Name</label>
                            <input className={inputCls} value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Full name" required />
                        </div>
                        <div>
                            <label className={labelCls}>Mobile Number</label>
                            <input className={inputCls} value={editForm.mobile}
                                onChange={e => setEditForm({ ...editForm, mobile: e.target.value })}
                                placeholder="Mobile" required />
                        </div>
                        <div>
                            <label className={labelCls}>Role</label>
                            <select className={inputCls} value={editForm.role}
                                onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                <option value="shop_user">Shop User</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setEditUser(null)}
                                className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── Reset Password Modal ────────────────────────────── */}
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
                                className="flex-1 py-2.5 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-colors">
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
