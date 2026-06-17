import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { useAuth } from '@/context/AuthContext';
import { AUTO_LOCK_OPTIONS } from '@/types/auth';
import { formatDateTime } from '@/utils/format';
import { sanitizeBarcode } from '@/utils/barcode';
import type { LabelSettings, LabelTemplate } from '@/types/importExport';
import { LABEL_TEMPLATE_LABELS } from '@/types/importExport';

import type { LicenseInfoView, LicenseStatusResult } from '@/types/license';

type SettingsTab = 'app' | 'about' | 'license' | 'security' | 'audit' | 'labels' | 'barcode';

export default function SettingsPage() {
  const { loadSecurity } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('app');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [dbPath, setDbPath] = useState('');
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [autoLock, setAutoLock] = useState(0);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditModule, setAuditModule] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [about, setAbout] = useState<Record<string, unknown> | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfoView | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [maintMsg, setMaintMsg] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [parsedScan, setParsedScan] = useState<import('@/types/barcode').ParsedBarcode | null>(null);

  useEffect(() => {
    Promise.all([
      ipc.settings.getAll(),
      ipc.app.getAbout(),
      ipc.settings.getLabelSettings(),
      ipc.auth.getSecurity(),
      ipc.license.getInfo(),
    ])
      .then(([s, ab, ls, sec, lic]) => {
        setSettings(s);
        setAbout(ab as Record<string, unknown>);
        setDbPath(String(ab.dbPath || ''));
        setLabelSettings(ls);
        setAutoLock(sec.autoLockMinutes);
        setLicenseInfo(lic.info);
        setLicenseStatus(lic.status);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadAudit = useCallback(() => {
    ipc.audit
      .list({
        date_from: auditFrom || undefined,
        date_to: auditTo || undefined,
        module: auditModule || undefined,
      })
      .then((rows) => setAuditLogs(rows as Record<string, unknown>[]))
      .catch(console.error);
  }, [auditFrom, auditTo, auditModule]);

  useEffect(() => {
    if (tab === 'audit') loadAudit();
  }, [tab, loadAudit]);

  const saveLabelSettings = async (patch: Partial<LabelSettings>) => {
    if (!labelSettings) return;
    const next = { ...labelSettings, ...patch };
    setLabelSettings(next);
    await ipc.settings.updateLabelSettings(patch);
    setToast('Etiket ayarları kaydedildi.');
    setTimeout(() => setToast(''), 2500);
  };

  const saveSecurity = async (minutes: number) => {
    setAutoLock(minutes);
    await ipc.auth.updateSecurity({ autoLockMinutes: minutes });
    await loadSecurity();
    setToast('Güvenlik ayarları kaydedildi.');
    setTimeout(() => setToast(''), 2500);
  };

  if (loading) return <div className="loading-text">Yükleniyor...</div>;

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Ayarlar</h2>
      </div>
      {toast && <div className="toast-success">{toast}</div>}

      <div className="tab-bar" style={{ marginBottom: 8 }}>
        {[
          { id: 'app' as const, label: 'Uygulama' },
          { id: 'about' as const, label: 'Hakkında' },
          { id: 'license' as const, label: 'Lisans Bilgileri' },
          { id: 'security' as const, label: 'Güvenlik' },
          { id: 'audit' as const, label: 'İşlem Geçmişi' },
          { id: 'labels' as const, label: 'Etiket' },
          { id: 'barcode' as const, label: 'Barkod Okuyucu Testi' },
        ].map((t) => (
          <button key={t.id} type="button" className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'about' && about && (
        <div className="panel">
          <div className="panel-header">Hakkında</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>Program</label>
                <input className="form-input" value={String(about.appName)} readOnly />
              </div>
              <div className="form-group">
                <label>Sürüm</label>
                <input className="form-input" value={String(about.version)} readOnly />
              </div>
              <div className="form-group">
                <label>Lisans Durumu</label>
                <input className="form-input" value={String(about.licenseStatus)} readOnly />
              </div>
              <div className="form-group">
                <label>Destek E-posta</label>
                <input className="form-input" value={String(about.supportEmail)} readOnly />
              </div>
            </div>
            <div className="form-group">
              <label>Veritabanı Yolu</label>
              <input className="form-input" value={String(about.dbPath)} readOnly />
            </div>
            <div className="form-group">
              <label>Yedek Klasörü</label>
              <input className="form-input" value={String(about.backupFolder)} readOnly />
            </div>
            <div className="form-group">
              <label>Son Yedek</label>
              <input className="form-input" value={about.lastBackupAt ? formatDateTime(String(about.lastBackupAt)) : 'Henüz yok'} readOnly />
            </div>
            <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>{String(about.copyright)}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => ipc.app.openLogsFolder()}>Log Klasörünü Aç</button>
              <button className="btn" onClick={() => ipc.app.openDbFolder()}>Veritabanı Klasörünü Aç</button>
              <button className="btn" onClick={async () => {
                const r = await ipc.db.integrityCheck();
                setMaintMsg(r.message);
              }}>Bütünlük Kontrolü</button>
              <button className="btn" onClick={async () => {
                const r = await ipc.db.vacuum();
                setMaintMsg(r.message);
              }}>VACUUM</button>
            </div>
            {maintMsg && <div className="alert alert-info" style={{ marginTop: 8 }}>{maintMsg}</div>}
          </div>
        </div>
      )}

      {tab === 'license' && (
        <div className="panel">
          <div className="panel-header">Lisans Bilgileri</div>
          <div className="panel-body">
            {!licenseInfo ? (
              <p className="empty-text">Aktif lisans bulunamadı.</p>
            ) : (
              <>
            <div className="form-row">
              <div className="form-group"><label>Anahtar</label><input className="form-input" value={licenseInfo.licenseKeyMasked} readOnly /></div>
              <div className="form-group"><label>Firma</label><input className="form-input" value={licenseInfo.companyName || '-'} readOnly /></div>
              <div className="form-group"><label>Müşteri</label><input className="form-input" value={licenseInfo.customerName || '-'} readOnly /></div>
              <div className="form-group"><label>E-posta</label><input className="form-input" value={licenseInfo.customerEmail || '-'} readOnly /></div>
              <div className="form-group"><label>Ürün</label><input className="form-input" value={licenseInfo.productName || '-'} readOnly /></div>
              <div className="form-group"><label>Paket</label><input className="form-input" value={licenseInfo.planName || '-'} readOnly /></div>
              <div className="form-group"><label>Durum</label><input className="form-input" value={licenseInfo.status} readOnly /></div>
              <div className="form-group"><label>Cihaz</label><input className="form-input" value={licenseInfo.deviceName || '-'} readOnly /></div>
              <div className="form-group"><label>Aktivasyon</label><input className="form-input" value={licenseInfo.activatedAt ? formatDateTime(licenseInfo.activatedAt) : '-'} readOnly /></div>
              <div className="form-group"><label>Son Doğrulama</label><input className="form-input" value={licenseInfo.lastOnlineCheckAt ? formatDateTime(licenseInfo.lastOnlineCheckAt) : '-'} readOnly /></div>
              <div className="form-group"><label>Bitiş</label><input className="form-input" value={licenseInfo.expiresAt ? formatDateTime(licenseInfo.expiresAt) : '-'} readOnly /></div>
              <div className="form-group"><label>Offline Hak</label><input className="form-input" value={`${licenseStatus?.offlineGraceRemaining ?? 0} gün kaldı`} readOnly /></div>
            </div>
            {licenseInfo.features && (
              <div className="form-group">
                <label>Açık Özellikler</label>
                <textarea className="form-input" value={licenseInfo.features} readOnly rows={3} />
              </div>
            )}
            <div className="form-group">
              <label>Yeni Lisans Anahtarı</label>
              <input className="form-input" value={newLicenseKey} onChange={(e) => setNewLicenseKey(e.target.value)} placeholder="Değiştirmek için yeni anahtar" />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={async () => {
                const r = await ipc.license.revalidate();
                setToast(r.warning || 'Lisans doğrulandı.');
                const lic = await ipc.license.getInfo();
                setLicenseInfo(lic.info);
                setLicenseStatus(lic.status);
              }}>Lisansı Yeniden Doğrula</button>
              <button className="btn" onClick={async () => {
                if (!newLicenseKey.trim()) return;
                await ipc.license.changeKey({ licenseKey: newLicenseKey.trim() });
                setToast('Lisans anahtarı güncellendi.');
                const lic = await ipc.license.getInfo();
                setLicenseInfo(lic.info);
              }}>Lisans Anahtarını Değiştir</button>
              <button className="btn" onClick={async () => {
                const r = await ipc.license.copyInfo();
                await navigator.clipboard.writeText(r.text);
                setToast('Lisans bilgileri panoya kopyalandı.');
              }}>Lisans Bilgilerini Kopyala</button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'app' && (
        <div className="panel">
          <div className="panel-header">Uygulama Bilgileri</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>Uygulama Adı</label>
                <input className="form-input" value="Woontegra Optik Desktop" readOnly />
              </div>
              <div className="form-group">
                <label>Sürüm</label>
                <input className="form-input" value={settings.app_version || '1.0.0'} readOnly />
              </div>
            </div>
            <div className="form-group">
              <label>Veritabanı Yolu</label>
              <input className="form-input" value={dbPath} readOnly />
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="panel">
          <div className="panel-header">Otomatik Kilit</div>
          <div className="panel-body">
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label>Hareketsizlik süresi</label>
              <select className="form-select" value={autoLock} onChange={(e) => saveSecurity(Number(e.target.value))}>
                {AUTO_LOCK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">İşlem Geçmişi</div>
          <div className="panel-body" style={{ paddingBottom: 0 }}>
            <div className="filter-row" style={{ marginBottom: 8 }}>
              <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
              <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
              <input placeholder="Modül" value={auditModule} onChange={(e) => setAuditModule(e.target.value)} />
              <button className="btn" onClick={loadAudit}>
                Listele
              </button>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kullanıcı</th>
                  <th>Modül</th>
                  <th>İşlem</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-text">
                      Kayıt yok
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((r, i) => (
                    <tr key={i}>
                      <td>{formatDateTime(String(r.created_at))}</td>
                      <td>{String(r.user_name || r.username || '-')}</td>
                      <td>{String(r.module || '-')}</td>
                      <td>{String(r.action)}</td>
                      <td>{String(r.description || r.details || '-')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'labels' && labelSettings && (
        <div className="panel">
          <div className="panel-header">Etiket / Yazıcı Ayarları</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>Varsayılan Etiket Şablonu</label>
                <select
                  className="form-select"
                  value={labelSettings.defaultTemplate}
                  onChange={(e) => saveLabelSettings({ defaultTemplate: e.target.value as LabelTemplate })}
                >
                  {(Object.keys(LABEL_TEMPLATE_LABELS) as LabelTemplate[]).map((t) => (
                    <option key={t} value={t}>
                      {LABEL_TEMPLATE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, marginRight: 16 }}>
                <input type="checkbox" checked={labelSettings.showPrice} onChange={(e) => saveLabelSettings({ showPrice: e.target.checked })} /> Fiyat
              </label>
              <label style={{ fontSize: 12, marginRight: 16 }}>
                <input type="checkbox" checked={labelSettings.showBarcode} onChange={(e) => saveLabelSettings({ showBarcode: e.target.checked })} /> Barkod
              </label>
              <label style={{ fontSize: 12, marginRight: 16 }}>
                <input type="checkbox" checked={labelSettings.showCompany} onChange={(e) => saveLabelSettings({ showCompany: e.target.checked })} /> Firma adı
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={labelSettings.previewBeforePrint} onChange={(e) => saveLabelSettings({ previewBeforePrint: e.target.checked })} /> Ön izleme
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === 'barcode' && (
        <div className="panel">
          <div className="panel-header">Barkod Okuyucu Testi</div>
          <div className="panel-body">
            <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              Gerçek barkod okuyucu veya DataMatrix okuyucu ile test yapın. Okuma sonrası Enter veya Tab ile analiz edilir.
            </p>
            <div className="form-group">
              <label>Barkod / Karekod Okutunuz</label>
              <input
                className="form-input"
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const code = sanitizeBarcode(scanInput);
                    if (!code) return;
                    try {
                      const p = await ipc.barcode.parse(code);
                      setParsedScan(p);
                      setScanInput('');
                    } catch {
                      setParsedScan({ raw: code, normalized: code, type: 'UNKNOWN', errors: ['Barkod çözümlenemedi. Lütfen tekrar okutun.'] });
                    }
                  }
                }}
                placeholder="Okutun ve Enter'a basın"
              />
            </div>
            {parsedScan && (
              <div className="form-row">
                <div className="form-group"><label>Ham Veri</label><textarea className="form-input" rows={2} readOnly value={parsedScan.raw} /></div>
                <div className="form-group"><label>Temizlenmiş</label><input className="form-input" readOnly value={parsedScan.normalized} /></div>
                <div className="form-group"><label>Tip</label><input className="form-input" readOnly value={parsedScan.type} /></div>
                <div className="form-group"><label>GTIN / Barkod</label><input className="form-input" readOnly value={parsedScan.gtin || parsedScan.barcode || '-'} /></div>
                <div className="form-group"><label>Seri No</label><input className="form-input" readOnly value={parsedScan.serialNo || '-'} /></div>
                <div className="form-group"><label>Lot No</label><input className="form-input" readOnly value={parsedScan.lotNo || '-'} /></div>
                <div className="form-group"><label>Son Kullanma</label><input className="form-input" readOnly value={parsedScan.expiryDate || '-'} /></div>
                {parsedScan.errors?.length ? (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Uyarılar</label>
                    <input className="form-input" readOnly value={parsedScan.errors.join('; ')} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
