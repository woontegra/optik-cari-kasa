import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { MEDULA_V2_DISCLAIMER } from '@/types/medulaV2';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/types/auth';
import '@/components/products/ProductForm.css';

interface Props {
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function InstitutionReceivableTab({ onToast, onError }: Props) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.SGK_EDIT);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ipc.institutionReceivables.list().then(setRows).catch((e) => onError(e.message)).finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const markCollected = async () => {
    if (!selectedId || !canEdit) return;
    try {
      await ipc.institutionReceivables.markCollected(selectedId);
      onToast('Kurum alacağı tahsil edildi olarak işaretlendi.');
      load();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header">Katkı Payı / Kurum Hakkı</div>
        <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666' }}>{MEDULA_V2_DISCLAIMER}</p>
        <div className="data-table-wrap">
          {loading ? <div className="loading-text">Yükleniyor...</div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kurum</th><th>Hasta</th><th>Satış</th><th>Toplam</th><th>Hasta Payı</th>
                  <th>Kurum Karşılığı</th><th>Tahsil Hasta</th><th>Bekleyen Kurum</th><th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={9} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                  <tr key={String(r.id)} className={selectedId === Number(r.id) ? 'selected' : ''} onClick={() => setSelectedId(Number(r.id))}>
                    <td>{String(r.institution_name || '-')}</td>
                    <td>{String(r.customer_name || '-')}</td>
                    <td>{String(r.sale_no || '-')}</td>
                    <td className="text-right">{formatCurrency(Number(r.total_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(r.patient_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(r.institution_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(r.collected_patient_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(r.remaining_institution_amount))}</td>
                    <td>{String(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="panel" style={{ width: 220 }}>
        <div className="panel-header">İşlemler</div>
        <div className="panel-body">
          {canEdit ? (
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!selectedId} onClick={markCollected}>Tahsil Edildi İşaretle</button>
          ) : (
            <p className="empty-text" style={{ fontSize: 11 }}>Tahsilat işaretleme yetkiniz yok.</p>
          )}
        </div>
      </div>
    </div>
  );
}
