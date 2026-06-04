import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from './AuthContext';
import api from '../services/api';

export const PermissionsContext = createContext({
    permissions:        {},
    loading:            true,
    hasAccess:          () => true,
    canWrite:           () => true,
    getPermission:      () => 'WRITE',
    refreshPermissions: () => {},
});

const POLL_INTERVAL_MS = 30_000; // re-fetch every 30 s so admin changes take effect quickly

export const PermissionsProvider = ({ children }) => {
    const { user } = useContext(AuthContext);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading]         = useState(true);
    const timerRef = useRef(null);

    const fetchPermissions = useCallback(async () => {
        if (!user) {
            setPermissions({});
            setLoading(false);
            return;
        }
        // Admin has implicit WRITE on everything — no server round-trip needed
        if (user.role === 'admin') {
            setPermissions({});
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('/permissions/me');
            setPermissions(res.data || {});
        } catch {
            // Keep previous permissions on transient errors
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.role]);   // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch on user change + poll for live admin updates
    useEffect(() => {
        setLoading(true);
        fetchPermissions();

        if (timerRef.current) clearInterval(timerRef.current);
        if (user && user.role !== 'admin') {
            timerRef.current = setInterval(fetchPermissions, POLL_INTERVAL_MS);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [user?.id, user?.role]);   // eslint-disable-line react-hooks/exhaustive-deps

    // Also re-fetch when the user returns to the tab (instant feedback after admin update)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && user && user.role !== 'admin') {
                fetchPermissions();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchPermissions]);

    const hasAccess = useCallback((module) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        const p = permissions[module];
        return p === 'VIEW' || p === 'WRITE';
    }, [user, permissions]);

    const canWrite = useCallback((module) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        return permissions[module] === 'WRITE';
    }, [user, permissions]);

    const getPermission = useCallback((module) => {
        if (!user) return 'NO_ACCESS';
        if (user.role === 'admin') return 'WRITE';
        return permissions[module] ?? 'NO_ACCESS';
    }, [user, permissions]);

    return (
        <PermissionsContext.Provider value={{
            permissions,
            loading,
            hasAccess,
            canWrite,
            getPermission,
            refreshPermissions: fetchPermissions,
        }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => useContext(PermissionsContext);
