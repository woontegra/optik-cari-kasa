import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import LockScreen from '@/pages/LockScreen';
import DashboardPage from '@/pages/DashboardPage';
import CompanyPage from '@/pages/CompanyPage';
import StockPage from '@/pages/StockPage';
import StockEntryPage from '@/pages/StockEntryPage';
import InventoryCountPage from '@/pages/InventoryCountPage';
import SuppliersPage from '@/pages/SuppliersPage';
import CustomerPage from '@/pages/CustomerPage';
import PrescriptionPage from '@/pages/PrescriptionPage';
import SalePage from '@/pages/SalePage';
import SalesListPage from '@/pages/SalesListPage';
import ReturnPage from '@/pages/ReturnPage';
import MedulaUtsPage from '@/pages/MedulaUtsPage';
import EdonusumPage from '@/pages/EdonusumPage';
import CashPage from '@/pages/CashPage';
import BackupPage from '@/pages/BackupPage';
import ReportsPage from '@/pages/ReportsPage';
import UsersPage from '@/pages/UsersPage';
import OptikTanimlarPage from '@/pages/OptikTanimlarPage';
import BankPosPage from '@/pages/BankPosPage';
import ExpensesPage from '@/pages/ExpensesPage';
import OpenAccountsPage from '@/pages/OpenAccountsPage';
import StatementsPage from '@/pages/StatementsPage';
import ProfitLossPage from '@/pages/ProfitLossPage';
import CampaignsPage from '@/pages/CampaignsPage';
import AppointmentsPage from '@/pages/AppointmentsPage';
import SettingsPage from '@/pages/SettingsPage';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';

export default function AppRoutes() {
  const { session, loading, locked } = useAuth();
  const [showPwdModal, setShowPwdModal] = useState(false);

  useEffect(() => {
    if (session?.mustChangePassword) setShowPwdModal(true);
  }, [session?.mustChangePassword]);

  if (loading) {
    return (
      <div className="loading-text" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Yükleniyor...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <>
      {session.mustChangePassword && (
        <div className="password-warning">
          <span>Güvenlik için admin şifrenizi değiştirmeniz önerilir.</span>
          <button className="btn btn-sm" onClick={() => setShowPwdModal(true)}>
            Şifre Değiştir
          </button>
        </div>
      )}
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="firma" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
            <Route path="stok" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
            <Route path="stok-giris" element={<ProtectedRoute><StockEntryPage /></ProtectedRoute>} />
            <Route path="stok-sayim" element={<ProtectedRoute><InventoryCountPage /></ProtectedRoute>} />
            <Route path="tedarikciler" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
            <Route path="musteri" element={<ProtectedRoute><CustomerPage /></ProtectedRoute>} />
            <Route path="randevular" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            <Route path="recete" element={<ProtectedRoute><PrescriptionPage /></ProtectedRoute>} />
            <Route path="satislar" element={<ProtectedRoute><SalesListPage /></ProtectedRoute>} />
            <Route path="iade" element={<ProtectedRoute><ReturnPage /></ProtectedRoute>} />
            <Route path="medula" element={<ProtectedRoute><MedulaUtsPage /></ProtectedRoute>} />
            <Route path="e-donusum" element={<ProtectedRoute><EdonusumPage /></ProtectedRoute>} />
            <Route path="satis" element={<ProtectedRoute><SalePage /></ProtectedRoute>} />
            <Route path="kasa" element={<ProtectedRoute><CashPage /></ProtectedRoute>} />
            <Route path="banka-pos" element={<ProtectedRoute><BankPosPage /></ProtectedRoute>} />
            <Route path="giderler" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
            <Route path="acik-hesaplar" element={<ProtectedRoute><OpenAccountsPage /></ProtectedRoute>} />
            <Route path="ekstreler" element={<ProtectedRoute><StatementsPage /></ProtectedRoute>} />
            <Route path="kar-zarar" element={<ProtectedRoute><ProfitLossPage /></ProtectedRoute>} />
            <Route path="kampanyalar" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
            <Route path="raporlar" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="yedekleme" element={<ProtectedRoute><BackupPage /></ProtectedRoute>} />
            <Route path="kullanicilar" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="optik-tanimlar" element={<ProtectedRoute><OptikTanimlarPage /></ProtectedRoute>} />
            <Route path="ayarlar" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </HashRouter>
      {locked && <LockScreen />}
      {showPwdModal && (
        <ChangePasswordModal onClose={() => setShowPwdModal(false)} onChanged={() => setShowPwdModal(false)} />
      )}
    </>
  );
}
