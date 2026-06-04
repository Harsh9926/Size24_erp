import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';
import { AuthContext } from './context/AuthContext';

// Auth Pages
import LoginPage    from './pages/LoginPage';
import SignupPage   from './pages/SignupPage';
import TermsPage    from './pages/TermsPage';
import PrivacyPage  from './pages/PrivacyPage';

// Admin Pages
import AdminDashboard      from './pages/AdminDashboard';
import AdminApprovalPage   from './pages/AdminApprovalPage';
import ShopsPage           from './pages/ShopsPage';
import UsersPage           from './pages/UsersPage';
import EntriesPage         from './pages/EntriesPage';
import AuditLogsPage       from './pages/AuditLogsPage';
import ReportsPage         from './pages/ReportsPage';
import ExcelUploadPage     from './pages/ExcelUploadPage';
import AdminEntryPage      from './pages/AdminEntryPage';
import AccessControlPage   from './pages/AccessControlPage';

// Manager Pages
import ManagerDashboard       from './pages/ManagerDashboard';
import ManagerCashTransferPage from './pages/ManagerCashTransferPage';

// Admin Manager Fund pages
import AdminManagerFundsPage   from './pages/AdminManagerFundsPage';
import AdminManagerProfilePage from './pages/AdminManagerProfilePage';

// New feature pages
import ExpensesPage   from './pages/ExpensesPage';
import AnomaliesPage  from './pages/AnomaliesPage';

// Shop User Pages
import ShopDashboard   from './pages/ShopDashboard';
import ShopSelectPage  from './pages/ShopSelectPage';

function AppInner() {
  const { user, setUser } = useContext(AuthContext);

  const handleTermsAccepted = () => {
    setUser(prev => prev ? { ...prev, termsAccepted: true } : prev);
  };

  return (
    <>
      {/* Show terms modal if logged in but hasn't accepted yet */}
      {user && !user.termsAccepted && (
        <TermsAcceptanceModal onAccepted={handleTermsAccepted} />
      )}
      <Routes>
        {/* Public Routes */}
        <Route path="/login"   element={<LoginPage />} />
        <Route path="/signup"  element={<SignupPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Admin + manager shared routes — RBAC module prop enables per-user control */}
        <Route path="/admin"            element={<PrivateRoute allowedRoles={['admin']}                    module="dashboard"    ><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/approvals"  element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="approvals"    ><AdminApprovalPage /></PrivateRoute>} />
        <Route path="/admin/shops"      element={<PrivateRoute allowedRoles={['admin']}                    module="shops"        ><ShopsPage /></PrivateRoute>} />
        <Route path="/admin/users"      element={<PrivateRoute allowedRoles={['admin']}                    module="users"        ><UsersPage /></PrivateRoute>} />
        <Route path="/admin/entries"    element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="entries"      ><EntriesPage /></PrivateRoute>} />
        <Route path="/admin/reports"    element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="reports"      ><ReportsPage /></PrivateRoute>} />
        <Route path="/admin/audit"      element={<PrivateRoute allowedRoles={['admin']}                                         ><AuditLogsPage /></PrivateRoute>} />
        <Route path="/admin/excel"      element={<PrivateRoute allowedRoles={['shop_user']}                                     ><ExcelUploadPage /></PrivateRoute>} />
        <Route path="/admin/new-entry"  element={<PrivateRoute allowedRoles={['admin']}                    module="new_entry"    ><AdminEntryPage /></PrivateRoute>} />
        <Route path="/admin/manager-funds" element={<PrivateRoute allowedRoles={['admin']}                 module="manager_funds"><AdminManagerFundsPage /></PrivateRoute>} />
        <Route path="/admin/manager/:id"   element={<PrivateRoute allowedRoles={['admin']}                 module="manager_funds"><AdminManagerProfilePage /></PrivateRoute>} />
        <Route path="/admin/expenses"   element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="expenses"     ><ExpensesPage /></PrivateRoute>} />
        <Route path="/admin/anomalies"  element={<PrivateRoute allowedRoles={['admin']}                    module="anomalies"    ><AnomaliesPage /></PrivateRoute>} />

        {/* Access Control — admin only, no module check (admin always has full access) */}
        <Route path="/admin/access-control" element={<PrivateRoute allowedRoles={['admin']}><AccessControlPage /></PrivateRoute>} />

        {/* Manager Routes */}
        <Route path="/manager"               element={<PrivateRoute allowedRoles={['manager']} module="dashboard"    ><ManagerDashboard /></PrivateRoute>} />
        <Route path="/manager/cash-transfer" element={<PrivateRoute allowedRoles={['manager']} module="manager_funds"><ManagerCashTransferPage /></PrivateRoute>} />

        {/* Shop User Routes */}
        <Route path="/shop/select" element={<PrivateRoute allowedRoles={['shop_user']}><ShopSelectPage /></PrivateRoute>} />
        <Route path="/shop"        element={<PrivateRoute allowedRoles={['shop_user']}><ShopDashboard /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
