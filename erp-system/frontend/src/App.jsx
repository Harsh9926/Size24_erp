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
import AdminBankLedgerPage from './pages/AdminBankLedgerPage';

// Manager Pages
import ManagerDashboard       from './pages/ManagerDashboard';
import ManagerCashTransferPage from './pages/ManagerCashTransferPage';

// Admin Manager Fund pages
import AdminManagerFundsPage   from './pages/AdminManagerFundsPage';
import AdminManagerProfilePage from './pages/AdminManagerProfilePage';

// New feature pages
import ExpensesPage   from './pages/ExpensesPage';
import AnomaliesPage  from './pages/AnomaliesPage';

// Inventory Pages
import InventoryDashboard  from './pages/inventory/InventoryDashboard';
import ItemMasterPage      from './pages/inventory/ItemMasterPage';
import StockSummaryPage    from './pages/inventory/StockSummaryPage';
import PurchaseRegisterPage from './pages/inventory/PurchaseRegisterPage';
import SalesInvoicePage    from './pages/inventory/SalesInvoicePage';
import SuppliersPage       from './pages/inventory/SuppliersPage';
import CustomersPage       from './pages/inventory/CustomersPage';
import SchoolMappingPage   from './pages/inventory/SchoolMappingPage';

// Billing & POS Pages
import POSPage            from './pages/billing/POSPage';
import POSDashboard       from './pages/billing/POSDashboard';
import CashCounterPage    from './pages/billing/CashCounterPage';
import BarcodeLabelsPage  from './pages/billing/BarcodeLabelsPage';
import CustomerLedgerPage from './pages/billing/CustomerLedgerPage';

// Phase 3 — Accounting Pages
import AccountingDashboard from './pages/accounting/AccountingDashboard';
import ChartOfAccounts     from './pages/accounting/ChartOfAccounts';
import JournalEntries      from './pages/accounting/JournalEntries';
import { TrialBalance, ProfitLoss, BalanceSheet, CashBook, BankBook, GSTLedger, AccountLedger, VouchersPage } from './pages/accounting/FinancialReports';

// Phase 3 — HR, CRM, Franchise, Service, MRP, Settings, AI
import HRPage        from './pages/hr/HRPage';
import CRMPage       from './pages/crm/CRMPage';
import FranchisePage from './pages/franchise/FranchisePage';
import ServicePage   from './pages/service/ServicePage';
import MRPPage       from './pages/mrp/MRPPage';
import SettingsPage  from './pages/settings/SettingsPage';
import AIDashboard   from './pages/ai/AIDashboard';

// Manufacturing Pages
import ManufacturingDashboard from './pages/manufacturing/ManufacturingDashboard';
import RawMaterialsPage       from './pages/manufacturing/RawMaterialsPage';
import FabricLotsPage         from './pages/manufacturing/FabricLotsPage';
import BOMPage                from './pages/manufacturing/BOMPage';
import SizeMatrixPage         from './pages/manufacturing/SizeMatrixPage';
import ProductMasterPage      from './pages/manufacturing/ProductMasterPage';

// Shop User Pages
import ShopDashboard   from './pages/ShopDashboard';
import ShopSelectPage  from './pages/ShopSelectPage';

