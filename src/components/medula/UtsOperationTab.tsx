import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatDate } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import type { UtsOperationListFilters, UtsPendingRow } from '@/types/utsOperation';
import { UTS_DISCLAIMER, UTS_IGNORE_REASONS } from '@/types/utsOperation';

type OpMode = 'receive' | 'give' | 'return';

const OP_CONFIG: Record<OpMode, { type: string; label: string; prepareLabel: string; listFn: keyof typeof ipc.utsOperations }> = {
  receive: { type: 'ALMA_BILDIRIMI', label: 'Alma Bildirimi', prepareLabel: 'Alma Bildirimi Hazırla', listFn: 'listPendingReceive' },
  give: { type: 'VERME_BILDIRIMI', label: 'Verme Bildirimi', prepareLabel: 'Verme Bildirimi Hazırla', listFn: 'listPendingGive' },
  return: { type: 'IADE_BILDIRIMI', label: 'İade / Red Bildirimi', prepareLabel: 'İade Bildirimi Hazırla', listFn: 'listPendingReturn' },
};

interface UtsOperationTabProps {
  mode: OpMode;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function UtsOperationTab({ mode, onToast, onError }: UtsOperationTabProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.UTS_EDIT);
  const canExport = hasPermission(PERMISSIONS.UTS_EXPORT);
  const canMark = hasPermission(PERMISSIONS.UTS_MARK_PROCESSED);

