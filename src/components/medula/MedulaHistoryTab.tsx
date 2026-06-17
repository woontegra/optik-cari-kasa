import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatDateTime } from '@/utils/format';
import { MEDULA_V2_DISCLAIMER } from '@/types/medulaV2';
import '@/components/products/ProductForm.css';

export default function MedulaHistoryTab() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ipc.medula.listOperations().then(setRows).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    const d = await ipc.medula.getOperationDetail(id);
    setDetail(d);
  };

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
      <div className="panel" style={{ flex: 1 }}>
        <div className="panel-header">Medula İşlem Geçmişi</div>
        <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666' }}>{MEDULA_V2_DISCLAIMER}</p>
        <div className="data-table-wrap">
          {loading ? <div className="loading-text">Yükleniyor...</div> : (
            <table className="data-table">
              <thead>
                <tr><th>Tarih</th><th>İşlem No</th><th>Tip</th><th>Hasta</th><th>Satış</th><th>Durum</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={6} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                  <tr key={String(r.id)} onClick={() => openDetail(Number(r.id))}>
                    <td>{formatDateTime(String(r.operation_date))}</td>
                    <td>{String(r.operation_no)}</td>
                    <td>{String(r.operation_type)}</td>
                    <td>{String(r.customer_name || '-')}</td>
                    <td>{String(r.sale_no || '-')}</td>
                    <td>{String(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {detail && (
        <div className="panel" style={{ width: 280 }}>
          <div className="panel-header">Detay</div>
          <div className="panel-body" style={{ fontSize: 11 }}>
            <p><strong>Not:</strong> {String(detail.notes || '-')}</p>
            <ul style={{ paddingLeft: 16 }}>
              {((detail.logs as Array<Record<string, unknown>>) || []).map((l) => (
                <li key={String(l.id)}>{String(l.description)} — {formatDateTime(String(l.created_at))}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
