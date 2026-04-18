import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';

// Auth Pages
import LoginPage    from './pages/LoginPage';
import SignupPage   from './pages/SignupPage';

// Admin Pages
import AdminDashboard   from './pages/AdminDashboard';
import AdminApprovalPage from './pages/AdminApprovalPage';
import ShopsPage        from './pages/ShopsPage';
import UsersPage        from './pages/UsersPage';
import EntriesPage      from './pages/EntriesPage';
import CashFlowPage     from './pages/CashFlowPage';
import AuditLogsPage    from './pages/AuditLogsPage';
import ReportsPage      from './pages/ReportsPage';
import ExcelUploadPage  from './pages/ExcelUploadPage';

// Manager Pages
import ManagerDashboard from './pages/ManagerDashboard';

// Shop User Pages
import ShopDashboard from './pages/ShopDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Admin-only Routes */}
        <Route path="/admin"            element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/approvals"  element={<PrivateRoute allowedRoles={['admin', 'manager']}><AdminApprovalPage /></PrivateRoute>} />
        <Route path="/admin/shops"      element={<PrivateRoute allowedRoles={['admin']}><ShopsPage /></PrivateRoute>} />
        <Route path="/admin/users"      element={<PrivateRoute allowedRoles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="/admin/entries"    element={<PrivateRoute allowedRoles={['admin', 'manager']}><EntriesPage /></PrivateRoute>} />
        <Route path="/admin/cashflow"   element={<PrivateRoute allowedRoles={['admin', 'manager']}><CashFlowPage /></PrivateRoute>} />
        <Route path="/admin/reports"    element={<PrivateRoute allowedRoles={['admin', 'manager']}><ReportsPage /></PrivateRoute>} />
        <Route path="/admin/audit"      element={<PrivateRoute allowedRoles={['admin']}><AuditLogsPage /></PrivateRoute>} />
        <Route path="/admin/excel"      element={<PrivateRoute allowedRoles={['admin', 'manager', 'shop_user']}><ExcelUploadPage /></PrivateRoute>} />

        {/* Manager Route */}
        <Route path="/manager" element={<PrivateRoute allowedRoles={['manager']}><ManagerDashboard /></PrivateRoute>} />

        {/* Shop User Route */}
        <Route path="/shop" element={<PrivateRoute allowedRoles={['shop_user']}><ShopDashboard /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
