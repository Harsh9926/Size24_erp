import React, { useState, useEffect, useCallback } from 'react';
import {
    Lock, ChevronDown, Save, RefreshCw, CheckCircle2,
    AlertCircle, User, Shield, Eye, PenLine, Ban,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

/* ── Module definitions ────────────────────────────────────────── */
const MODULES = [
    { key: 'dashboard',    label: 'Dashboard',     desc: 'View admin/manager dashboard metrics' },
    { key: 'approvals',    label: 'Approvals',      desc: 'Approve or reject shop entries' },
    { key: 'shops',        label: 'Shops',          desc: 'Manage shop profiles and assignments' },
    { key: 'users',        label: 'Users',          desc: 'Create and manage user accounts' },
    { key: 'entries',      label: 'Entries',        desc: 'View and manage daily sales entries' },
    { key: 'expenses',     label: 'Expenses',       desc: 'Record and review expense transactions' },
    { key: 'manager_funds',label: 'Manager Funds',  desc: 'Monitor and transfer manager wallets' },
    { key: 'anomalies',    label: 'Anomalies',      desc: 'View detected anomalies and alerts' },
    { key: 'reports',      label: 'Reports',        desc: 'Generate and export sales reports' },
    { key: 'new_entry',      label: 'New Entry',      desc: 'Create manual entries for any shop' },
    { key: 'access_control', label: 'Access Control', desc: 'Manage module-level permissions for users' },
];

const LEVELS = [
    {
        value: 'NO_ACCESS',
        label: 'No Access',
        desc:  'Completely hidden from sidebar and blocked on all APIs',
        icon:  Ban,
        color: 'text-red-500',
        bg:    'bg-red-50 border-red-200',
        activeBg: 'bg-red-100 border-red-400',
    },
    {
        value: 'VIEW',
        label: 'View Only',
        desc:  'Can read data; Add / Edit / Delete / Approve actions are hidden',
        icon:  Eye,
        color: 'text-amber-500',
        bg:    'bg-amber-50 border-amber-200',
        activeBg: 'bg-amber-100 border-amber-400',
    },
    {
        value: 'WRITE',
        label: 'Full Access',
        desc:  'Complete read + write access to this module',
        icon:  PenLine,
        color: 'text-emerald-600',
        bg:    'bg-emerald-50 border-emerald-200',
        activeBg: 'bg-emerald-100 border-emerald-400',
    },
];

const ROLE_BADGE = {
    admin:    { label: 'Admin',     color: 'bg-orange-100 text-orange-700' },
    manager:  { label: 'Manager',   color: 'bg-blue-100 text-blue-700'     },
    shop_user:{ label: 'Shop User', color: 'bg-purple-100 text-purple-700' },
};

/* ── Helpers ────────────────────────────────────────────────────── */
const initialPerms = () => Object.fromEntries(MODULES.map(m => [m.key, 'NO_ACCESS']));

/* ── Phase 1: Entries action-level permissions ─────────────────────
   Keys must exactly match MODULE_ACTIONS.entries in
   backend/middleware/checkPermission.js — this is the frontend mirror. */
const ENTRY_ACTIONS = [
    { key: 'entries.view',    label: 'View',    desc: 'View daily sales entries' },
    { key: 'entries.create',  label: 'Create',  desc: 'Create a new daily sales entry (also covers submission)' },
    { key: 'entries.edit',    label: 'Edit',    desc: 'Edit an existing entry' },
    { key: 'entries.delete',  label: 'Delete',  desc: 'Permanently delete an entry' },
    { key: 'entries.submit',  label: 'Submit',  desc: 'Submit an entry for approval' },
    { key: 'entries.approve', label: 'Approve', desc: 'Approve a pending entry' },
    { key: 'entries.reject',  label: 'Reject',  desc: 'Reject a pending entry' },
    { key: 'entries.unlock',  label: 'Unlock',  desc: 'Unlock a locked entry for editing' },
    { key: 'entries.export',  label: 'Export',  desc: 'Export entries data', unimplemented: true },
];
const initialEntryActions = () => Object.fromEntries(ENTRY_ACTIONS.map(a => [a.key, false]));

/* ── Phase 2: Manager Funds action-level permissions ────────────────
   Keys must exactly match MODULE_ACTIONS.manager_funds in
   backend/middleware/checkPermission.js — this is the frontend mirror. */
const MANAGER_FUNDS_ACTIONS = [
    { key: 'manager_funds.view',            label: 'View',            desc: 'View fund transfers, wallets and bank ledger' },
    { key: 'manager_funds.transfer',        label: 'Transfer',        desc: 'Create a fund transfer' },
    { key: 'manager_funds.approve_transfer',label: 'Approve Transfer',desc: 'Accept/approve or reject a pending transfer' },
];
const initialManagerFundsActions = () => Object.fromEntries(MANAGER_FUNDS_ACTIONS.map(a => [a.key, false]));

/* ── Phase 3: Attendance module family action-level permissions ─────
   Keys must exactly match MODULE_ACTIONS.attendance* in
   backend/middleware/checkPermission.js — this is the frontend mirror. */
const ATTENDANCE_ACTIONS = [
    { key: 'attendance.view_own',  label: 'View Own',  desc: 'View own attendance / punch history' },
    { key: 'attendance.view_team', label: 'View Team',  desc: 'View team/shop attendance dashboard' },
    { key: 'attendance.punch',     label: 'Punch',      desc: 'Punch in / punch out' },
    { key: 'attendance.edit',      label: 'Edit',       desc: "Manually correct a day's attendance status" },
    { key: 'attendance.export',    label: 'Export',     desc: 'Export attendance data', unimplemented: true },
];
const ATTENDANCE_ASSIGNMENTS_ACTIONS = [
    { key: 'attendance_assignments.view', label: 'View', desc: 'View shop assignments' },
    { key: 'attendance_assignments.edit', label: 'Edit', desc: 'Assign or unassign an employee to/from a shop' },
];
const ATTENDANCE_APPROVALS_ACTIONS = [
    { key: 'attendance_approvals.view',    label: 'View',    desc: 'View pending registration and location-change requests' },
    { key: 'attendance_approvals.approve', label: 'Approve', desc: 'Approve a registration or location-change request' },
    { key: 'attendance_approvals.reject',  label: 'Reject',  desc: 'Reject a registration or location-change request' },
];
const ATTENDANCE_REPORTS_ACTIONS = [
    { key: 'attendance_reports.view',   label: 'View',   desc: 'View the monthly attendance report' },
    { key: 'attendance_reports.export', label: 'Export', desc: 'Export the attendance report as CSV/Excel' },
];
const ATTENDANCE_PAYROLL_ACTIONS = [
    { key: 'attendance_payroll.view',   label: 'View',   desc: 'View payroll / salary data' },
    { key: 'attendance_payroll.edit',   label: 'Edit',   desc: "Edit an employee's salary configuration" },
    { key: 'attendance_payroll.export', label: 'Export', desc: 'Export payroll data', unimplemented: true },
];
const ATTENDANCE_SETTINGS_ACTIONS = [
    { key: 'attendance_settings.view', label: 'View', desc: 'View attendance shift/geofence settings' },
    { key: 'attendance_settings.edit', label: 'Edit', desc: 'Edit attendance shift/geofence settings' },
];
const initialActionsFor = (list) => Object.fromEntries(list.map(a => [a.key, false]));

/* ── Reusable action-level permission accordion ─────────────────────
   Same pattern for every module: search, presets (scoped to THIS module
   only), Select All / Clear All, checkbox grid, granted counter. */
const ActionPermissionSection = ({ title, subtitle, actions, values, onToggle, onPreset, onSelectAll, onClearAll, search, onSearchChange, expanded, onToggleExpanded }) => (
    <div className="border-t" style={{ borderColor: 'var(--border-color)' }}>
        <button
            onClick={onToggleExpanded}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/[0.015] transition-colors"
        >
            <div className="flex items-center gap-2.5">
                <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} style={{ color: 'var(--text-secondary)' }} />
                <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
                </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(255,107,0,0.1)', color: '#FF6B00' }}>
                {Object.values(values).filter(Boolean).length}/{actions.length} granted
            </span>
        </button>

        {expanded && (
            <div className="px-5 pb-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                        <input
                            type="text"
                            value={search}
                            onChange={e => onSearchChange(e.target.value)}
                            placeholder={`Search ${title.split(' —')[0]} permissions…`}
                            className="w-full h-9 px-3 text-xs border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    {[
                        { label: 'No Access',   preset: 'none', cls: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
                        { label: 'View Only',   preset: 'view', cls: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
                        { label: 'Full Access', preset: 'full', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
                    ].map(({ label, preset, cls }) => (
                        <button key={preset} onClick={() => onPreset(preset)}
                            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${cls}`}>
                            {label}
                        </button>
                    ))}
                    <button onClick={onSelectAll} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100">
                        Select All
                    </button>
                    <button onClick={onClearAll} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100">
                        Clear All
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {actions
                        .filter(a => !search.trim() ||
                            a.label.toLowerCase().includes(search.trim().toLowerCase()) ||
                            a.desc.toLowerCase().includes(search.trim().toLowerCase()))
                        .map(a => (
                        <label key={a.key}
                            className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors select-none hover:bg-black/[0.02]"
                            style={{ borderColor: 'var(--border-color)', background: values[a.key] ? 'rgba(16,185,129,0.06)' : 'transparent' }}
                        >
                            <input
                                type="checkbox"
                                checked={!!values[a.key]}
                                onChange={() => onToggle(a.key)}
                                className="mt-0.5 h-4 w-4 rounded accent-emerald-600 flex-shrink-0"
                            />
                            <div className="min-w-0">
                                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                    {a.label}
                                    {a.unimplemented && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                            NOT YET ENFORCED
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {a.desc}{a.unimplemented ? ' — feature does not exist in the app yet; this toggle has no effect' : ''}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        )}
    </div>
);

/* ══════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════ */
const AccessControlPage = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [users,        setUsers]        = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [permissions,  setPermissions]  = useState(initialPerms());
    const [dirty,        setDirty]        = useState(false);

    // Phase 1: Entries granular (action-level) permissions
    const [entryActions,   setEntryActions]   = useState(initialEntryActions());
    const [entriesExpanded, setEntriesExpanded] = useState(true);
    const [entrySearch,     setEntrySearch]     = useState('');

    // Phase 2: Manager Funds granular (action-level) permissions
    const [managerFundsActions,  setManagerFundsActions]  = useState(initialManagerFundsActions());
    const [managerFundsExpanded, setManagerFundsExpanded] = useState(false);
    const [managerFundsSearch,   setManagerFundsSearch]   = useState('');

    // Phase 3: Attendance module family — 6 sub-modules, kept in one keyed
    // state object rather than duplicating the Phase 1/2 pattern 6x.
    const ATTENDANCE_MODULES = [
        { key: 'attendance',             title: 'Attendance — Detailed Permissions',             subtitle: "Exactly which of the employee's own/team attendance actions this user can perform", actions: ATTENDANCE_ACTIONS },
        { key: 'attendance_assignments', title: 'Attendance Assignments — Detailed Permissions', subtitle: 'Shop-assignment management for attendance',              actions: ATTENDANCE_ASSIGNMENTS_ACTIONS },
        { key: 'attendance_approvals',   title: 'Attendance Approvals — Detailed Permissions',   subtitle: 'Registration and location-change request approvals',    actions: ATTENDANCE_APPROVALS_ACTIONS },
        { key: 'attendance_reports',     title: 'Attendance Reports — Detailed Permissions',     subtitle: 'Monthly attendance report viewing and export',           actions: ATTENDANCE_REPORTS_ACTIONS },
        { key: 'attendance_payroll',     title: 'Attendance Payroll — Detailed Permissions',     subtitle: 'Salary configuration and payroll data',                  actions: ATTENDANCE_PAYROLL_ACTIONS },
        { key: 'attendance_settings',    title: 'Attendance Settings — Detailed Permissions',    subtitle: 'Shift timing and geofence configuration',                actions: ATTENDANCE_SETTINGS_ACTIONS },
    ];
    const [attendanceActions,  setAttendanceActions]  = useState(() =>
        Object.fromEntries(ATTENDANCE_MODULES.map(m => [m.key, initialActionsFor(m.actions)])));
    const [attendanceExpanded, setAttendanceExpanded] = useState(() =>
        Object.fromEntries(ATTENDANCE_MODULES.map(m => [m.key, false])));
    const [attendanceSearch,   setAttendanceSearch]   = useState(() =>
        Object.fromEntries(ATTENDANCE_MODULES.map(m => [m.key, ''])));

    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingPerms, setLoadingPerms] = useState(false);
    const [saving,       setSaving]       = useState(false);
    const [toast,        setToast]        = useState(null); // { type: 'success'|'error', msg }

    const [dropdownOpen, setDropdownOpen] = useState(false);

    /* ── Load user list ─────────────────────────────────────────── */
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get('/permissions/users');
                setUsers(res.data);
            } catch (err) {
                showToast('error', err.response?.data?.error || 'Failed to load users');
            } finally {
                setLoadingUsers(false);
            }
        })();
    }, []);

    /* ── Load permissions for selected user ─────────────────────── */
    const loadPermissions = useCallback(async (userId) => {
        setLoadingPerms(true);
        setDirty(false);
        try {
            const res = await api.get(`/permissions/${userId}`);
            // Merge with full defaults so all 10 modules always appear even if API returns partial data
            setPermissions({ ...initialPerms(), ...(res.data || {}) });
            const actions = res.data?.actions || {};
            setEntryActions({
                ...initialEntryActions(),
                ...Object.fromEntries(ENTRY_ACTIONS.map(a => [a.key, actions[a.key] === true])),
            });
            setManagerFundsActions({
                ...initialManagerFundsActions(),
                ...Object.fromEntries(MANAGER_FUNDS_ACTIONS.map(a => [a.key, actions[a.key] === true])),
            });
            setAttendanceActions(Object.fromEntries(ATTENDANCE_MODULES.map(m => [
                m.key,
                { ...initialActionsFor(m.actions), ...Object.fromEntries(m.actions.map(a => [a.key, actions[a.key] === true])) },
            ])));
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to load permissions');
            setPermissions(initialPerms());
            setEntryActions(initialEntryActions());
            setManagerFundsActions(initialManagerFundsActions());
            setAttendanceActions(Object.fromEntries(ATTENDANCE_MODULES.map(m => [m.key, initialActionsFor(m.actions)])));
        } finally {
            setLoadingPerms(false);
        }
    }, []);

    /* ── Warn before leaving the page with unsaved changes ───────── */
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    const handleSelectUser = (u) => {
        setSelectedUser(u);
        setDropdownOpen(false);
        loadPermissions(u.id);
    };

    /* ── Permission change ───────────────────────────────────────── */
    const handleChange = (moduleKey, level) => {
        setPermissions(p => ({ ...p, [moduleKey]: level }));
        setDirty(true);
    };

    /* ── Entries action toggle (Phase 1) ─────────────────────────── */
    const toggleEntryAction = (actionKey) => {
        setEntryActions(a => ({ ...a, [actionKey]: !a[actionKey] }));
        setDirty(true);
    };

    const applyEntriesPreset = (preset) => {
        // Scoped to Entries ONLY — never touches other modules' permissions.
        if (preset === 'full') {
            setEntryActions(Object.fromEntries(ENTRY_ACTIONS.map(a => [a.key, true])));
        } else if (preset === 'view') {
            setEntryActions(Object.fromEntries(ENTRY_ACTIONS.map(a => [a.key, a.key === 'entries.view'])));
        } else if (preset === 'none') {
            setEntryActions(initialEntryActions());
        }
        setDirty(true);
    };

    const entrySelectAll = () => { setEntryActions(Object.fromEntries(ENTRY_ACTIONS.map(a => [a.key, true]))); setDirty(true); };
    const entryClearAll  = () => { setEntryActions(initialEntryActions()); setDirty(true); };

    /* ── Manager Funds action toggle (Phase 2) ───────────────────── */
    const toggleManagerFundsAction = (actionKey) => {
        setManagerFundsActions(a => ({ ...a, [actionKey]: !a[actionKey] }));
        setDirty(true);
    };

    const applyManagerFundsPreset = (preset) => {
        // Scoped to Manager Funds ONLY — never touches other modules' permissions.
        if (preset === 'full') {
            setManagerFundsActions(Object.fromEntries(MANAGER_FUNDS_ACTIONS.map(a => [a.key, true])));
        } else if (preset === 'view') {
            setManagerFundsActions(Object.fromEntries(MANAGER_FUNDS_ACTIONS.map(a => [a.key, a.key === 'manager_funds.view'])));
        } else if (preset === 'none') {
            setManagerFundsActions(initialManagerFundsActions());
        }
        setDirty(true);
    };

    const managerFundsSelectAll = () => { setManagerFundsActions(Object.fromEntries(MANAGER_FUNDS_ACTIONS.map(a => [a.key, true]))); setDirty(true); };
    const managerFundsClearAll  = () => { setManagerFundsActions(initialManagerFundsActions()); setDirty(true); };

    /* ── Attendance module family action toggle (Phase 3) ────────── */
    // Generic across all 6 attendance sub-modules — keyed by module.
    const findAttendanceModule = (moduleKey) => ATTENDANCE_MODULES.find(m => m.key === moduleKey);

    const toggleAttendanceAction = (moduleKey, actionKey) => {
        setAttendanceActions(s => ({ ...s, [moduleKey]: { ...s[moduleKey], [actionKey]: !s[moduleKey][actionKey] } }));
        setDirty(true);
    };

    const applyAttendancePreset = (moduleKey, preset) => {
        // Scoped to THIS attendance sub-module only.
        const mod = findAttendanceModule(moduleKey);
        setAttendanceActions(s => {
            let next;
            if (preset === 'full') next = Object.fromEntries(mod.actions.map(a => [a.key, true]));
            else if (preset === 'view') next = Object.fromEntries(mod.actions.map(a => [a.key, a.key.endsWith('.view') || a.key.endsWith('.view_own')]));
            else next = initialActionsFor(mod.actions);
            return { ...s, [moduleKey]: next };
        });
        setDirty(true);
    };

    const attendanceSelectAll = (moduleKey) => {
        const mod = findAttendanceModule(moduleKey);
        setAttendanceActions(s => ({ ...s, [moduleKey]: Object.fromEntries(mod.actions.map(a => [a.key, true])) }));
        setDirty(true);
    };
    const attendanceClearAll = (moduleKey) => {
        const mod = findAttendanceModule(moduleKey);
        setAttendanceActions(s => ({ ...s, [moduleKey]: initialActionsFor(mod.actions) }));
        setDirty(true);
    };

    /* ── Save ───────────────────────────────────────────────────── */
    const handleSave = async () => {
        if (!selectedUser || !dirty) return;
        setSaving(true);
        try {
            await api.put(`/permissions/${selectedUser.id}`, {
                permissions,
                actionPermissions: {
                    ...entryActions,
                    ...managerFundsActions,
                    ...Object.assign({}, ...Object.values(attendanceActions)),
                },
            });
            setDirty(false);
            showToast('success', `Permissions updated for ${selectedUser.name || selectedUser.mobile}`);
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    };

    /* ── Bulk presets ───────────────────────────────────────────── */
    const applyPreset = (level) => {
        setPermissions(Object.fromEntries(MODULES.map(m => [m.key, level])));
        setDirty(true);
    };

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    /* ── Render ─────────────────────────────────────────────────── */
    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 md:ml-64">

                {/* Top bar */}
                <header
                    className="flex items-center gap-4 px-4 md:px-6 py-4 border-b flex-shrink-0"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                >
                    <button
                        className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,107,0,0.12)' }}
                        >
                            <Lock className="h-5 w-5" style={{ color: '#FF6B00' }} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                                Access Control
                            </h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Manage module-level permissions for each user
                            </p>
                        </div>
                    </div>

                    {/* Save button — top-right */}
                    <div className="ml-auto flex items-center gap-3">
                        {dirty && selectedUser && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                                style={{ background: '#FF6B00' }}
                            >
                                {saving
                                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                                    : <Save className="h-4 w-4" />
                                }
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </header>

                {/* Body */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

                    {/* User selector card */}
                    <div
                        className="rounded-2xl border p-5"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                    >
                        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
                            Select User
                        </label>

                        {loadingUsers ? (
                            <div className="h-11 rounded-xl animate-pulse" style={{ background: 'var(--bg-primary)' }} />
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(o => !o)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm text-left transition-colors"
                                    style={{
                                        background: 'var(--bg-primary)',
                                        borderColor: dropdownOpen ? '#FF6B00' : 'var(--border-color)',
                                        color: 'var(--text-primary)',
                                        boxShadow: dropdownOpen ? '0 0 0 2px rgba(255,107,0,0.18)' : 'none',
                                    }}
                                >
                                    <User className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                                    {selectedUser ? (
                                        <span className="flex-1 flex items-center gap-2">
                                            <span className="font-medium">{selectedUser.name || selectedUser.mobile}</span>
                                            {ROLE_BADGE[selectedUser.role] && (
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[selectedUser.role].color}`}>
                                                    {ROLE_BADGE[selectedUser.role].label}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>
                                            Choose a user to configure…
                                        </span>
                                    )}
                                    <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                                </button>

                                {dropdownOpen && (
                                    <div
                                        className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border shadow-xl z-20 overflow-hidden"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                                    >
                                        {users.length === 0 ? (
                                            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>No users found</p>
                                        ) : (
                                            <div className="max-h-60 overflow-y-auto py-1">
                                                {users.map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => handleSelectUser(u)}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-orange-50"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <div
                                                            className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                                                            style={{ background: 'rgba(255,107,0,0.15)', color: '#FF6B00' }}
                                                        >
                                                            {(u.name || u.mobile || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">{u.name || u.mobile}</p>
                                                            {u.name && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{u.mobile}</p>}
                                                        </div>
                                                        {ROLE_BADGE[u.role] && (
                                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_BADGE[u.role].color}`}>
                                                                {ROLE_BADGE[u.role].label}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Permission matrix */}
                    {selectedUser && (
                        <div
                            className="rounded-2xl border overflow-hidden"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                        >
                            {/* Matrix header */}
                            <div
                                className="flex items-center justify-between px-5 py-4 border-b"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" style={{ color: '#FF6B00' }} />
                                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                        Permissions for{' '}
                                        <span style={{ color: '#FF6B00' }}>
                                            {selectedUser.name || selectedUser.mobile}
                                        </span>
                                    </span>
                                </div>

                                {/* Bulk presets */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs hidden sm:block" style={{ color: 'var(--text-secondary)' }}>Quick set:</span>
                                    {[
                                        { label: 'All No Access', value: 'NO_ACCESS', cls: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' },
                                        { label: 'All View',      value: 'VIEW',      cls: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
                                        { label: 'All Write',     value: 'WRITE',     cls: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
                                    ].map(({ label, value, cls }) => (
                                        <button
                                            key={value}
                                            onClick={() => applyPreset(value)}
                                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors hidden sm:block ${cls}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {loadingPerms ? (
                                <div className="p-6 space-y-3">
                                    {MODULES.map(m => (
                                        <div key={m.key} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-primary)' }} />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {/* Column headers — desktop only */}
                                    <div
                                        className="hidden md:grid grid-cols-[1fr_repeat(3,_180px)] px-5 py-2.5 border-b text-xs font-semibold uppercase tracking-wide"
                                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                                    >
                                        <span>Module</span>
                                        <span className="text-center text-red-500">No Access</span>
                                        <span className="text-center text-amber-500">View Only</span>
                                        <span className="text-center text-emerald-600">Write</span>
                                    </div>

                                    {/* Module rows */}
                                    <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                                        {MODULES.map((mod, idx) => {
                                            const current = permissions[mod.key] || 'NO_ACCESS';
                                            return (
                                                <div
                                                    key={mod.key}
                                                    className={`px-5 py-4 transition-colors ${idx % 2 === 0 ? '' : 'opacity-95'}`}
                                                    style={{ background: idx % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}
                                                >
                                                    {/* Mobile layout: stacked */}
                                                    <div className="md:hidden mb-3">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{mod.label}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{mod.desc}</p>
                                                    </div>

                                                    {/* Desktop: grid row */}
                                                    <div className="md:grid md:grid-cols-[1fr_repeat(3,_180px)] md:items-center gap-2">

                                                        {/* Module info — desktop */}
                                                        <div className="hidden md:block">
                                                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{mod.label}</p>
                                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{mod.desc}</p>
                                                        </div>

                                                        {/* Radio buttons */}
                                                        <div className="flex gap-2 md:contents">
                                                            {LEVELS.map(({ value, label, icon: Icon, color, bg, activeBg }) => {
                                                                const isActive = current === value;
                                                                return (
                                                                    <label
                                                                        key={value}
                                                                        className={`flex-1 md:mx-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${isActive ? activeBg : bg} hover:brightness-95`}
                                                                    >
                                                                        <input
                                                                            type="radio"
                                                                            name={`perm-${mod.key}`}
                                                                            value={value}
                                                                            checked={isActive}
                                                                            onChange={() => handleChange(mod.key, value)}
                                                                            className="sr-only"
                                                                        />
                                                                        {/* Custom radio indicator */}
                                                                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'border-current' : 'border-gray-300'}`}
                                                                            style={{ color: isActive ? undefined : 'transparent' }}>
                                                                            {isActive && (
                                                                                <div className="h-2 w-2 rounded-full" style={{ background: 'currentColor' }} />
                                                                            )}
                                                                        </div>
                                                                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
                                                                        <span className={`text-xs font-semibold ${color}`}>{label}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ── Phase 1: Entries granular (action-level) permissions ── */}
                                    <ActionPermissionSection
                                        title="Entries — Detailed Permissions"
                                        subtitle="Exactly which entry actions this user can perform"
                                        actions={ENTRY_ACTIONS}
                                        values={entryActions}
                                        onToggle={toggleEntryAction}
                                        onPreset={applyEntriesPreset}
                                        onSelectAll={entrySelectAll}
                                        onClearAll={entryClearAll}
                                        search={entrySearch}
                                        onSearchChange={setEntrySearch}
                                        expanded={entriesExpanded}
                                        onToggleExpanded={() => setEntriesExpanded(o => !o)}
                                    />

                                    {/* ── Phase 2: Manager Funds granular (action-level) permissions ── */}
                                    <ActionPermissionSection
                                        title="Manager Funds — Detailed Permissions"
                                        subtitle="Exactly which fund-transfer actions this user can perform"
                                        actions={MANAGER_FUNDS_ACTIONS}
                                        values={managerFundsActions}
                                        onToggle={toggleManagerFundsAction}
                                        onPreset={applyManagerFundsPreset}
                                        onSelectAll={managerFundsSelectAll}
                                        onClearAll={managerFundsClearAll}
                                        search={managerFundsSearch}
                                        onSearchChange={setManagerFundsSearch}
                                        expanded={managerFundsExpanded}
                                        onToggleExpanded={() => setManagerFundsExpanded(o => !o)}
                                    />

                                    {/* ── Phase 3: Attendance module family (6 sub-modules) ── */}
                                    {ATTENDANCE_MODULES.map(mod => (
                                        <ActionPermissionSection
                                            key={mod.key}
                                            title={mod.title}
                                            subtitle={mod.subtitle}
                                            actions={mod.actions}
                                            values={attendanceActions[mod.key]}
                                            onToggle={(actionKey) => toggleAttendanceAction(mod.key, actionKey)}
                                            onPreset={(preset) => applyAttendancePreset(mod.key, preset)}
                                            onSelectAll={() => attendanceSelectAll(mod.key)}
                                            onClearAll={() => attendanceClearAll(mod.key)}
                                            search={attendanceSearch[mod.key]}
                                            onSearchChange={(v) => setAttendanceSearch(s => ({ ...s, [mod.key]: v }))}
                                            expanded={attendanceExpanded[mod.key]}
                                            onToggleExpanded={() => setAttendanceExpanded(s => ({ ...s, [mod.key]: !s[mod.key] }))}
                                        />
                                    ))}

                                    {/* Footer save */}
                                    {dirty && (
                                        <div
                                            className="flex items-center justify-between px-5 py-4 border-t"
                                            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
                                        >
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                You have unsaved changes. Changes apply immediately after saving.
                                            </p>
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                                                style={{ background: '#FF6B00' }}
                                            >
                                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                {saving ? 'Saving…' : 'Save Changes'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {!selectedUser && !loadingUsers && (
                        <div
                            className="rounded-2xl border flex flex-col items-center justify-center py-20 text-center"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
                        >
                            <div
                                className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'rgba(255,107,0,0.1)' }}
                            >
                                <Lock className="h-8 w-8" style={{ color: '#FF6B00' }} />
                            </div>
                            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                Select a user above
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Choose any user to view or configure their module permissions.
                            </p>
                        </div>
                    )}
                </main>
            </div>

            {/* Toast notification */}
            {toast && (
                <div
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all"
                    style={{
                        background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        borderColor: toast.type === 'success' ? '#bbf7d0' : '#fecaca',
                        color: toast.type === 'success' ? '#15803d' : '#b91c1c',
                    }}
                >
                    {toast.type === 'success'
                        ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                        : <AlertCircle  className="h-5 w-5 flex-shrink-0 text-red-500"     />
                    }
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default AccessControlPage;
