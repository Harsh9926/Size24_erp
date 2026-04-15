import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const PrivateRoute = ({ children, allowedRoles }) => {
    const { user } = useContext(AuthContext);

    if (!user) {
        // Not logged in
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Role not authorized
        // Redirect to their respective dashboard
        if (user.role === 'admin') return <Navigate to="/admin" replace />;
        if (user.role === 'shop_user') return <Navigate to="/shop" replace />;
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default PrivateRoute;
