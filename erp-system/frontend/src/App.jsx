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
import AdminDashboard   from './pages/AdminDashboard';
import AdminApprovalPage from './pages/AdminApprovalPage';
import ShopsPage        from './pages/ShopsPage';
import UsersPage        from './pages/UsersPage';
import EntriesPage      from './pages/EntriesPage';
import AuditLogsPage    from './pages/AuditLogsPage';
import ReportsPage      from './pages/ReportsPage';
import ExcelUploadPage  from './pages/ExcelUploadPage';
import AdminEntryPage   from './pages/AdminEntryPage';

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
import ShopDashboard from './pages/ShopDashboard';

function AppInner() {
  const { user, setUser } = useContext(AuthContext);

  const handleTermsAccepted = () => {
    setUser(prev => prev ? { ...prev, termsAccepted: true } : prev);
  };

  return (
    <>
      {/* Show terms modal if logged in but hasn't accepted yet */}
      {user && user.termsAccepted === false && (
        <TermsAcceptanceModal onAccepted={handleTermsAccepted} />
      )}
      <Routes>
        {/* Public Routes */}
        <Route path="/login"   element={<LoginPage />} />
        <Route path="/signup"  element={<SignupPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Admin-only Routes */}
        <Route path="/admin"            element={<PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/approvals"  element={<PrivateRoute allowedRoles={['admin', 'manager']}><AdminApprovalPage /></PrivateRoute>} />
        <Route path="/admin/shops"      element={<PrivateRoute allowedRoles={['admin']}><ShopsPage /></PrivateRoute>} />
        <Route path="/admin/users"      element={<PrivateRoute allowedRoles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="/admin/entries"    element={<PrivateRoute allowedRoles={['admin', 'manager']}><EntriesPage /></PrivateRoute>} />
        {/* /admin/cashflow removed */}
        <Route path="/admin/reports"    element={<PrivateRoute allowedRoles={['admin', 'manager']}><ReportsPage /></PrivateRoute>} />
        <Route path="/admin/audit"      element={<PrivateRoute allowedRoles={['admin']}><AuditLogsPage /></PrivateRoute>} />
        <Route path="/admin/excel"      element={<PrivateRoute allowedRoles={['shop_user']}><ExcelUploadPage /></PrivateRoute>} />
        <Route path="/admin/new-entry"    element={<PrivateRoute allowedRoles={['admin']}><AdminEntryPage /></PrivateRoute>} />
        <Route path="/admin/manager-funds" element={<PrivateRoute allowedRoles={['admin']}><AdminManagerFundsPage /></PrivateRoute>} />
        <Route path="/admin/manager/:id"   element={<PrivateRoute allowedRoles={['admin']}><AdminManagerProfilePage /></PrivateRoute>} />
        <Route path="/admin/expenses"      element={<PrivateRoute allowedRoles={['admin', 'manager']}><ExpensesPage /></PrivateRoute>} />
        <Route path="/admin/anomalies"     element={<PrivateRoute allowedRoles={['admin', 'manager']}><AnomaliesPage /></PrivateRoute>} />

        {/* Manager Routes */}
        <Route path="/manager"               element={<PrivateRoute allowedRoles={['manager']}><ManagerDashboard /></PrivateRoute>} />
        <Route path="/manager/cash-transfer" element={<PrivateRoute allowedRoles={['manager']}><ManagerCashTransferPage /></PrivateRoute>} />

        {/* Shop User Route */}
        <Route path="/shop" element={<PrivateRoute allowedRoles={['shop_user']}><ShopDashboard /></PrivateRoute>} />

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
