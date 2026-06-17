import { useCallback, useEffect, useRef, useState } from 'react';
import { ipc } from '@/services/ipc';
import { sanitizeBarcode } from '@/utils/barcode';
import { formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import { PRODUCT_TYPES } from '@/types/electron';
import type { Product } from '@/types/electron';
import {
  COUNT_TYPES,
  type CountDetail,
  type CountItemRow,
  type CountListRow,
  type CountSummary,
  type UnknownScanRow,
  itemRowClass,
} from '@/types/inventoryCount';
import QuickProductModal from '@/components/stock/QuickProductModal';
import type { ParsedBarcode } from '@/types/barcode';
import '@/components/products/ProductForm.css';

type Tab = 'new' | 'history';

export default function InventoryCountPage() {
  const [tab, setTab] = useState<Tab>('new');
  const [activeCount, setActiveCount] = useState<CountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [name, setName] = useState('');
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));
  const [countType, setCountType] = useState<string>(COUNT_TYPES[0]);
  const [productTypeFilter, setProductTypeFilter] = useState('Tümü');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);

  const [barcode, setBarcode] = useState('');
  const [lastUnknownCode, setLastUnknownCode] = useState<string | null>(null);
  const [lastUnknownParsed, setLastUnknownParsed] = useState<ParsedBarcode | null>(null);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [quickUnknown, setQuickUnknown] = useState<UnknownScanRow | null>(null);
  const [linkUnknown, setLinkUnknown] = useState<UnknownScanRow | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkProducts, setLinkProducts] = useState<Product[]>([]);
  const [manualEdit, setManualEdit] = useState<{ item: CountItemRow; qty: string; note: string } | null>(null);
  const [completeModal, setCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const [history, setHistory] = useState<CountListRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailCount, setDetailCount] = useState<CountDetail | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadActive = useCallback(async () => {
    try {
      const active = await ipc.inventory.getActiveCount();
      setActiveCount(active);
    } catch {
      setActiveCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await ipc.inventory.listCounts();
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    if (activeCount && tab === 'new') focusInput();
  }, [activeCount, tab, focusInput]);

  const refreshCount = async (countId: number) => {
    const detail = await ipc.inventory.getCountById(countId);
    if (detail.status === 'Devam Ediyor') setActiveCount(detail);
    else setActiveCount(null);
    return detail;
  };

  const handleStartCount = async () => {
    if (!name.trim()) {
      setError('Sayım adı zorunludur.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const detail = await ipc.inventory.createCount({
        name: name.trim(),
        count_date: countDate,
        count_type: countType as (typeof COUNT_TYPES)[number],
        product_type_filter: productTypeFilter,
        category_filter: categoryFilter || undefined,
        brand_filter: brandFilter || undefined,
        location_filter: locationFilter || undefined,
        notes: notes || undefined,
      });
      setActiveCount(detail);
      showToast(`Sayım başlatıldı: ${detail.count_no}`);
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const applyScanResult = (detail: CountDetail, summary?: CountSummary) => {
    setActiveCount({ ...detail, summary: summary || detail.summary });
  };

  const handleBarcodeSubmit = async () => {
    if (!activeCount) return;
    const code = sanitizeBarcode(barcode);
    setBarcode('');
    if (!code) return;

    try {
      const result = await ipc.inventory.scanCode(activeCount.id, code);
      if (result.success && result.summary) {
        const detail = await refreshCount(activeCount.id);
        applyScanResult(detail, result.summary);
        setError('');
        focusInput();
        return;
      }
      if (result.warning) {
        setError(result.warning);
        focusInput();
        return;
      }
      if (result.message) {
        setError(result.message);
        setLastUnknownCode(code);
        setLastUnknownParsed(result.parsed as ParsedBarcode | null);
        focusInput();
      }
    } catch (err) {
      setError((err as Error).message);
      focusInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleBarcodeSubmit();
    }
  };

  const addToPending = async () => {
    if (!activeCount || !lastUnknownCode) return;
    try {
      const { detail } = await ipc.inventory.addUnknownScan(activeCount.id, lastUnknownCode);
      setActiveCount(detail);
      setLastUnknownCode(null);
      setLastUnknownParsed(null);
      setError('');
      showToast('Barkod bekleyen listeye eklendi.');
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeCount) return;
    try {
      await ipc.inventory.saveDraft(activeCount.id);
      showToast('Taslak kaydedildi.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleComplete = async () => {
    if (!activeCount) return;
    setCompleting(true);
    try {
      const detail = await ipc.inventory.completeCount(activeCount.id);
      setActiveCount(null);
      setCompleteModal(false);
      showToast(`Sayım tamamlandı: ${detail.count_no}`);
      setTab('history');
      loadHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const handleApplyAdjustments = async (countId: number) => {
    setAdjusting(true);
    setError('');
    try {
      const result = await ipc.inventory.applyAdjustments(countId);
      showToast(`Stok farkları işlendi: ${result.countNo} (${result.adjustedItems} kalem)`);
      if (detailCount?.id === countId) {
        const d = await ipc.inventory.getCountById(countId);
        setDetailCount(d);
      }
      loadHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleManualSave = async () => {
    if (!activeCount || !manualEdit) return;
    const qty = parseInt(manualEdit.qty, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setError('Geçerli bir adet girin.');
      return;
    }
    try {
      const { item, summary } = await ipc.inventory.updateItemQuantity(activeCount.id, {
        item_id: manualEdit.item.id,
        counted_quantity: qty,
        note: manualEdit.note || undefined,
      });
      const detail = await refreshCount(activeCount.id);
      const items = detail.items.map((i) => (i.id === item.id ? item : i));
      setActiveCount({ ...detail, items, summary });
      setManualEdit(null);
      showToast('Sayılan adet güncellendi.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openLinkModal = async (unknown: UnknownScanRow) => {
    setLinkUnknown(unknown);
    setLinkSearch('');
    try {
      const products = await ipc.products.list({ status: 'Aktif' });
      setLinkProducts(products);
    } catch {
      setLinkProducts([]);
    }
  };

  const handleLinkProduct = async (productId: number) => {
    if (!linkUnknown) return;
    const countId = activeCount?.id ?? linkUnknown.count_id;
    try {
      const result = await ipc.inventory.resolveUnknownScan(countId, {
        unknown_id: linkUnknown.id,
        action: 'link',
        product_id: productId,
      });
      if ('items' in result) {
        if (activeCount?.id === countId) setActiveCount(result as CountDetail);
        if (detailCount?.id === countId) setDetailCount(result as CountDetail);
      }
      setLinkUnknown(null);
      showToast('Ürün sayıma bağlandı.');
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveUnknown = async (unknownId: number, countId: number) => {
    try {
      await ipc.inventory.resolveUnknownScan(countId, { unknown_id: unknownId, action: 'remove' });
      if (activeCount?.id === countId) {
        const d = await refreshCount(countId);
        setActiveCount(d);
      }
      if (detailCount?.id === countId) {
        setDetailCount(await ipc.inventory.getCountById(countId));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleQuickProductSaved = async (result: {
    productId: number;
    barcode: string;
    serialNo?: string;
    lotNo?: string;
    expiryDate?: string;
  }) => {
    setShowQuickProduct(false);
    if (!quickUnknown) return;
    const countId = activeCount?.id ?? quickUnknown.count_id;
    try {
      await ipc.inventory.resolveUnknownScan(countId, {
        unknown_id: quickUnknown.id,
        action: 'link',
        product_id: result.productId,
      });
      if (activeCount?.id === countId) {
        const d = await refreshCount(countId);
        setActiveCount(d);
      }
      if (detailCount?.id === countId) {
        setDetailCount(await ipc.inventory.getCountById(countId));
      }
      setQuickUnknown(null);
      showToast('Ürün oluşturuldu ve sayıma eklendi.');
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePrint = async (countId: number) => {
    try {
      const doc = await ipc.inventory.printReport(countId);
      openPrintPreview(doc);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleExport = async (countId: number) => {
    try {
      const result = await ipc.inventory.exportExcel(countId);
      if (result.exported) showToast('Excel dosyası kaydedildi.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCancel = async (countId: number) => {
    if (!window.confirm('Sayımı iptal etmek istiyor musunuz?')) return;
    try {
      await ipc.inventory.cancelCount(countId);
      if (activeCount?.id === countId) setActiveCount(null);
      setDetailCount(null);
      loadHistory();
      showToast('Sayım iptal edildi.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const summary = activeCount?.summary;
  const items = activeCount?.items || [];
  const unknowns = activeCount?.unknowns?.filter((u) => u.status === 'Bekliyor') || [];

  const renderSummary = (s: CountSummary | undefined) => {
    if (!s) return null;
    return (
      <div className="count-summary-box">
        <div><div className="stat-label">Ürün çeşidi</div><div className="stat-value">{s.totalKinds}</div></div>
        <div><div className="stat-label">Beklenen adet</div><div className="stat-value">{s.totalExpected}</div></div>
        <div><div className="stat-label">Sayılan adet</div><div className="stat-value">{s.totalCounted}</div></div>
        <div><div className="stat-label">Eksik çeşit</div><div className="stat-value">{s.missingKinds}</div></div>
        <div><div className="stat-label">Fazla çeşit</div><div className="stat-value">{s.excessKinds}</div></div>
        <div><div className="stat-label">Sayılmayan</div><div className="stat-value">{s.unscannedKinds}</div></div>
        <div><div className="stat-label">Bilinmeyen barkod</div><div className="stat-value">{s.unknownCount}</div></div>
        <div style={{ gridColumn: 'span 2' }}><div className="stat-label">Son okutulan</div><div className="stat-value" style={{ fontSize: 12 }}>{s.lastScannedCode || '-'}</div></div>
      </div>
    );
  };

  const renderItemsTable = (
    rows: CountItemRow[],
    editable: boolean,
    countId: number
  ) => (
    <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Barkod</th>
            <th>Ürün</th>
            <th>Tip</th>
            <th>Marka</th>
            <th>Model</th>
            <th>Raf</th>
            <th className="text-right">Beklenen</th>
            <th className="text-right">Sayılan</th>
            <th className="text-right">Fark</th>
            <th>Durum</th>
            <th>Son okutma</th>
            {editable && <th>İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className={itemRowClass(item.status)}>
              <td>{item.barcode || '-'}</td>
              <td>{item.product_name}</td>
              <td>{item.product_type}</td>
              <td>{item.brand || '-'}</td>
              <td>{item.model || '-'}</td>
              <td>{item.shelf_location || '-'}</td>
              <td className="text-right">{item.expected_quantity}</td>
              <td className="text-right">{item.counted_quantity}</td>
              <td className="text-right">{item.difference_quantity}</td>
              <td>{item.status}</td>
              <td>{item.last_scanned_at ? formatDateTime(item.last_scanned_at) : '-'}</td>
              {editable && (
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => setManualEdit({ item, qty: String(item.counted_quantity), note: '' })}>
                    Düzelt
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={editable ? 12 : 11} style={{ textAlign: 'center', color: '#888' }}>Kayıt yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderUnknownTable = (rows: UnknownScanRow[], countId: number, editable: boolean) => (
    <div className="table-wrap" style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Ham barkod</th>
            <th>Temizlenmiş</th>
            <th>Tip</th>
            <th>GTIN</th>
            <th>Seri</th>
            <th>Lot</th>
            <th>SKT</th>
            <th>Zaman</th>
            <th>Not</th>
            {editable && <th>İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {rows.filter((u) => u.status === 'Bekliyor').map((u) => (
            <tr key={u.id}>
              <td style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.raw_code}</td>
              <td>{u.normalized_code}</td>
              <td>{u.barcode_type || '-'}</td>
              <td>{u.gtin || '-'}</td>
              <td>{u.serial_no || '-'}</td>
              <td>{u.lot_no || '-'}</td>
              <td>{u.expiry_date || '-'}</td>
              <td>{formatDateTime(u.scanned_at)}</td>
              <td>{u.notes || '-'}</td>
              {editable && (
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-sm" onClick={() => { setQuickUnknown(u); setShowQuickProduct(true); }}>Hızlı ürün</button>
                  {' '}
                  <button type="button" className="btn btn-sm" onClick={() => openLinkModal(u)}>Bağla</button>
                  {' '}
                  <button type="button" className="btn btn-sm" onClick={() => handleRemoveUnknown(u.id, countId)}>Kaldır</button>
                </td>
              )}
            </tr>
          ))}
          {!rows.filter((u) => u.status === 'Bekliyor').length && (
            <tr><td colSpan={editable ? 10 : 9} style={{ textAlign: 'center', color: '#888' }}>Bekleyen barkod yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return <div className="page-content"><div className="loading-text">Yükleniyor...</div></div>;
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Envanter / Sayım</h1>
      </div>

      {toast && <div className="toast success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        <button type="button" className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>Yeni Sayım</button>
        <button type="button" className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Sayım Geçmişi</button>
      </div>

      {tab === 'new' && !activeCount && (
        <div className="panel">
          <div className="panel-header">Yeni Sayım Başlat</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group"><label>Sayım Adı *</label><input className="form-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-group"><label>Sayım Tarihi</label><input type="date" className="form-input" value={countDate} onChange={(e) => setCountDate(e.target.value)} /></div>
              <div className="form-group">
                <label>Sayım Türü</label>
                <select className="form-select" value={countType} onChange={(e) => setCountType(e.target.value)}>
                  {COUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ürün Tipi</label>
                <select className="form-select" value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)}>
                  <option value="Tümü">Tümü</option>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Kategori</label><input className="form-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} /></div>
              <div className="form-group"><label>Marka</label><input className="form-input" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} /></div>
              <div className="form-group"><label>Raf / Konum</label><input className="form-input" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Açıklama</label><input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <button type="button" className="btn btn-primary" disabled={starting} onClick={handleStartCount}>
              {starting ? 'Başlatılıyor...' : 'Sayımı Başlat'}
            </button>
          </div>
        </div>
      )}

      {tab === 'new' && activeCount && (
        <>
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{activeCount.count_no} — {activeCount.name}</span>
              <span style={{ fontSize: 11, color: '#666' }}>{activeCount.scope_label} | {activeCount.status}</span>
            </div>
            <div className="panel-body">
              {renderSummary(summary)}
              <div className="form-group">
                <label>Barkod / Karekod okutunuz</label>
                <input
                  ref={inputRef}
                  className="count-scan-input"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Okutun ve Enter'a basın"
                  autoFocus
                />
              </div>
              {lastUnknownCode && (
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>Bilinmeyen: {lastUnknownCode}</span>
                  <button type="button" className="btn btn-sm" onClick={addToPending}>Bekleyen listeye al</button>
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm" onClick={handleSaveDraft}>Taslak Kaydet</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setCompleteModal(true)}>Sayımı Tamamla</button>
                <button type="button" className="btn btn-sm" onClick={() => handleCancel(activeCount.id)}>İptal Et</button>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 8 }}>
            <div className="panel-header">Sayım Kalemleri ({items.length})</div>
            <div className="panel-body">{renderItemsTable(items, true, activeCount.id)}</div>
          </div>

          <div className="panel" style={{ marginTop: 8 }}>
            <div className="panel-header">Bekleyen / Bilinmeyen Barkodlar ({unknowns.length})</div>
            <div className="panel-body">{renderUnknownTable(activeCount.unknowns, activeCount.id, true)}</div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="panel">
          <div className="panel-header">Sayım Geçmişi</div>
          <div className="panel-body">
            {historyLoading ? (
              <div className="loading-text">Yükleniyor...</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>Sayım No</th>
                      <th>Ad</th>
                      <th>Tarih</th>
                      <th>Tür</th>
                      <th>Kapsam</th>
                      <th>Çeşit</th>
                      <th>Eksik</th>
                      <th>Fazla</th>
                      <th>Sayılmayan</th>
                      <th>Durum</th>
                      <th>Kullanıcı</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td>{row.count_no}</td>
                        <td>{row.name}</td>
                        <td>{row.count_date}</td>
                        <td>{row.count_type}</td>
                        <td style={{ fontSize: 11 }}>{row.scope_label || '-'}</td>
                        <td className="text-right">{row.total_kinds}</td>
                        <td className="text-right">{row.missing_kinds}</td>
                        <td className="text-right">{row.excess_kinds}</td>
                        <td className="text-right">{row.unscanned_kinds}</td>
                        <td>{row.status}</td>
                        <td>{row.created_by_name || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn btn-sm" onClick={async () => setDetailCount(await ipc.inventory.getCountById(row.id))}>Detay</button>
                          {' '}
                          <button type="button" className="btn btn-sm" onClick={() => handlePrint(row.id)}>Yazdır</button>
                          {' '}
                          <button type="button" className="btn btn-sm" onClick={() => handleExport(row.id)}>Excel</button>
                          {row.status === 'Tamamlandı' && (
                            <>
                              {' '}
                              <button type="button" className="btn btn-sm btn-primary" disabled={adjusting} onClick={() => handleApplyAdjustments(row.id)}>Farkları İşle</button>
                            </>
                          )}
                          {row.status === 'Devam Ediyor' && (
                            <>
                              {' '}
                              <button type="button" className="btn btn-sm" onClick={async () => { const d = await ipc.inventory.getCountById(row.id); setActiveCount(d); setTab('new'); }}>Devam</button>
                            </>
                          )}
                          {row.status !== 'Farklar İşlendi' && row.status !== 'İptal Edildi' && (
                            <>
                              {' '}
                              <button type="button" className="btn btn-sm" onClick={() => handleCancel(row.id)}>İptal</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!history.length && <tr><td colSpan={12} style={{ textAlign: 'center', color: '#888' }}>Kayıt yok</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {detailCount && (
        <div className="modal-overlay" onClick={() => setDetailCount(null)}>
          <div className="modal-box" style={{ width: '90%', maxWidth: 960, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sayım Detayı — {detailCount.count_no}</h3>
              <button type="button" className="btn btn-sm" onClick={() => setDetailCount(null)}>Kapat</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <div><strong>Ad:</strong> {detailCount.name} | <strong>Tarih:</strong> {detailCount.count_date}</div>
                <div><strong>Kapsam:</strong> {detailCount.scope_label} | <strong>Durum:</strong> {detailCount.status}</div>
                <div><strong>Kullanıcı:</strong> {detailCount.created_by_name || '-'}</div>
              </div>
              {renderSummary(detailCount.summary)}
              <h4 style={{ fontSize: 13, margin: '8px 0 4px' }}>Sayım Kalemleri</h4>
              {renderItemsTable(detailCount.items, false, detailCount.id)}
              <h4 style={{ fontSize: 13, margin: '12px 0 4px' }}>Bilinmeyen Barkodlar</h4>
              {renderUnknownTable(detailCount.unknowns, detailCount.id, false)}
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => handlePrint(detailCount.id)}>Yazdır</button>
                <button type="button" className="btn btn-sm" onClick={() => handleExport(detailCount.id)}>Excel</button>
                {detailCount.status === 'Tamamlandı' && (
                  <button type="button" className="btn btn-sm btn-primary" disabled={adjusting} onClick={() => handleApplyAdjustments(detailCount.id)}>
                    Farkları Stoğa İşle
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {completeModal && activeCount && summary && (
        <div className="modal-overlay" onClick={() => setCompleteModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Sayımı Tamamla</h3></div>
            <div className="modal-body" style={{ fontSize: 13 }}>
              <p>Eksik ürün çeşidi: <strong>{summary.missingKinds}</strong></p>
              <p>Fazla ürün çeşidi: <strong>{summary.excessKinds}</strong></p>
              <p>Sayılmayan ürün çeşidi: <strong>{summary.unscannedKinds}</strong></p>
              {summary.unknownCount > 0 && <p style={{ color: '#c0392b' }}>Bekleyen bilinmeyen barkod: {summary.unknownCount}</p>}
              <p style={{ marginTop: 12 }}>Sayımı tamamlamak istiyor musunuz? Stoklar henüz değişmeyecek.</p>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary" disabled={completing} onClick={handleComplete}>
                  {completing ? 'Tamamlanıyor...' : 'Evet, Tamamla'}
                </button>
                <button type="button" className="btn" onClick={() => setCompleteModal(false)}>Vazgeç</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manualEdit && (
        <div className="modal-overlay" onClick={() => setManualEdit(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Manuel Düzeltme — {manualEdit.item.product_name}</h3></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Sayılan Adet</label>
                <input className="form-input" type="number" min={0} value={manualEdit.qty} onChange={(e) => setManualEdit({ ...manualEdit, qty: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Açıklama (opsiyonel)</label>
                <input className="form-input" value={manualEdit.note} onChange={(e) => setManualEdit({ ...manualEdit, note: e.target.value })} />
              </div>
              <p style={{ fontSize: 11, color: '#888' }}>Seri no ile okutulan ürünlerde manuel değişiklik dikkatli yapılmalıdır.</p>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-primary" onClick={handleManualSave}>Kaydet</button>
                <button type="button" className="btn" onClick={() => setManualEdit(null)}>İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkUnknown && (
        <div className="modal-overlay" onClick={() => setLinkUnknown(null)}>
          <div className="modal-box" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Mevcut Ürüne Bağla</h3></div>
            <div className="modal-body">
              <input className="form-input" placeholder="Ürün ara..." value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />
              <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 8 }}>
                {linkProducts
                  .filter((p) => !linkSearch || p.name.toLowerCase().includes(linkSearch.toLowerCase()) || (p.barcode || '').includes(linkSearch))
                  .slice(0, 50)
                  .map((p) => (
                    <div key={p.id} style={{ padding: '6px 4px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: 12 }} onClick={() => handleLinkProduct(p.id)}>
                      {p.name} — {p.barcode || 'barkodsuz'}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuickProduct && quickUnknown && (
        <QuickProductModal
          barcode={quickUnknown.normalized_code}
          initialParsed={{
            raw: quickUnknown.raw_code,
            normalized: quickUnknown.normalized_code,
            type: (quickUnknown.barcode_type as ParsedBarcode['type']) || 'UNKNOWN',
            gtin: quickUnknown.gtin,
            serialNo: quickUnknown.serial_no,
            lotNo: quickUnknown.lot_no,
            expiryDate: quickUnknown.expiry_date,
          }}
          onSave={handleQuickProductSaved}
          onCancel={() => { setShowQuickProduct(false); setQuickUnknown(null); }}
        />
      )}
    </div>
  );
}
