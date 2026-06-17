import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { sanitizeBarcode } from '@/utils/barcode';
import type { ParsedBarcode } from '@/types/barcode';
import type { StockEntryBatchRow, StockEntryLine } from '@/types/stockEntry';
import { productToEntryLine } from '@/types/stockEntry';
import QuickProductModal from '@/components/stock/QuickProductModal';
import LabelPrintModal from '@/components/products/LabelPrintModal';
import { openPrintPreview } from '@/utils/print';
import '@/components/products/ProductForm.css';

type Tab = 'entry' | 'history';

interface SupplierOption {
  id: number;
  name: string;
}

export default function StockEntryPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('entry');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [documentNo, setDocumentNo] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lines, setLines] = useState<StockEntryLine[]>([]);
  const [pendingBarcodes, setPendingBarcodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [successFlash, setSuccessFlash] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [unknownParsed, setUnknownParsed] = useState<ParsedBarcode | null>(null);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [labelProducts, setLabelProducts] = useState<Product[]>([]);
  const [showLabels, setShowLabels] = useState(false);
  const [completeModal, setCompleteModal] = useState<{ batchNo: string; batchId: number } | null>(null);

  const [batches, setBatches] = useState<StockEntryBatchRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Record<string, unknown> | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (tab === 'entry') focusInput();
  }, [tab, focusInput]);

  const loadSuppliers = useCallback(() => {
    ipc.suppliers.list().then((rows) => {
      setSuppliers(rows as SupplierOption[]);
    }).catch(() => undefined);
  }, []);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    ipc.stockEntry
      .listBatches()
      .then((rows) => setBatches(rows as StockEntryBatchRow[]))
      .catch(() => setBatches([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, loadHistory]);

  const totalKinds = lines.length;
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lines.reduce((s, l) => s + l.quantity * l.purchasePrice, 0);

  const addLineFromProduct = (product: Product, qty = 1, overrides?: Partial<StockEntryLine>, parsed?: ParsedBarcode) => {
    setLines((prev) => {
      const serial = overrides?.serialNo ?? parsed?.serialNo;
      const match = (l: StockEntryLine) =>
        serial ? l.productId === product.id && l.serialNo === serial : l.productId === product.id && !l.serialNo;

      const existing = prev.find(match);
      if (existing) {
        return prev.map((l) => (match(l) ? { ...l, quantity: l.quantity + qty, ...overrides } : l));
      }
      const line = { ...productToEntryLine(product, qty, parsed), ...overrides };
      return [...prev, line];
    });
    setError('');
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 400);
  };

  const handleBarcodeSubmit = async () => {
    const code = sanitizeBarcode(barcode);
    setBarcode('');
    if (!code) return;

    try {
      const { product, parsed } = await ipc.products.resolveScan(code, false);
      if (!product) {
        setUnknownBarcode(code);
        setUnknownParsed(parsed);
        setError(`Barkod/karekod bulunamadı: ${parsed.barcode || code}`);
        focusInput();
        return;
      }
      if (product.status !== 'Aktif') {
        setError('Bu ürün pasif durumda.');
        focusInput();
        return;
      }
      addLineFromProduct(product, 1, undefined, parsed);
      focusInput();
    } catch (err) {
      setError((err as Error).message);
      focusInput();
    }
  };

  const handleQuickProductSaved = async (result: {
    productId: number;
    quantity: number;
    purchasePrice: number;
    salePrice: number;
    shelfLocation: string;
  }) => {
    setShowQuickProduct(false);
    setUnknownBarcode(null);
    try {
      const product = await ipc.products.getById(result.productId);
      if (product) {
        addLineFromProduct(
          product,
          result.quantity,
          {
            purchasePrice: result.purchasePrice,
            salePrice: result.salePrice,
            shelfLocation: result.shelfLocation,
            serialNo: result.serialNo,
            lotNo: result.lotNo,
            expiryDate: result.expiryDate,
            barcode: result.barcode,
            updatePrices: true,
          },
          unknownParsed ?? undefined
        );
      }
      setUnknownParsed(null);
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addToPending = () => {
    if (!unknownBarcode) return;
    setPendingBarcodes((prev) => (prev.includes(unknownBarcode) ? prev : [...prev, unknownBarcode]));
    setUnknownBarcode(null);
    setError('');
    focusInput();
  };

  const updateLine = (productId: number, patch: Partial<StockEntryLine>) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  };

  const removeLine = (productId: number) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const r = await ipc.suppliers.create({ name: newSupplierName.trim() });
      setSupplierId(r.id);
      setNewSupplierName('');
      setShowNewSupplier(false);
      loadSuppliers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleComplete = async () => {
    if (lines.length === 0) {
      setError('Giriş listesi boş.');
      return;
    }
    if (!confirm(`${totalKinds} çeşit, ${totalQty} adet ürün stoğa alınacak. Onaylıyor musunuz?`)) return;

    setCompleting(true);
    setError('');
    try {
      const result = await ipc.stockEntry.complete({
        supplier_id: supplierId === '' ? null : supplierId,
        document_no: documentNo || undefined,
        entry_date: entryDate,
        notes: notes || undefined,
        items: lines.map((l) => ({
          product_id: l.productId,
          barcode: l.barcode,
          quantity: l.quantity,
          purchase_price: l.purchasePrice,
          sale_price: l.salePrice,
          shelf_location: l.shelfLocation || undefined,
          update_prices: l.updatePrices,
        })),
      });

      const products: Product[] = [];
      for (const id of result.productIds) {
        const p = await ipc.products.getById(id);
        if (p) products.push(p);
      }

      setLines([]);
      setDocumentNo('');
      setNotes('');
      setBarcode('');
      setCompleteModal({ batchNo: result.batchNo, batchId: result.batchId });
      setLabelProducts(products);
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const viewBatchDetail = async (id: number) => {
    try {
      const detail = await ipc.stockEntry.getBatch(id);
      setSelectedBatch(detail as Record<string, unknown>);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Mal Kabul / Barkodlu Stok Giriş</h2>
      </div>

      <div className="tab-bar" style={{ marginBottom: 8 }}>
        <button type="button" className={`tab-btn${tab === 'entry' ? ' active' : ''}`} onClick={() => setTab('entry')}>
          Stok Girişi
        </button>
        <button type="button" className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          Giriş Geçmişi
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}

      {tab === 'entry' && (
        <>
          <div className="panel" style={{ marginBottom: 8 }}>
            <div className="panel-header">Giriş Bilgileri</div>
            <div className="panel-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Tedarikçi</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      className="form-select"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                      style={{ flex: 1 }}
                    >
                      <option value="">Seçiniz</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm" onClick={() => setShowNewSupplier(!showNewSupplier)}>+</button>
                  </div>
                  {showNewSupplier && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input className="form-input" placeholder="Tedarikçi adı" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
                      <button type="button" className="btn btn-sm btn-primary" onClick={handleAddSupplier}>Ekle</button>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Belge / Fatura No</label>
                  <input className="form-input" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Giriş Tarihi</label>
                  <input type="date" className="form-input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Açıklama</label>
                <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsiyonel not" />
              </div>
              <div className="form-group">
                <label>Barkod Okutunuz</label>
                <input
                  ref={inputRef}
                  className="form-input"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      handleBarcodeSubmit();
                    }
                  }}
                  placeholder="Barkod okuyucu ile okutun veya yazıp Enter'a basın"
                  style={{
                    fontSize: 16,
                    borderColor: successFlash ? '#2e7d32' : undefined,
                    background: successFlash ? '#e8f5e9' : undefined,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 600 }}>
                <span>Çeşit: {totalKinds}</span>
                <span>Toplam Adet: {totalQty}</span>
                <span>Toplam Maliyet: {formatCurrency(totalCost)}</span>
              </div>
              {pendingBarcodes.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Bekleyen barkodlar ({pendingBarcodes.length}): {pendingBarcodes.join(', ')}
                </div>
              )}
              <p style={{ fontSize: 11, color: '#888', marginTop: 8, marginBottom: 0 }}>
                Excel ile toplu kontrol özelliği sonraki sürümde eklenecektir.
              </p>
            </div>
          </div>

          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Giriş Listesi</span>
              <button type="button" className="btn btn-primary" disabled={completing || lines.length === 0} onClick={handleComplete}>
                {completing ? 'Kaydediliyor...' : 'Girişi Tamamla'}
              </button>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Barkod</th>
                    <th>Ürün</th>
                    <th>Tip</th>
                    <th>Marka</th>
                    <th>Model</th>
                    <th className="text-right">Mevcut</th>
                    <th className="text-right">Giriş</th>
                    <th className="text-right">Yeni</th>
                    <th className="text-right">Alış</th>
                    <th className="text-right">Satış</th>
                    <th>Raf</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="empty-text">Barkod okutarak ürün ekleyin</td>
                    </tr>
                  ) : (
                    lines.map((l) => (
                      <tr key={l.productId}>
                        <td>{l.barcode || '-'}</td>
                        <td>{l.name}</td>
                        <td>{l.productType}</td>
                        <td>{l.brand || '-'}</td>
                        <td>{l.model || '-'}</td>
                        <td className="text-right">{l.currentStock}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.productId, { quantity: Math.max(1, Number(e.target.value)) })}
                            style={{ width: 56, textAlign: 'right' }}
                            className="form-input"
                          />
                        </td>
                        <td className="text-right">{l.currentStock + l.quantity}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={l.purchasePrice}
                            onChange={(e) =>
                              updateLine(l.productId, {
                                purchasePrice: Number(e.target.value),
                                updatePrices: true,
                              })
                            }
                            style={{ width: 72, textAlign: 'right' }}
                            className="form-input"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={l.salePrice}
                            onChange={(e) =>
                              updateLine(l.productId, {
                                salePrice: Number(e.target.value),
                                updatePrices: true,
                              })
                            }
                            style={{ width: 72, textAlign: 'right' }}
                            className="form-input"
                          />
                        </td>
                        <td>
                          <input
                            value={l.shelfLocation}
                            onChange={(e) => updateLine(l.productId, { shelfLocation: e.target.value })}
                            style={{ width: 64 }}
                            className="form-input"
                          />
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm" onClick={() => removeLine(l.productId)}>Sil</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">Giriş Geçmişi</div>
          {historyLoading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tarih</th>
                    <th>Tedarikçi</th>
                    <th>Belge No</th>
                    <th className="text-right">Çeşit</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Maliyet</th>
                    <th>Kullanıcı</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr><td colSpan={9} className="empty-text">Kayıt yok</td></tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id}>
                        <td>{b.batch_no}</td>
                        <td>{b.entry_date}</td>
                        <td>{b.supplier_name || '-'}</td>
                        <td>{b.document_no || '-'}</td>
                        <td className="text-right">{b.total_items}</td>
                        <td className="text-right">{b.total_quantity}</td>
                        <td className="text-right">{formatCurrency(b.total_cost)}</td>
                        <td>{b.created_by_name || '-'}</td>
                        <td>
                          <button type="button" className="btn btn-sm" onClick={() => viewBatchDetail(b.id)}>Detay</button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ marginLeft: 4 }}
                            onClick={async () => {
                              const doc = await ipc.stockEntry.print(b.id);
                              openPrintPreview(doc);
                            }}
                          >
                            Yazdır
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ marginLeft: 4 }}
                            onClick={() => ipc.stockEntry.exportExcel(b.id)}
                          >
                            Excel
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {unknownBarcode && !showQuickProduct && (
        <div className="product-form-overlay">
          <div className="product-form-panel" style={{ width: 420 }}>
            <div className="product-form-header">
              <span>Bu barkoda ait ürün bulunamadı</span>
              <button type="button" className="btn-close" onClick={() => { setUnknownBarcode(null); focusInput(); }}>×</button>
            </div>
            <div className="product-form-body">
              <p style={{ margin: '0 0 12px' }}>Barkod: <strong>{unknownBarcode}</strong></p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="btn btn-primary" onClick={() => setShowQuickProduct(true)}>Hızlı Ürün Oluştur</button>
                <button type="button" className="btn" onClick={addToPending}>Barkodu Bekleyen Listeye Al</button>
                <button type="button" className="btn" onClick={() => { setUnknownBarcode(null); focusInput(); }}>Vazgeç</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuickProduct && unknownBarcode && (
        <QuickProductModal
          barcode={unknownParsed?.barcode || unknownBarcode}
          initialParsed={unknownParsed ?? undefined}
          onSave={handleQuickProductSaved}
          onCancel={() => { setShowQuickProduct(false); focusInput(); }}
        />
      )}

      {completeModal && (
        <div className="product-form-overlay">
          <div className="product-form-panel" style={{ width: 440 }}>
            <div className="product-form-header">
              <span>Stok Girişi Tamamlandı</span>
              <button type="button" className="btn-close" onClick={() => setCompleteModal(null)}>×</button>
            </div>
            <div className="product-form-body">
              <p>Fiş <strong>{completeModal.batchNo}</strong> başarıyla kaydedildi.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowLabels(true);
                    setCompleteModal(null);
                  }}
                >
                  Gelen Ürünler İçin Etiket Bas
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    const doc = await ipc.stockEntry.print(completeModal.batchId);
                    openPrintPreview(doc);
                  }}
                >
                  Giriş Fişini Yazdır
                </button>
                <button type="button" className="btn" onClick={() => navigate('/stok')}>Stok Listesine Dön</button>
                <button type="button" className="btn" onClick={() => setCompleteModal(null)}>Yeni Giriş Yap</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="product-form-overlay">
          <div className="product-form-panel" style={{ width: 720, maxHeight: '90vh' }}>
            <div className="product-form-header">
              <span>Fiş Detayı — {String(selectedBatch.batch_no)}</span>
              <button type="button" className="btn-close" onClick={() => setSelectedBatch(null)}>×</button>
            </div>
            <div className="product-form-body" style={{ overflow: 'auto' }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <div>Tarih: {String(selectedBatch.entry_date)}</div>
                <div>Tedarikçi: {String(selectedBatch.supplier_name || '-')}</div>
                <div>Belge: {String(selectedBatch.document_no || '-')}</div>
                <div>Toplam: {formatCurrency(Number(selectedBatch.total_cost))}</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Barkod</th>
                    <th>Ürün</th>
                    <th className="text-right">Adet</th>
                    <th className="text-right">Alış</th>
                    <th className="text-right">Satış</th>
                  </tr>
                </thead>
                <tbody>
                  {((selectedBatch.items as Record<string, unknown>[]) || []).map((i, idx) => (
                    <tr key={idx}>
                      <td>{String(i.barcode || '-')}</td>
                      <td>{String(i.product_name)}</td>
                      <td className="text-right">{String(i.quantity)}</td>
                      <td className="text-right">{formatCurrency(Number(i.purchase_price))}</td>
                      <td className="text-right">{formatCurrency(Number(i.sale_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showLabels && labelProducts.length > 0 && (
        <LabelPrintModal products={labelProducts} onClose={() => setShowLabels(false)} />
      )}
    </div>
  );
}
