import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { MEDULA_STATUSES, PRESCRIPTION_TYPES } from '@/types/medula';
import type { SgkPrescriptionListFilters, SgkPrescriptionRow } from '@/types/medulaV2';
import { MEDULA_V2_DISCLAIMER } from '@/types/medulaV2';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/types/auth';
import MedulaInfoModal from './MedulaInfoModal';
import '@/components/products/ProductForm.css';

interface Props {
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function SgkPrescriptionsTab({ onToast, onError }: Props) {
  const { hasPermission } = useAuth();
  const canMark = hasPermission(PERMISSIONS.MEDULA_MARK_PROCESSED);
  const canEdit = hasPermission(PERMISSIONS.MEDULA_EDIT);
  const [rows, setRows] = useState<SgkPrescriptionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [filters, setFilters] = useState<SgkPrescriptionListFilters>({});

  const load = useCallback(() => {
    setLoading(true);
    ipc.medula.listSgkPrescriptions(filters).then(setRows).catch((e) => onError(e.message)).finally(() => setLoading(false));
  }, [filters, onError]);

  useEffect(() => { load(); }, [load]);

  const selected = rows.find((r) => r.sale_id === selectedId);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    if (!selectedId) return;
    try {
      await fn();
      onToast(msg);
      load();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">SGK / Kurum Reçeteleri</div>
        <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666', borderBottom: '1px solid var(--border)' }}>
          {MEDULA_V2_DISCLAIMER}
        </p>
        <div className="filter-bar">
          <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))} />
          <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))} />
          <select className="form-select" onChange={(e) => setFilters((f) => ({ ...f, prescription_type: e.target.value || undefined }))}>
            <option value="">Reçete Türü</option>
            {PRESCRIPTION_TYPES.filter((t) => t !== 'Özel').map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select" onChange={(e) => setFilters((f) => ({ ...f, medula_status: e.target.value || undefined }))}>
            <option value="">Medula Durumu</option>
            {MEDULA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="form-input" placeholder="Hasta / T.C." onChange={(e) => setFilters((f) => ({ ...f, customer_search: e.target.value || undefined }))} />
          <button className="btn" onClick={load}>Filtrele</button>
        </div>
        <div className="data-table-wrap">
          {loading ? <div className="loading-text">Yükleniyor...</div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th><th>Hasta</th><th>T.C.</th><th>E-Reçete</th><th>Provizyon</th>
                  <th>Kurum</th><th>Satış</th><th>Toplam</th><th>Hasta Payı</th><th>Kurum</th><th>Durum</th><th>Eksik</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={12} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                  <tr key={r.sale_id} className={selectedId === r.sale_id ? 'selected' : ''} onClick={() => setSelectedId(r.sale_id)}>
                    <td>{r.prescription_date || '-'}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td>{r.customer_tc || '-'}</td>
                    <td>{r.e_prescription_no || '-'}</td>
                    <td>{r.provision_no || '-'}</td>
                    <td>{r.institution || '-'}</td>
                    <td>{r.sale_no}</td>
                    <td className="text-right">{formatCurrency(r.net_amount)}</td>
                    <td className="text-right">{formatCurrency(r.patient_amount)}</td>
                    <td className="text-right">{formatCurrency(r.institution_amount)}</td>
                    <td>{r.medula_status}</td>
                    <td className={r.missing_count > 0 ? 'amount-negative' : ''}>{r.missing_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="panel" style={{ width: 260 }}>
        <div className="panel-header">İşlemler</div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          {!selected ? <p className="empty-text">Kayıt seçin</p> : (
            <>
              {selected.missing_count > 0 && (
                <div className="amount-negative" style={{ marginBottom: 8, fontSize: 11 }}>{selected.missing_fields}</div>
              )}
              <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => setShowInfo(true)} disabled={!canEdit}>Medula Bilgisi Gir</button>
              {canMark && (
                <>
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => act(() => ipc.medula.markProcessed([selectedId!]), 'Medula\'ya işlendi')}>Medula&apos;ya İşlendi</button>
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => act(() => ipc.medula.markInvoiceReady([selectedId!]), 'Faturaya hazır')}>Faturaya Hazır</button>
                </>
              )}
              {canEdit && <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => act(() => ipc.medula.markIgnored([selectedId!]), 'İşlem dışı')}>İşlem Dışı</button>}
              <button className="btn" style={{ width: '100%' }} onClick={() => act(() => ipc.medula.exportSgkExcel([selectedId!]), 'Excel aktarıldı')}>Excel&apos;e Aktar</button>
            </>
          )}
        </div>
      </div>
      {showInfo && selectedId && (
        <MedulaInfoModal saleId={selectedId} onClose={() => setShowInfo(false)} onSaved={() => { setShowInfo(false); onToast('Medula bilgisi kaydedildi'); load(); }} />
      )}
    </div>
  );
}
