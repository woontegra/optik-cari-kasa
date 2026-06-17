import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { PERMISSIONS } from '@/types/auth';
import type { UtsImportRow } from '@/types/utsOperation';
import { UTS_AUTO_IMPORT_DISCLAIMER } from '@/types/utsOperation';

interface UtsAutoImportPanelProps {
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function UtsAutoImportPanel({ onToast, onError }: UtsAutoImportPanelProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.UTS_EDIT);
  const [rows, setRows] = useState<UtsImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [documentNo, setDocumentNo] = useState('');

  const importFile = async () => {
    setLoading(true);
    try {
      const res = await ipc.utsOperations.importUtsFile();
      if (!res.cancelled) setRows(res.rows);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createStockEntry = async () => {
    if (!rows.length) return;
    try {
      const result = await ipc.utsOperations.createStockEntryFromImport({
        rows,
        document_no: documentNo || undefined,
      });
      onToast(`Mal kabul taslağı oluşturuldu: ${result.batchNo} (${result.itemCount} kalem). Stok Giriş ekranından tamamlayın.`);
      setRows([]);
    } catch (err) {
      onError((err as Error).message);
    }
  };

  if (!canEdit) return null;

  return (
    <div className="panel" style={{ marginBottom: 8 }}>
      <div className="panel-header">ÜTS Otomatik Giriş Hazırlığı</div>
      <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666' }}>{UTS_AUTO_IMPORT_DISCLAIMER}</p>
      <div className="toolbar" style={{ padding: '0 8px 8px' }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={importFile} disabled={loading}>
          ÜTS Dosyasından Stok Girişi Hazırla
        </button>
        <input className="form-input" placeholder="Belge no" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} style={{ width: 140 }} />
        {rows.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={createStockEntry}>
            Mal Kabul Fişi Oluştur ({rows.filter((r) => r.match_status === 'matched').length}/{rows.length} eşleşti)
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="data-table-wrap" style={{ maxHeight: 200 }}>
          <table className="data-table">
            <thead><tr><th>Ürün</th><th>GTIN</th><th>Seri</th><th>Lot</th><th>Eşleşme</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.matched_product_name || r.product_name || '-'}</td>
                  <td>{r.gtin || r.barcode || '-'}</td>
                  <td>{r.serial_no || '-'}</td>
                  <td>{r.lot_no || '-'}</td>
                  <td>{r.match_status === 'matched' ? 'Eşleşti' : 'Eşleşmedi'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
