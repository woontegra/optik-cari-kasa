import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import { PERMISSIONS } from '@/types/auth';
import type { UtsOperationHistoryFilters } from '@/types/utsOperation';
import { UTS_OPERATION_TYPES } from '@/types/utsOperation';

interface UtsOperationHistoryTabProps {
  onToast: (msg: string) => void;
}

export default function UtsOperationHistoryTab({ onToast }: UtsOperationHistoryTabProps) {
  const { hasPermission } = useAuth();
  const canExport = hasPermission(PERMISSIONS.UTS_EXPORT);
  const canMark = hasPermission(PERMISSIONS.UTS_MARK_PROCESSED);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState<UtsOperationHistoryFilters>({});
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    ipc.utsOperations.listHistory(filters).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    setDetailId(id);
    const d = await ipc.utsOperations.getDetail(id);
    setDetail(d);
  };

  const reExport = async (id: number, opType: string) => {
    const result = await ipc.utsOperations.exportExcel(id, opType);
    if (result.exported) onToast(`Excel: ${result.filePath}`);
  };

  const markProcessed = async (id: number) => {
    if (!canMark) return;
    await ipc.utsOperations.markProcessed([id]);
    onToast('İşlendi olarak işaretlendi.');
    load();
    if (detailId === id) openDetail(id);
  };

  const printDetail = () => {
    if (!detail) return;
    const op = detail.operation as Record<string, unknown>;
    const items = (detail.items as Record<string, unknown>[]) || [];
    const itemRows = items
      .map((i) => `<tr><td>${i.product_name}</td><td>${i.serial_no || '-'}</td><td>${i.lot_no || '-'}</td><td>${i.quantity}</td></tr>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ÜTS ${op.operation_no}</title></head><body>
      <h2>ÜTS Operasyon: ${op.operation_no}</h2><p>Tür: ${op.operation_type} | Durum: ${op.status}</p>
      <table border="1" cellpadding="4"><thead><tr><th>Ürün</th><th>Seri</th><th>Lot</th><th>Adet</th></tr></thead><tbody>${itemRows}</tbody></table></body></html>`;
    openPrintPreview({ html, title: String(op.operation_no) });
  };

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="filter-bar">
          <input type="date" className="form-input" value={filters.date_from || ''} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} />
          <input type="date" className="form-input" value={filters.date_to || ''} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} />
          <select className="form-select" value={filters.operation_type || ''} onChange={(e) => setFilters((p) => ({ ...p, operation_type: e.target.value || undefined }))}>
            <option value="">İşlem türü</option>
            {UTS_OPERATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="form-input" placeholder="Ara..." value={filters.search || ''} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
          <button type="button" className="btn btn-sm" onClick={load}>Sorgula</button>
        </div>
        <div className="data-table-wrap">
          {loading ? <div className="loading-text">Yükleniyor...</div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>İşlem No</th><th>Tarih</th><th>Tür</th><th>Kalem</th><th>Durum</th>
                  <th>Dışa Aktarım</th><th>İşlendi</th><th>Kullanıcı</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={9} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                  <tr key={String(r.id)} className={detailId === r.id ? 'selected' : ''} onClick={() => openDetail(Number(r.id))}>
                    <td>{r.operation_no as string}</td>
                    <td>{formatDateTime(r.operation_date as string)}</td>
                    <td>{r.operation_type as string}</td>
                    <td>{r.item_count as number}</td>
                    <td>{r.status as string}</td>
                    <td>{formatDateTime(r.exported_at as string)}</td>
                    <td>{formatDateTime(r.processed_at as string)}</td>
                    <td>{(r.created_by_name as string) || '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canExport && <button type="button" className="btn btn-sm" onClick={() => reExport(Number(r.id), String(r.operation_type))}>Excel</button>}
                      {canMark && r.status !== 'ÜTS\'de İşlendi' && (
                        <button type="button" className="btn btn-sm" onClick={() => markProcessed(Number(r.id))}>İşlendi</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && (
        <div className="panel" style={{ width: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header">Detay</div>
          <div style={{ padding: 8, fontSize: 'var(--font-size-sm)', flex: 1, overflow: 'auto' }}>
            <p><strong>No:</strong> {(detail.operation as Record<string, unknown>).operation_no as string}</p>
            <p><strong>Durum:</strong> {(detail.operation as Record<string, unknown>).status as string}</p>
            <button type="button" className="btn btn-sm" style={{ marginBottom: 8 }} onClick={printDetail}>Yazdır</button>
            <h4 style={{ margin: '8px 0 4px' }}>Loglar</h4>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {((detail.logs as Record<string, unknown>[]) || []).map((l) => (
                <li key={String(l.id)}>{formatDateTime(l.created_at as string)} — {l.description as string}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
