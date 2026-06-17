import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatDateTime } from '@/utils/format';
import { PRODUCT_TYPES } from '@/types/electron';
import {
  TITUBB_DISCLAIMER,
  TITUBB_HELP_TEXT,
  TITUBB_STATUSES,
  type TitubbListFilters,
  type TitubbPendingRow,
} from '@/types/titubb';

export default function TitubbNotificationTab() {
  const [rows, setRows] = useState<TitubbPendingRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [exports, setExports] = useState<Record<string, unknown>[]>([]);
  const [selectedExportId, setSelectedExportId] = useState<number | null>(null);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productType, setProductType] = useState('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [ubbCode, setUbbCode] = useState('');
  const [utsProductNo, setUtsProductNo] = useState('');
  const [barcode, setBarcode] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [status, setStatus] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    ipc.suppliers.list().then(setSuppliers).catch(() => undefined);
  }, []);

  const buildFilters = useCallback((): TitubbListFilters => ({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    product_type: productType || undefined,
    supplier_id: supplierId === '' ? undefined : supplierId,
    batch_no: batchNo || undefined,
    ubb_code: ubbCode || undefined,
    uts_product_no: utsProductNo || undefined,
    barcode: barcode || undefined,
    serial_no: serialNo || undefined,
    lot_no: lotNo || undefined,
    status: status || undefined,
    missing_only: showMissingOnly || undefined,
  }), [dateFrom, dateTo, productType, supplierId, batchNo, ubbCode, utsProductNo, barcode, serialNo, lotNo, status, showMissingOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ipc.titubb.listPending(buildFilters());
      setRows(data);
      setSelected(new Set());
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  const loadExports = async () => {
    try {
      setExports(await ipc.titubb.listExports());
    } catch {
      setExports([]);
    }
  };

  const toggleRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.row_key)));
  };

  const handleExport = async () => {
    const keys = selected.size ? [...selected] : rows.map((r) => r.row_key);
    if (!keys.length) {
      setError('Dışa aktarılacak kayıt yok.');
      return;
    }
    setError('');
    try {
      const validation = await ipc.titubb.validateRows(keys);
      if (validation.invalidCount > 0 && !allowIncomplete) {
        if (!window.confirm(`${validation.invalidCount} kayıtta eksik alan var. Yine de Excel oluşturulsun mu? (Hatalı olabilir)`)) {
          return;
        }
      }
      const dup = rows.filter((r) => keys.includes(r.row_key) && r.previously_uploaded);
      if (dup.length) {
        setError(`Uyarı: ${dup.length} kayıt daha önce ÜTS'ye yüklendi olarak işaretlenmiş.`);
      }
      const result = await ipc.titubb.exportExcel({ row_keys: keys, allow_incomplete: allowIncomplete || validation.invalidCount > 0 });
      if (result.exported) {
        showToast(`Excel oluşturuldu: ${result.exportNo}`);
        if (result.warnings?.length) setError(result.warnings.join(' '));
        load();
        loadExports();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleMarkUploaded = async () => {
    if (!selectedExportId) {
      setError('Geçmişten bir dışa aktarım seçin.');
      return;
    }
    try {
      await ipc.titubb.markUploaded(selectedExportId);
      showToast('ÜTS\'ye yüklendi olarak işaretlendi.');
      load();
      loadExports();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleMarkIgnored = async () => {
    const keys = [...selected];
    if (!keys.length) {
      setError('İşlem dışı bırakılacak satırları seçin.');
      return;
    }
    try {
      await ipc.titubb.markIgnored({ row_keys: keys });
      showToast('Seçili kayıtlar işlem dışı bırakıldı.');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const missingCount = rows.filter((r) => r.has_warnings).length;

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">TİTUBB Bildirimi — Bildirilecek Ürünler</div>
        <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666', borderBottom: '1px solid var(--border)' }}>
          {TITUBB_DISCLAIMER}
        </p>
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Başlangıç" />
          <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Bitiş" />
          <select className="form-select" value={productType} onChange={(e) => setProductType(e.target.value)}>
            <option value="">Ürün tipi</option>
            {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Tedarikçi</option>
            {suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
          </select>
          <input className="form-input" placeholder="Mal kabul fişi" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          <input className="form-input" placeholder="UBB" value={ubbCode} onChange={(e) => setUbbCode(e.target.value)} />
          <input className="form-input" placeholder="ÜTS ürün no" value={utsProductNo} onChange={(e) => setUtsProductNo(e.target.value)} />
          <input className="form-input" placeholder="Barkod/GTIN" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <input className="form-input" placeholder="Seri no" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
          <input className="form-input" placeholder="Lot no" value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Durum</option>
            {TITUBB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={load}>Sorgula</button>
        </div>
        {toast && <div className="toast-success" style={{ margin: '4px 8px' }}>{toast}</div>}
        {error && <div className="alert alert-error" style={{ margin: '4px 8px' }}>{error}</div>}
        <div className="data-table-wrap">
          {loading ? <div className="loading-text">Yükleniyor...</div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                  <th>Ürün</th><th>Tip</th><th>Barkod</th><th>UBB</th><th>ÜTS No</th>
                  <th>Seri</th><th>Lot</th><th>SKT</th><th>Tedarikçi</th><th>Fiş</th><th>Belge</th><th>Adet</th><th>Durum</th><th>Eksik</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={15} className="empty-text">Kayıt yok — Sorgula&apos;ya basın</td></tr>
                ) : rows.map((r) => (
                  <tr
                    key={r.row_key}
                    className={r.has_warnings ? 'count-row-missing' : r.previously_uploaded ? 'count-row-unscanned' : ''}
                    onClick={() => toggleRow(r.row_key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.row_key)} onChange={() => toggleRow(r.row_key)} />
                    </td>
                    <td>{r.product_name}</td>
                    <td>{r.product_type}</td>
                    <td>{r.gtin || r.barcode || '-'}</td>
                    <td>{r.ubb_code || '-'}</td>
                    <td>{r.uts_product_no || '-'}</td>
                    <td>{r.serial_no || '-'}</td>
                    <td>{r.lot_no || '-'}</td>
                    <td>{r.expiry_date || '-'}</td>
                    <td>{r.supplier_name || '-'}</td>
                    <td>{r.batch_no || '-'}</td>
                    <td>{r.document_no || '-'}</td>
                    <td className="text-center">{r.quantity}</td>
                    <td>{r.titubb_status}</td>
                    <td style={{ fontSize: 10, color: r.has_warnings ? '#c0392b' : '#888' }}>
                      {r.missing_fields.length ? r.missing_fields.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ fontSize: 11, padding: 8, color: '#555', borderTop: '1px solid var(--border)' }}>
          {TITUBB_HELP_TEXT}
        </div>
      </div>

      <div className="panel" style={{ width: 280, display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header">İşlemler</div>
        <div className="panel-body" style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>Seçili: {selected.size} / {rows.length} | Eksik: {missingCount}</div>
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginBottom: 4 }}
            onClick={async () => {
              const next = !showMissingOnly;
              setShowMissingOnly(next);
              if (rows.length > 0) {
                setLoading(true);
                try {
                  const data = await ipc.titubb.listPending({ ...buildFilters(), missing_only: next || undefined });
                  setRows(data);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setLoading(false);
                }
              }
            }}
          >
            {showMissingOnly ? 'Tümünü Göster' : 'Eksik Alanları Göster'}
          </button>
          <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: 4 }} onClick={handleExport}>
            Excel&apos;e Gönder
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, fontSize: 11 }}>
            <input type="checkbox" checked={allowIncomplete} onChange={(e) => setAllowIncomplete(e.target.checked)} />
            Eksik alana rağmen aktar
          </label>
          <button type="button" className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={handleMarkUploaded}>
            ÜTS&apos;ye Yüklendi İşaretle
          </button>
          <button type="button" className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={handleMarkIgnored}>
            İşlem Dışı Bırak
          </button>
          <button type="button" className="btn" style={{ width: '100%' }} onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadExports(); }}>
            İşlem Geçmişi
          </button>
          {showHistory && (
            <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', border: '1px solid #ddd' }}>
              {exports.map((e) => (
                <div
                  key={String(e.id)}
                  style={{
                    padding: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                    background: selectedExportId === Number(e.id) ? '#e8f4fc' : undefined,
                  }}
                  onClick={() => setSelectedExportId(Number(e.id))}
                >
                  <div><strong>{String(e.export_no)}</strong></div>
                  <div>{formatDateTime(String(e.exported_at))} — {String(e.record_count)} kayıt</div>
                  <div>{String(e.status)}</div>
                </div>
              ))}
              {!exports.length && <div className="empty-text" style={{ padding: 8 }}>Geçmiş yok</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
