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

export default function SgkInvoiceTab({ onToast, onError }: Props) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.SGK_EDIT);
  const [readyRows, setReadyRows] = useState<Record<string, unknown>[]>([]);
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      ipc.sgkInvoices.listReady({ date_from: dateFrom || undefined, date_to: dateTo || undefined, invoice_ready: true }),
      ipc.sgkInvoices.listBatches(),
    ])
      .then(([ready, batchList]) => {
        setReadyRows(ready);
        setBatches(batchList);
      })
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, onError]);

  useEffect(() => { load(); }, [load]);

  const createBatch = async () => {
    if (!dateFrom || !dateTo) {
      onError('Tarih aralığı seçin.');
      return;
    }
    try {
      const r = await ipc.sgkInvoices.createBatch({ date_from: dateFrom, date_to: dateTo });
      onToast(`Fatura hazırlık listesi oluşturuldu: ${r.batchNo}`);
      setSelectedBatch(r.batchId);
      load();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const printBatch = async () => {
    if (!selectedBatch) return;
    const { html } = await ipc.sgkInvoices.print(selectedBatch);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
      <p style={{ fontSize: 11, margin: 0, color: '#666' }}>{MEDULA_V2_DISCLAIMER}</p>
      <div className="filter-bar">
        <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="btn" onClick={load}>Yenile</button>
        {canEdit && <button className="btn btn-primary" onClick={createBatch}>Fatura Hazırlık Listesi Oluştur</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 200 }}>
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-header">Faturaya Hazır Reçeteler ({readyRows.length})</div>
          <div className="data-table-wrap" style={{ maxHeight: 220 }}>
            <table className="data-table">
              <thead><tr><th>Hasta</th><th>Reçete</th><th>Satış</th><th>Kurum Karşılığı</th></tr></thead>
              <tbody>
                {readyRows.map((r) => (
                  <tr key={String(r.sale_id)}>
                    <td>{String(r.customer_name)}</td>
                    <td>{String(r.e_prescription_no || r.prescription_no || '-')}</td>
                    <td>{String(r.sale_no)}</td>
                    <td className="text-right">{formatCurrency(Number(r.institution_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-header">Fatura Batch Geçmişi</div>
          <div className="data-table-wrap" style={{ maxHeight: 220 }}>
            <table className="data-table">
              <thead><tr><th>Batch</th><th>Dönem</th><th>Tutar</th><th>Durum</th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={String(b.id)} className={selectedBatch === Number(b.id) ? 'selected' : ''} onClick={() => setSelectedBatch(Number(b.id))}>
                    <td>{String(b.batch_no)}</td>
                    <td>{String(b.date_from)} — {String(b.date_to)}</td>
                    <td className="text-right">{formatCurrency(Number(b.total_institution_amount))}</td>
                    <td>{String(b.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedBatch && canEdit && (
        <div className="filter-bar">
          <button className="btn" onClick={() => ipc.sgkInvoices.exportExcel(selectedBatch).then((r) => r.exported && onToast(`Excel: ${r.filePath}`))}>Excel&apos;e Aktar</button>
          <button className="btn" onClick={printBatch}>Yazdır</button>
          <button className="btn btn-primary" onClick={() => ipc.sgkInvoices.markInvoiced(selectedBatch).then(() => { onToast('Faturalandı'); load(); })}>Faturalandı İşaretle</button>
          <button className="btn" onClick={() => ipc.sgkInvoices.markCollected(selectedBatch).then(() => { onToast('Tahsil edildi'); load(); })}>Tahsil Edildi</button>
        </div>
      )}
      {loading && <div className="loading-text">Yükleniyor...</div>}
    </div>
  );
}
