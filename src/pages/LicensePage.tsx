import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { DEMO_LICENSE_KEY } from '@/types/license';
import '@/styles/login.css';

interface LicensePageProps {
  onActivated: () => void;
  blockReason?: string | null;
}

export default function LicensePage({ onActivated, blockReason }: LicensePageProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    ipc.license.getDeviceInfo().then((d) => setDeviceName(d.deviceName)).catch(() => undefined);
  }, []);

  const activate = async (key: string, demo = false) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (demo) {
        await ipc.license.activateDemo({ companyName: companyName || undefined, email: email || undefined });
      } else {
        await ipc.license.activate({
          licenseKey: key,
          companyName: companyName || undefined,
          customerEmail: email || undefined,
        });
      }
      setSuccess('Lisans başarıyla aktifleştirildi. Giriş ekranına yönlendiriliyorsunuz...');
      setTimeout(() => onActivated(), 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = () => {
    if (!licenseKey.trim()) {
      setError('Lütfen lisans anahtarını girin.');
      return;
    }
    activate(licenseKey.trim());
  };

  const handleRevalidate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ipc.license.revalidate();
      if (res.warning) setSuccess(res.warning);
      else setSuccess('Lisans doğrulandı.');
      setTimeout(() => onActivated(), 600);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel" style={{ width: 400 }}>
        <div className="login-brand">
          <div className="login-title">Woontegra Optik Desktop</div>
          <div className="login-sub">Lisans Aktivasyonu</div>
        </div>

        {blockReason && <div className="alert alert-error">{blockReason}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="login-form">
          <div className="form-group">
            <label>Lisans Anahtarı</label>
            <input
              className="form-input"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="WO-XXXX-XXXX-XXXX"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Firma Adı</label>
            <input className="form-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label>E-posta</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label>Cihaz Adı</label>
            <input className="form-input" value={deviceName} readOnly />
          </div>

          <button type="button" className="btn btn-primary login-btn" onClick={handleActivate} disabled={loading}>
            {loading ? 'İşleniyor...' : 'Lisansı Aktifleştir'}
          </button>
          <button
            type="button"
            className="btn login-btn"
            style={{ marginTop: 6 }}
            onClick={() => activate(DEMO_LICENSE_KEY, true)}
            disabled={loading}
          >
            Demo Lisans Kullan
          </button>
          {blockReason && (
            <button type="button" className="btn login-btn" style={{ marginTop: 6 }} onClick={handleRevalidate} disabled={loading}>
              Lisansı Yeniden Doğrula
            </button>
          )}
        </div>

        <div className="login-hint">
          Demo anahtar: <strong>{DEMO_LICENSE_KEY}</strong>
        </div>
      </div>
    </div>
  );
}
