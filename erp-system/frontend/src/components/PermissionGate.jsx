import React from 'react';
import { usePermissions } from '../context/PermissionsContext';

/**
 * PermissionGate — conditionally renders children based on module permission.
 *
 * Props:
 *   module   — RBAC module name, e.g. 'entries', 'shops'
 *   require  — 'VIEW' (default) or 'WRITE'
 *   fallback — what to render when the user lacks permission (default: null)
 *
 * Usage:
 *   <PermissionGate module="shops" require="WRITE">
 *       <button onClick={addShop}>Add Shop</button>
 *   </PermissionGate>
 *
 *   <PermissionGate module="entries" require="WRITE" fallback={<button disabled>Approve</button>}>
 *       <button onClick={approve}>Approve</button>
 *   </PermissionGate>
 */
const PermissionGate = ({ module, require: minLevel = 'VIEW', fallback = null, children }) => {
    const { hasAccess, canWrite } = usePermissions();

    const allowed = minLevel === 'WRITE' ? canWrite(module) : hasAccess(module);
    return allowed ? children : fallback;
};

export default PermissionGate;