  const cfg = OP_CONFIG[mode];
  const [rows, setRows] = useState<UtsPendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastOpId, setLastOpId] = useState<number | null>(null);
  const [filters, setFilters] = useState<UtsOperationListFilters>({});
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState<string>(UTS_IGNORE_REASONS[0]);

  const load = useCallback(() => {
    setLoading(true);
    const f = { ...filters, missing_only: showMissingOnly || undefined };
    const fn = ipc.utsOperations[cfg.listFn] as (f?: UtsOperationListFilters) => Promise<UtsPendingRow[]>;
    fn(f).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [cfg.listFn, filters, showMissingOnly]);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const prepare = async (force = false) => {
    if (!selected.size) { onError('Kayıt seçin.'); return; }
    try {
      const opType = mode === 'return' ? 'IADE_BILDIRIMI' : cfg.type;
      const result = await ipc.utsOperations.createOperation({
        operation_type: opType,
        row_keys: Array.from(selected),
        force_with_warnings: force,
      });
      setLastOpId(result.operationId);
      onToast(`${cfg.prepareLabel} oluşturuldu: ${result.operationNo}`);
      setSelected(new Set());
      load();
    } catch (err) {
      const msg = (err as Error).message;
      if (!force && msg.includes('eksik alan')) {
        if (confirm(`${msg}\n\nYine de hazırlamak istiyor musunuz?`)) await prepare(true);
      } else onError(msg);
    }
  };

  const exportExcel = async (force = false) => {
    if (!lastOpId) { onError('Önce bildirim hazırlayın.'); return; }
    try {
      const result = await ipc.utsOperations.exportExcel(lastOpId, cfg.type);
      if (result.exported) onToast(`Excel kaydedildi: ${result.filePath}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (!force) onError(msg);
    }
  };

  const markProcessed = async () => {
    if (!lastOpId || !canMark) return;
    await ipc.utsOperations.markProcessed([lastOpId]);
    onToast('ÜTS\'de işlendi olarak işaretlendi.');
    setLastOpId(null);
    load();
  };

  const markIgnored = async () => {
    if (!selected.size) return;
    await ipc.utsOperations.markIgnored({ row_keys: Array.from(selected), reason: ignoreReason });
    onToast('Seçili kayıtlar işlem dışı bırakıldı.');
    setSelected(new Set());
    load();
  };

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666', borderBottom: '1px solid var(--border)' }}>
        {UTS_DISCLAIMER}
      </p>
      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <input type="date" className="form-input" value={filters.date_from || ''} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} />
        <input type="date" className="form-input" value={filters.date_to || ''} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} />
        <input className="form-input" placeholder="Seri no" value={filters.serial_no || ''} onChange={(e) => setFilters((p) => ({ ...p, serial_no: e.target.value }))} />
        <input className="form-input" placeholder="Lot no" value={filters.lot_no || ''} onChange={(e) => setFilters((p) => ({ ...p, lot_no: e.target.value }))} />
        <input className="form-input" placeholder="UBB kodu" value={filters.ubb_code || ''} onChange={(e) => setFilters((p) => ({ ...p, ubb_code: e.target.value }))} />
        <input className="form-input search-input" placeholder="Ara..." value={filters.search || ''} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <label className="checkbox-label"><input type="checkbox" checked={showMissingOnly} onChange={(e) => setShowMissingOnly(e.target.checked)} /> Eksik alanlı</label>
        <button type="button" className="btn btn-sm" onClick={load}>Sorgula</button>
      </div>

      <div className="toolbar">
        {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={() => prepare()}>{cfg.prepareLabel}</button>}
        {canExport && <button type="button" className="btn btn-sm" disabled={!lastOpId} onClick={() => exportExcel()}>Excel&apos;e Aktar</button>}
        {canMark && <button type="button" className="btn btn-sm" disabled={!lastOpId} onClick={markProcessed}>ÜTS&apos;de İşlendi İşaretle</button>}
        {canEdit && (
          <>
            <select className="form-select" style={{ width: 160 }} value={ignoreReason} onChange={(e) => setIgnoreReason(e.target.value)}>
              {UTS_IGNORE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" className="btn btn-sm" disabled={!selected.size} onClick={markIgnored}>İşlem Dışı Bırak</button>
          </>
        )}
        {selected.size > 0 && <span style={{ fontSize: 'var(--font-size-xs)' }}>{selected.size} seçili</span>}
      </div>

      <div className="data-table-wrap">
        {loading ? <div className="loading-text">Yükleniyor...</div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                {mode === 'give' && <><th>Satış</th><th>Tarih</th><th>Müşteri</th></>}
                {mode === 'receive' && <><th>Mal Kabul</th><th>Tedarikçi</th></>}
                {mode === 'return' && <><th>Tarih</th><th>Tip</th><th>Müşteri</th></>}
                <th>Ürün</th>
                <th>Barkod</th>
                <th>UBB</th>
                <th>Seri</th>
                <th>Lot</th>
                <th>SKT</th>
                <th>Adet</th>
                <th>Durum</th>
                <th>Eksik</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={14} className="empty-text">Bekleyen kayıt yok</td></tr>
              ) : rows.map((r) => (
                <tr key={r.row_key} className={selected.has(r.row_key) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(r.row_key)} onChange={() => toggle(r.row_key)} /></td>
                  {mode === 'give' && (
                    <>
                      <td>{r.sale_no}</td>
                      <td>{formatDate(r.sale_date)}</td>
                      <td>{r.customer_name || '-'}</td>
                    </>
                  )}
                  {mode === 'receive' && (
                    <>
                      <td>{r.batch_no || '-'}</td>
                      <td>{r.supplier_name || '-'}</td>
                    </>
                  )}
                  {mode === 'return' && (
                    <>
                      <td>{formatDate(r.operation_date)}</td>
                      <td>{r.return_subtype || '-'}</td>
                      <td>{r.customer_name || '-'}</td>
                    </>
                  )}
                  <td>{r.product_name}</td>
                  <td>{r.barcode || r.gtin || '-'}</td>
                  <td>{r.ubb_code || '-'}</td>
                  <td>{r.serial_no || '-'}</td>
                  <td>{r.lot_no || '-'}</td>
                  <td>{formatDate(r.expiry_date)}</td>
                  <td>{r.quantity}</td>
                  <td>{r.uts_status}{r.warning_message ? ` (${r.warning_message})` : ''}</td>
                  <td className={r.has_warnings ? 'amount-negative' : ''}>{r.missing_fields.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
