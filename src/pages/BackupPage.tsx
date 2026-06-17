import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatDateTime, formatFileSize } from '@/utils/format';
import type { BackupRecord } from '@/types/electron';
import PageTitleBar from '@/components/layout/PageTitleBar';

export default function BackupPage() {
  const [autoBackup, setAutoBackup] = useState(false);
  const [frequency, setFrequency] = useState<'on_close' | 'daily' | 'weekly'>('daily');
  const [backupFolder, setBackupFolder] = useState('');
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const settings = await ipc.backup.getSettings();
      setAutoBackup(settings.autoBackupEnabled);
      setFrequency((settings.backupFrequency as typeof frequency) || 'daily');
      setBackupFolder(settings.backupFolder);
      setLastBackupAt(settings.lastBackupAt);
      setDbPath(settings.dbPath);
      const list = await ipc.backup.list();
      setBackups(list as BackupRecord[]);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAutoBackupToggle = async () => {
    const newValue = !autoBackup;
    try {
      await ipc.backup.setAutoBackup(newValue);
      setAutoBackup(newValue);
      setMessage(newValue ? 'Otomatik yedekleme açıldı.' : 'Otomatik yedekleme kapatıldı.');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleFrequency = async (f: typeof frequency) => {
    try {
      await ipc.backup.setFrequency(f);
      setFrequency(f);
      setMessage('Yedekleme sıklığı güncellendi.');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await ipc.backup.selectFolder();
      if (result.folder) {
        setBackupFolder(result.folder);
        setMessage(`Yedek klasörü: ${result.folder}`);
      }
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const result = await ipc.backup.create(backupFolder || undefined);
      setMessage(`Yedek oluşturuldu: ${result.backupPath}`);
      loadData();
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleRestore = async () => {
    if (
      !confirm(
        'Mevcut verileriniz değişecektir. Geri yüklemeden önce otomatik güvenlik yedeği alınacaktır. Devam edilsin mi?'
      )
    ) {
      return;
    }
    try {
      const result = await ipc.backup.restore();
      if (result.restored) {
        setMessage(result.message || 'Yedek geri yüklendi.');
        if (result.needsRestart) {
          await ipc.app.relaunch();
        }
      }
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  if (loading) return <div className="loading-text">Yükleniyor...</div>;

  return (
    <div className="page-content">
      <PageTitleBar title="Yedekleme" />

      {message && (
        <div
          className={`alert ${message.includes('oluşturuldu') || message.includes('açıldı') || message.includes('güncellendi') ? 'alert-success' : 'alert-info'}`}
        >
          {message}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">Yedekleme Ayarları</div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleCreateBackup}>
              Manuel Yedek Al
            </button>
            <button className="btn" onClick={handleRestore}>
              Yedekten Geri Yükle
            </button>
            <button className="btn" onClick={handleSelectFolder}>
              Yedek Klasörü Seç
            </button>
            <label className="checkbox-label">
              <input type="checkbox" checked={autoBackup} onChange={handleAutoBackupToggle} />
              Otomatik Yedek
            </label>
          </div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div className="form-group">
              <label>Otomatik Yedek Sıklığı</label>
              <select className="form-select" value={frequency} onChange={(e) => handleFrequency(e.target.value as typeof frequency)}>
                <option value="on_close">Her kapanışta</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
              </select>
            </div>
            <div className="form-group">
              <label>Son Yedek</label>
              <input className="form-input" value={lastBackupAt ? formatDateTime(lastBackupAt) : 'Henüz yok'} readOnly />
            </div>
          </div>
          <div className="form-group">
            <label>Veritabanı Konumu</label>
            <input className="form-input" value={dbPath} readOnly />
          </div>
          <div className="form-group">
            <label>Yedek Klasörü</label>
            <input className="form-input" value={backupFolder || '(Varsayılan: AppData klasörü)'} readOnly />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Veritabanı Bakımı (Yönetici)</div>
        <div className="panel-body">
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Bütünlük kontrolü ve VACUUM işlemleri yalnızca yönetici yetkisiyle kullanılabilir.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => ipc.app.openDbFolder()}>Veritabanı Klasörünü Aç</button>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const r = await ipc.db.integrityCheck();
                  setMessage(r.message);
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            >
              Bütünlük Kontrolü
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (!confirm('Veritabanı sıkıştırılacak (VACUUM). Devam edilsin mi?')) return;
                try {
                  const r = await ipc.db.vacuum();
                  setMessage(r.message);
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            >
              Boşluk Temizleme (VACUUM)
            </button>
            <button
              className="btn"
              onClick={async () => {
                if (!confirm('Demo verileri silinecek. Bu işlem geri alınamaz. Devam edilsin mi?')) return;
                try {
                  const r = await ipc.db.clearDemoData();
                  setMessage(r.message);
                  loadData();
                } catch (err) {
                  setMessage((err as Error).message);
                }
              }}
            >
              Demo Verileri Temizle
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="panel-header">Yedek Geçmişi</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Dosya Yolu</th>
                <th>Tür</th>
                <th className="text-right">Boyut</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-text">
                    Henüz yedek alınmamış
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDateTime(b.created_at)}</td>
                    <td>{b.file_path}</td>
                    <td>{b.backup_type}</td>
                    <td className="text-right">{formatFileSize(b.file_size)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
