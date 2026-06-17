import { useEffect, useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import LicensePage from '@/pages/LicensePage';
import AppRoutes from '@/AppRoutes';
import { ipc } from '@/services/ipc';
import type { LicenseStatusResult } from '@/types/license';

export default function App() {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
  const [checked, setChecked] = useState(false);

  const refreshLicense = () => {
    ipc.license
      .getStatus()
      .then(setLicenseStatus)
      .catch(() => setLicenseStatus(null))
      .finally(() => setChecked(true));
  };

  useEffect(() => {
    refreshLicense();
  }, []);

  if (!checked) {
    return (
      <div className="loading-text" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Yükleniyor...
      </div>
    );
  }

  if (!licenseStatus?.canEnterApp) {
    return <LicensePage onActivated={refreshLicense} blockReason={licenseStatus?.blockReason} />;
  }

  return (
    <AuthProvider>
      {licenseStatus.warning && (
        <div className="password-warning">
          <span>{licenseStatus.warning}</span>
        </div>
      )}
      <AppRoutes />
    </AuthProvider>
  );
}
