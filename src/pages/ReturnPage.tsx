import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import type { SaleDetail } from '@/types/electron';
import type {
  CreateReturnInput,
  ExchangeItemInput,
  RefundMethod,
  ReturnListItem,
  ReturnType,
  SaleSearchResult,
} from '@/types/returns';
import { REFUND_METHODS, RETURN_TYPES } from '@/types/returns';
import '@/components/products/ProductForm.css';

interface ReturnLineSelection {
  saleItemId: number;
  productId: number;
  productName: string;
  soldQty: number;
  returnedQty: number;
  availableQty: number;
  unitPrice: number;
  returnQty: number;
  selected: boolean;
}

interface ExchangeLine {
  productId: number;
  name: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  stockQuantity: number;
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function ReturnPage() {
  const [returns, setReturns] = useState<ReturnListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SaleSearchResult[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [lines, setLines] = useState<ReturnLineSelection[]>([]);
  const [returnType, setReturnType] = useState<ReturnType>('Para iadesi');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('Nakit');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);
  const [exchangeBarcode, setExchangeBarcode] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadReturns = useCallback(() => {
    setLoading(true);
    ipc.returns.list().then(setReturns).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadReturns(); }, [loadReturns]);

  const searchSale = async () => {
    if (!searchQuery.trim()) return;
    setError('');
    try {
      const results = await ipc.returns.searchSale(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) setError('Satış bulunamadı.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const selectSale = async (saleId: number) => {
    setError('');
    try {
      const sale = await ipc.sales.getById(saleId);
      if (!sale) {
        setError('Satış bulunamadı.');
        return;
      }
      setSelectedSale(sale);
      setSearchResults([]);
      setExchangeLines([]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (!selectedSale) {
      setLines([]);
      return;
    }
    setLines(
      selectedSale.items.map((item) => {
        const returned = item.returned_quantity ?? 0;
        const available = item.quantity - returned;
        const productId = (item as { product_id?: number }).product_id ?? 0;
        return {
          saleItemId: item.id,
          productId,
          productName: item.product_name,
          soldQty: item.quantity,
          returnedQty: returned,
          availableQty: available,
          unitPrice: item.unit_price,
          returnQty: available > 0 ? 1 : 0,
          selected: false,
        };
      })
    );
  }, [selectedSale]);

  const toggleLine = (saleItemId: number, checked: boolean) => {
    setLines((prev) => prev.map((l) => (l.saleItemId === saleItemId ? { ...l, selected: checked } : l)));
  };

  const updateReturnQty = (saleItemId: number, qty: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.saleItemId === saleItemId
          ? { ...l, returnQty: Math.min(Math.max(0, qty), l.availableQty) }
          : l
      )
    );
  };

  const addExchangeByBarcode = async () => {
    if (!exchangeBarcode.trim()) return;
    setError('');
    try {
      const product = await ipc.products.findByBarcode(exchangeBarcode.trim(), true);
      if (!product) {
        setError('Ürün bulunamadı.');
        return;
      }
      setExchangeLines((prev) => {
        const existing = prev.find((p) => p.productId === product.id);
        if (existing) {
          return prev.map((p) =>
            p.productId === product.id ? { ...p, quantity: p.quantity + 1 } : p
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            barcode: product.barcode || exchangeBarcode,
            quantity: 1,
            unitPrice: product.sale_price,
            stockQuantity: product.stock_quantity,
          },
        ];
      });
      setExchangeBarcode('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const returnTotal = lines
    .filter((l) => l.selected && l.returnQty > 0)
    .reduce((sum, l) => sum + l.returnQty * l.unitPrice, 0);

  const exchangeTotal = exchangeLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const exchangeDiff = returnType === 'Değişim' ? exchangeTotal - returnTotal : 0;

  const handleSubmit = async () => {
    if (!selectedSale) {
      setError('Önce satış seçin.');
      return;
    }
    if (!reason.trim()) {
      setError('İade nedeni zorunludur.');
      return;
    }

    const selectedItems = lines.filter((l) => l.selected && l.returnQty > 0);
    if (!selectedItems.length) {
      setError('İade edilecek ürün seçin.');
      return;
    }

    for (const l of selectedItems) {
      if (l.returnQty > l.availableQty) {
        setError(`${l.productName}: İade adedi satılan adetten fazla olamaz.`);
        return;
      }
    }

    if (returnType === 'Cari hesaba alacak' && !selectedSale.customer_id) {
      setError('Cari alacak iadesi için müşteri zorunludur.');
      return;
    }

    if (returnType === 'Değişim' && !exchangeLines.length) {
      setError('Değişim için yeni ürün ekleyin.');
      return;
    }

    const input: CreateReturnInput = {
      saleId: selectedSale.id,
      items: selectedItems.map((l) => ({
        saleItemId: l.saleItemId,
        productId: l.productId,
        quantity: l.returnQty,
        unitPrice: l.unitPrice,
      })),
      returnType,
      refundMethod: returnType === 'Para iadesi' || returnType === 'Değişim' ? refundMethod : undefined,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
      exchangeItems:
        returnType === 'Değişim'
          ? exchangeLines.map(
              (e): ExchangeItemInput => ({
                productId: e.productId,
                barcode: e.barcode,
                quantity: e.quantity,
                unitPrice: e.unitPrice,
              })
            )
          : undefined,
    };

    setError('');
    try {
      const result = await ipc.returns.create(input);
      setToast(`İade kaydedildi: ${result.returnNo}`);
      const doc = await ipc.print.returnReceipt(result.returnId);
      openPrintPreview(doc);
      setSelectedSale(null);
      setLines([]);
      setExchangeLines([]);
      setReason('');
      setNotes('');
      loadReturns();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">İade / Değişim</h2>
        <button className="btn" onClick={loadReturns}>Yenile</button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="panel" style={{ marginBottom: 8 }}>
        <div className="panel-header">Satış Ara</div>
        <div className="panel-body">
          <div className="form-row">
            <input
              className="form-input search-input"
              placeholder="Satış no, müşteri, telefon veya barkod..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchSale()}
            />
            <button className="btn btn-primary" onClick={searchSale}>Ara</button>
          </div>
          {searchResults.length > 0 && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr><th>Satış No</th><th>Tarih</th><th>Müşteri</th><th className="text-right">Tutar</th><th></th></tr>
              </thead>
              <tbody>
                {searchResults.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sale_no}</td>
                    <td>{formatDateTime(s.sale_date)}</td>
                    <td>{s.customer_name || 'Perakende'}</td>
                    <td className="text-right">{formatCurrency(s.net_amount)}</td>
                    <td><button className="btn btn-sm btn-primary" onClick={() => selectSale(s.id)}>Seç</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedSale && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <div className="panel-header">
            Seçili Satış: {selectedSale.sale_no} — {selectedSale.customer_name || 'Perakende'}
            <button className="btn btn-sm" style={{ float: 'right' }} onClick={() => setSelectedSale(null)}>Temizle</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th></th><th>Ürün</th><th className="text-center">Satılan</th>
                <th className="text-center">İade Edilen</th><th className="text-center">Kalan</th>
                <th className="text-center">İade Adedi</th><th className="text-right">Birim</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.saleItemId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={l.selected}
                      disabled={l.availableQty <= 0}
                      onChange={(e) => toggleLine(l.saleItemId, e.target.checked)}
                    />
                  </td>
                  <td>{l.productName}</td>
                  <td className="text-center">{l.soldQty}</td>
                  <td className="text-center">{l.returnedQty}</td>
                  <td className="text-center">{l.availableQty}</td>
                  <td className="text-center">
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 60 }}
                      min={1}
                      max={l.availableQty}
                      value={l.returnQty}
                      disabled={!l.selected || l.availableQty <= 0}
                      onChange={(e) => updateReturnQty(l.saleItemId, parseInt(e.target.value, 10) || 0)}
                    />
                  </td>
                  <td className="text-right">{formatCurrency(l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>İade Tipi</label>
                <select className="form-select" value={returnType} onChange={(e) => setReturnType(e.target.value as ReturnType)}>
                  {RETURN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {(returnType === 'Para iadesi' || returnType === 'Değişim') && (
                <div className="form-group">
                  <label>Ödeme Türü</label>
                  <select className="form-select" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}>
                    {REFUND_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>İade Nedeni *</label>
                <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Not</label>
                <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {returnType === 'Değişim' && (
              <div style={{ marginTop: 8 }}>
                <div className="panel-header">Yeni Ürünler (Değişim)</div>
                <div className="form-row">
                  <input
                    className="form-input"
                    placeholder="Barkod okut..."
                    value={exchangeBarcode}
                    onChange={(e) => setExchangeBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addExchangeByBarcode()}
                  />
                  <button className="btn" onClick={addExchangeByBarcode}>Ekle</button>
                </div>
                {exchangeLines.length > 0 && (
                  <table className="data-table" style={{ marginTop: 6 }}>
                    <thead>
                      <tr><th>Ürün</th><th className="text-center">Adet</th><th className="text-right">Birim</th><th className="text-right">Toplam</th><th></th></tr>
                    </thead>
                    <tbody>
                      {exchangeLines.map((e) => (
                        <tr key={e.productId}>
                          <td>{e.name}</td>
                          <td className="text-center">
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: 60 }}
                              min={1}
                              max={e.stockQuantity}
                              value={e.quantity}
                              onChange={(ev) => {
                                const q = parseInt(ev.target.value, 10) || 1;
                                setExchangeLines((prev) =>
                                  prev.map((x) => (x.productId === e.productId ? { ...x, quantity: q } : x))
                                );
                              }}
                            />
                          </td>
                          <td className="text-right">{formatCurrency(e.unitPrice)}</td>
                          <td className="text-right">{formatCurrency(e.quantity * e.unitPrice)}</td>
                          <td>
                            <button className="btn btn-sm btn-danger" onClick={() =>
                              setExchangeLines((prev) => prev.filter((x) => x.productId !== e.productId))
                            }>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  İade tutarı: {formatCurrency(returnTotal)} | Yeni tutar: {formatCurrency(exchangeTotal)} |
                  Fark: <strong className={exchangeDiff >= 0 ? 'amount-positive' : 'amount-negative'}>{formatCurrency(exchangeDiff)}</strong>
                  {exchangeDiff > 0 && ' (tahsilat)'}
                  {exchangeDiff < 0 && ' (iade/cari alacak)'}
                </div>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <strong>İade Tutarı: {formatCurrency(returnTotal)}</strong>
              <button className="btn btn-primary" style={{ marginLeft: 12 }} onClick={handleSubmit}>İadeyi Tamamla</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header">Son İadeler</div>
        <div className="data-table-wrap" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>İade No</th><th>Tarih</th><th>Satış</th><th>Müşteri</th>
                <th>Tip</th><th className="text-right">Tutar</th><th>Neden</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="loading-text">Yükleniyor...</td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={8} className="empty-text">Henüz iade yok</td></tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id}>
                    <td>{r.return_no}</td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.sale_no || '-'}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td>{r.return_type}</td>
                    <td className="text-right">{formatCurrency(r.total_amount)}</td>
                    <td>{r.reason || '-'}</td>
                    <td>
                      <button className="btn btn-sm" onClick={async () => {
                        const doc = await ipc.print.returnReceipt(r.id);
                        openPrintPreview(doc);
                      }}>Fiş</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
