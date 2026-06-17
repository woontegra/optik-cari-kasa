import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatDateTime } from '@/utils/format';
import { MEDULA_V2_DISCLAIMER } from '@/types/medulaV2';
import '@/components/products/ProductForm.css';

export default function MedulaTrackingTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ipc.medula.listPending({}).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">Medula İşlem Takibi — Bekleyen Kayıtlar</div>
      <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666' }}>{MEDULA_V2_DISCLAIMER}</p>
      <div className="data-table-wrap">
        {loading ? <div className="loading-text">Yükleniyor...</div> : (
          <table className="data-table">
            <thead>
              <tr><th>Tarih</th><th>Hasta</th><th>Reçete</th><th>Satış</th><th>Durum</th><th>Eksik</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={6} className="empty-text">Bekleyen kayıt yok</td></tr> : rows.map((r) => (
                <tr key={String(r.sale_id)}>
                  <td>{formatDateTime(String(r.sale_date))}</td>
                  <td>{String(r.customer_name || '-')}</td>
                  <td>{String(r.prescription_no || r.e_prescription_no || '-')}</td>
                  <td>{String(r.sale_no)}</td>
                  <td>{String(r.medula_status)}</td>
                  <td className={Number(r.missing_count) > 0 ? 'amount-negative' : ''}>{String(r.missing_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