// Attendance Module
import MyAttendancePage         from './pages/attendance/MyAttendancePage';
import AdminAttendanceDashboard from './pages/attendance/AdminAttendanceDashboard';
import AttendanceApprovalsPage  from './pages/attendance/AttendanceApprovalsPage';
import AttendanceSettingsPage   from './pages/attendance/AttendanceSettingsPage';
import AttendanceReportsPage    from './pages/attendance/AttendanceReportsPage';
import AttendancePayrollPage    from './pages/attendance/AttendancePayrollPage';
import AttendanceAssignmentsPage from './pages/attendance/AttendanceAssignmentsPage';

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
        <Route path="/admin/new-entry"  element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="new_entry"    ><AdminEntryPage /></PrivateRoute>} />
        <Route path="/admin/manager-funds" element={<PrivateRoute allowedRoles={['admin']}                 module="manager_funds"><AdminManagerFundsPage /></PrivateRoute>} />
        <Route path="/admin/manager/:id"   element={<PrivateRoute allowedRoles={['admin']}                 module="manager_funds"><AdminManagerProfilePage /></PrivateRoute>} />
        <Route path="/admin/expenses"   element={<PrivateRoute allowedRoles={['admin', 'manager']}         module="expenses"     ><ExpensesPage /></PrivateRoute>} />
        <Route path="/admin/anomalies"  element={<PrivateRoute allowedRoles={['admin']}                    module="anomalies"    ><AnomaliesPage /></PrivateRoute>} />

        <Route path="/admin/bank-ledger" element={<PrivateRoute allowedRoles={['admin']} module="manager_funds"><AdminBankLedgerPage /></PrivateRoute>} />

        {/* Access Control — admin only, protected by access_control module permission */}
        <Route path="/admin/access-control" element={<PrivateRoute allowedRoles={['admin']} module="access_control"><AccessControlPage /></PrivateRoute>} />

        {/* Manager Routes */}
        <Route path="/manager"               element={<PrivateRoute allowedRoles={['manager']} module="dashboard"    ><ManagerDashboard /></PrivateRoute>} />
        <Route path="/manager/cash-transfer" element={<PrivateRoute allowedRoles={['manager']} module="manager_funds"><ManagerCashTransferPage /></PrivateRoute>} />

        {/* Shop User Routes */}
        <Route path="/shop/select" element={<PrivateRoute allowedRoles={['shop_user']}><ShopSelectPage /></PrivateRoute>} />
        <Route path="/shop"        element={<PrivateRoute allowedRoles={['shop_user']}><ShopDashboard /></PrivateRoute>} />

        {/* Inventory Routes — admin + manager */}
        <Route path="/inventory"          element={<PrivateRoute allowedRoles={['admin','manager']}><InventoryDashboard /></PrivateRoute>} />
        <Route path="/inventory/items"    element={<PrivateRoute allowedRoles={['admin','manager']}><ItemMasterPage /></PrivateRoute>} />
        <Route path="/inventory/stock"    element={<PrivateRoute allowedRoles={['admin','manager']}><StockSummaryPage /></PrivateRoute>} />
        <Route path="/inventory/purchase" element={<PrivateRoute allowedRoles={['admin','manager']}><PurchaseRegisterPage /></PrivateRoute>} />
        <Route path="/inventory/sales"    element={<PrivateRoute allowedRoles={['admin','manager']}><SalesInvoicePage /></PrivateRoute>} />
        <Route path="/inventory/suppliers" element={<PrivateRoute allowedRoles={['admin','manager']}><SuppliersPage /></PrivateRoute>} />
        <Route path="/inventory/customers" element={<PrivateRoute allowedRoles={['admin','manager']}><CustomersPage /></PrivateRoute>} />
        <Route path="/inventory/schools"  element={<PrivateRoute allowedRoles={['admin','manager']}><SchoolMappingPage /></PrivateRoute>} />

        {/* Billing & POS Routes — admin + manager */}
        <Route path="/billing/pos"          element={<PrivateRoute allowedRoles={['admin','manager']}><POSPage /></PrivateRoute>} />
        <Route path="/billing/dashboard"    element={<PrivateRoute allowedRoles={['admin','manager']}><POSDashboard /></PrivateRoute>} />
        <Route path="/billing/cash-counter" element={<PrivateRoute allowedRoles={['admin','manager']}><CashCounterPage /></PrivateRoute>} />
        <Route path="/billing/labels"       element={<PrivateRoute allowedRoles={['admin','manager']}><BarcodeLabelsPage /></PrivateRoute>} />
        <Route path="/billing/ledger"       element={<PrivateRoute allowedRoles={['admin','manager']}><CustomerLedgerPage /></PrivateRoute>} />

        {/* Manufacturing Routes — admin + manager */}
        <Route path="/manufacturing"              element={<PrivateRoute allowedRoles={['admin','manager']}><ManufacturingDashboard /></PrivateRoute>} />
        <Route path="/manufacturing/raw-materials" element={<PrivateRoute allowedRoles={['admin','manager']}><RawMaterialsPage /></PrivateRoute>} />
        <Route path="/manufacturing/fabric-lots"   element={<PrivateRoute allowedRoles={['admin','manager']}><FabricLotsPage /></PrivateRoute>} />
        <Route path="/manufacturing/bom"           element={<PrivateRoute allowedRoles={['admin','manager']}><BOMPage /></PrivateRoute>} />
        <Route path="/manufacturing/size-matrix"   element={<PrivateRoute allowedRoles={['admin','manager']}><SizeMatrixPage /></PrivateRoute>} />
        <Route path="/manufacturing/product-master" element={<PrivateRoute allowedRoles={['admin','manager']}><ProductMasterPage /></PrivateRoute>} />

        {/* Phase 3 — Accounting Routes */}
        <Route path="/accounting"              element={<PrivateRoute allowedRoles={['admin','manager']}><AccountingDashboard /></PrivateRoute>} />
        <Route path="/accounting/chart"        element={<PrivateRoute allowedRoles={['admin','manager']}><ChartOfAccounts /></PrivateRoute>} />
        <Route path="/accounting/journal"      element={<PrivateRoute allowedRoles={['admin','manager']}><JournalEntries /></PrivateRoute>} />
        <Route path="/accounting/trial-balance" element={<PrivateRoute allowedRoles={['admin','manager']}><TrialBalance /></PrivateRoute>} />
        <Route path="/accounting/profit-loss"  element={<PrivateRoute allowedRoles={['admin','manager']}><ProfitLoss /></PrivateRoute>} />
        <Route path="/accounting/balance-sheet" element={<PrivateRoute allowedRoles={['admin','manager']}><BalanceSheet /></PrivateRoute>} />
        <Route path="/accounting/cashbook"     element={<PrivateRoute allowedRoles={['admin','manager']}><CashBook /></PrivateRoute>} />
        <Route path="/accounting/bankbook"     element={<PrivateRoute allowedRoles={['admin','manager']}><BankBook /></PrivateRoute>} />
        <Route path="/accounting/gst-ledger"   element={<PrivateRoute allowedRoles={['admin','manager']}><GSTLedger /></PrivateRoute>} />
        <Route path="/accounting/ledger"       element={<PrivateRoute allowedRoles={['admin','manager']}><AccountLedger /></PrivateRoute>} />
        <Route path="/accounting/vouchers"     element={<PrivateRoute allowedRoles={['admin','manager']}><VouchersPage /></PrivateRoute>} />

        {/* Phase 3 — Other Module Routes */}
        <Route path="/hr"        element={<PrivateRoute allowedRoles={['admin','manager']}><HRPage /></PrivateRoute>} />
        <Route path="/crm"       element={<PrivateRoute allowedRoles={['admin','manager']}><CRMPage /></PrivateRoute>} />
        <Route path="/franchise" element={<PrivateRoute allowedRoles={['admin','manager']}><FranchisePage /></PrivateRoute>} />
        <Route path="/service"   element={<PrivateRoute allowedRoles={['admin','manager']}><ServicePage /></PrivateRoute>} />
        <Route path="/mrp"       element={<PrivateRoute allowedRoles={['admin','manager']}><MRPPage /></PrivateRoute>} />
        <Route path="/settings"  element={<PrivateRoute allowedRoles={['admin']}><SettingsPage /></PrivateRoute>} />
        <Route path="/ai"        element={<PrivateRoute allowedRoles={['admin','manager']}><AIDashboard /></PrivateRoute>} />

        {/* ── Attendance Module ─────────────────────────────────── */}
        {/* Self-service punch (manager + admin; employees use Shop Dashboard) —
            allowedRoles already excludes shop_user from this route, so the
            module="attendance" check here only ever applies to admin/manager
            (who ARE covered by the RBAC surface), never to employees. */}
        <Route path="/attendance/me"          element={<PrivateRoute allowedRoles={['admin','manager']} module="attendance"><MyAttendancePage /></PrivateRoute>} />
        {/* Dashboard + table — admin (all shops) & manager (own shops) */}
        <Route path="/attendance"             element={<PrivateRoute allowedRoles={['admin','manager']} module="attendance"><AdminAttendanceDashboard /></PrivateRoute>} />
        <Route path="/attendance/reports"     element={<PrivateRoute allowedRoles={['admin','manager']} module="attendance_reports"><AttendanceReportsPage /></PrivateRoute>} />
        <Route path="/attendance/payroll"     element={<PrivateRoute allowedRoles={['admin','manager']} module="attendance_payroll"><AttendancePayrollPage /></PrivateRoute>} />
        {/* Admin-only approvals & config */}
        <Route path="/attendance/assignments" element={<PrivateRoute allowedRoles={['admin']} module="attendance_assignments"><AttendanceAssignmentsPage /></PrivateRoute>} />
        <Route path="/attendance/approvals"   element={<PrivateRoute allowedRoles={['admin']} module="attendance_approvals"><AttendanceApprovalsPage /></PrivateRoute>} />
        <Route path="/attendance/settings"    element={<PrivateRoute allowedRoles={['admin']} module="attendance_settings"><AttendanceSettingsPage /></PrivateRoute>} />

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
