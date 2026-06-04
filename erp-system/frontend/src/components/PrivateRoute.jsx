import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import ForbiddenPage from '../pages/ForbiddenPage';

/**
 * PrivateRoute — guards a route by role and optional module permission.
 *
 * Props:
 *   allowedRoles — array of roles that may access this route
 *   module       — optional RBAC module name; if provided and the user
 *                  doesn't have at least VIEW, renders <ForbiddenPage>
 */
const PrivateRoute = ({ children, allowedRoles, module }) => {
    const { user }          = useContext(AuthContext);
    const { hasAccess, loading } = usePermissions();

    // Not logged in
    if (!user) return <Navigate to="/login" replace />;

    // Role check
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin')     return <Navigate to="/admin"   replace />;
        if (user.role === 'manager')   return <Navigate to="/manager" replace />;
        if (user.role === 'shop_user') return <Navigate to="/shop"    replace />;
        return <Navigate to="/login" replace />;
    }

    // Module permission check (admin always passes; wait until permissions are loaded)
    if (module && user.role !== 'admin') {
        if (loading) return null; // Brief blank while permissions load
        if (!hasAccess(module)) return <ForbiddenPage />;
    }

    return children;
};

export default PrivateRoute;
