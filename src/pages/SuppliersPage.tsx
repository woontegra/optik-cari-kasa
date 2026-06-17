import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ipc } from '@/services/ipc';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/types/auth';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { sanitizeBarcode } from '@/utils/barcode';
import { openPrintPreview } from '@/utils/print';
import { PURCHASE_DOCUMENT_TYPES, SUPPLIER_PAYMENT_TYPES } from '@/types/purchase';
import type { Product } from '@/types/electron';
import QuickProductModal from '@/components/stock/QuickProductModal';
import '@/components/products/ProductForm.css';

type Tab = 'suppliers' | 'purchases' | 'account' | 'payments';

interface PurchaseLine {
  productId: number;
  name: string;
  barcode: string;
  productType: string;
  brand?: string;
  model?: string;
  quantity: number;
  purchasePrice: number;
  vatRate: number;
  salePrice: number;
  shelfLocation?: string;
}

const emptySupplier = {
  name: '',
  authorized_person: '',
  phone: '',
  email: '',
  tax_office: '',
  tax_no: '',
  city: '',
  district: '',
  address: '',
  notes: '',
};

export default function SuppliersPage() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'suppliers';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [purchases, setPurchases] = useState<Record<string, unknown>[]>([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [editSupplierId, setEditSupplierId] = useState<number | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Record<string, unknown> | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'purchases' | 'account' | 'payments'>('info');

  const [creatingPurchase, setCreatingPurchase] = useState(false);
  const [docType, setDocType] = useState<string>(PURCHASE_DOCUMENT_TYPES[0]);
  const [docNo, setDocNo] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [purchaseSupplierId, setPurchaseSupplierId] = useState<number | ''>('');
  const [docNotes, setDocNotes] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [barcode, setBarcode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [fromStockEntry, setFromStockEntry] = useState(false);
  const [stockBatches, setStockBatches] = useState<Record<string, unknown>[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [initialPayAmount, setInitialPayAmount] = useState('');
  const [initialPayType, setInitialPayType] = useState<string>(SUPPLIER_PAYMENT_TYPES[0]);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [purchaseDetail, setPurchaseDetail] = useState<Record<string, unknown> | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [paymentSupplierId, setPaymentSupplierId] = useState<number | ''>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<string>(SUPPLIER_PAYMENT_TYPES[0]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDesc, setPaymentDesc] = useState('');
  const [paymentDocId, setPaymentDocId] = useState<number | ''>('');
  const [allMovements, setAllMovements] = useState<Record<string, unknown>[]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const canEdit = hasPermission(PERMISSIONS.SUPPLIERS_EDIT);
  const canPay = hasPermission(PERMISSIONS.SUPPLIER_PAYMENTS);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadSuppliers = useCallback(async () => {
    try {
      setSuppliers(await ipc.suppliers.list(false));
    } catch {
      setSuppliers([]);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    try {
      setPurchases(await ipc.purchases.list({ status: '' }));
    } catch {
      setPurchases([]);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (tab === 'purchases' || tab === 'payments') loadPurchases();
    if (tab === 'account') {
      ipc.suppliers.list(false).then(async (sups) => {
        const all: Record<string, unknown>[] = [];
        for (const s of sups.slice(0, 100)) {
          const moves = await ipc.suppliers.getAccountMovements(Number(s.id));
          moves.forEach((m) => all.push({ ...m, supplier_name: s.name }));
        }
        setAllMovements(all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
      }).catch(() => setAllMovements([]));
    }
  }, [tab, loadPurchases]);

  const lineSubtotal = lines.reduce((s, l) => s + l.quantity * l.purchasePrice, 0);
  const lineVat = lines.reduce((s, l) => s + l.quantity * l.purchasePrice * (l.vatRate / 100), 0);
  const lineTotal = lineSubtotal + lineVat;

  const addLineFromProduct = (product: Product, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          barcode: product.barcode || '',
          productType: product.product_type,
          brand: product.brand,
          model: product.model,
          quantity: qty,
          purchasePrice: product.purchase_price,
          vatRate: product.vat_rate ?? 18,
          salePrice: product.sale_price,
          shelfLocation: product.shelf_location,
        },
      ];
    });
  };

  const handleBarcodeSubmit = async () => {
    const code = sanitizeBarcode(barcode);
    setBarcode('');
    if (!code) return;
    try {
      const { product } = await ipc.products.resolveScan(code, false);
      if (!product) {
        setUnknownBarcode(code);
        setError('Bu barkoda ait ürün bulunamadı.');
        return;
      }
      addLineFromProduct(product);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadFromStockEntry = async (batchId: number) => {
    try {
      const batchLines = await ipc.purchases.getStockEntryLines(batchId);
      const batch = stockBatches.find((b) => Number(b.id) === batchId);
      if (batch?.supplier_id) setPurchaseSupplierId(Number(batch.supplier_id));
      if (batch?.document_no) setDocNo(String(batch.document_no));
      setLines(
        batchLines.map((l) => ({
          productId: Number(l.product_id),
          name: String(l.product_name),
          barcode: String(l.barcode || ''),
          productType: String(l.product_type),
          brand: l.brand as string,
          model: l.model as string,
          quantity: Number(l.quantity),
          purchasePrice: Number(l.purchase_price),
          vatRate: Number(l.vat_rate ?? 18),
          salePrice: Number(l.sale_price),
          shelfLocation: l.shelf_location as string,
        }))
      );
      setSelectedBatchId(batchId);
      setFromStockEntry(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const savePurchase = async () => {
    if (!purchaseSupplierId) {
      setError('Tedarikçi seçin.');
      return;
    }
    if (!lines.length) {
      setError('En az bir ürün ekleyin.');
      return;
    }
    setSavingPurchase(true);
    setError('');
    try {
      const payload = {
        document_no: docNo || undefined,
        document_type: docType,
        supplier_id: purchaseSupplierId,
        document_date: docDate,
        due_date: dueDate || undefined,
        notes: docNotes || undefined,
        items: lines.map((l) => ({
          product_id: l.productId,
          barcode: l.barcode,
          quantity: l.quantity,
          purchase_price: l.purchasePrice,
          vat_rate: l.vatRate,
          sale_price: l.salePrice,
          shelf_location: l.shelfLocation,
        })),
        initial_payment:
          parseFloat(initialPayAmount) > 0
            ? { amount: parseFloat(initialPayAmount), payment_type: initialPayType }
            : undefined,
      };
      const result = fromStockEntry && selectedBatchId
        ? await ipc.purchases.createFromStockEntry(Number(selectedBatchId), payload)
        : await ipc.purchases.create(payload);
      showToast(`Alış belgesi kaydedildi: ${result.documentNo}`);
      setCreatingPurchase(false);
      setLines([]);
      setFromStockEntry(false);
      setSelectedBatchId('');
      loadPurchases();
      loadSuppliers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPurchase(false);
    }
  };

  const saveSupplier = async () => {
    try {
      if (editSupplierId) {
        await ipc.suppliers.update(editSupplierId, supplierForm);
        showToast('Tedarikçi güncellendi.');
      } else {
        await ipc.suppliers.create(supplierForm);
        showToast('Tedarikçi eklendi.');
      }
      setShowSupplierForm(false);
      setEditSupplierId(null);
      setSupplierForm(emptySupplier);
      loadSuppliers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const savePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!paymentSupplierId || !amount || amount <= 0) {
      setError('Tedarikçi ve geçerli tutar girin.');
      return;
    }
    try {
      await ipc.suppliers.addPayment({
        supplier_id: paymentSupplierId,
        amount,
        payment_type: paymentType,
        payment_date: paymentDate,
        description: paymentDesc || undefined,
        purchase_document_id: paymentDocId === '' ? null : paymentDocId,
      });
      showToast('Ödeme kaydedildi.');
      setPaymentAmount('');
      setPaymentDesc('');
      loadSuppliers();
      loadPurchases();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openDetail = async (id: number) => {
    try {
      setDetailSupplier(await ipc.suppliers.getById(id));
      setDetailTab('info');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startCreatePurchase = async () => {
    setCreatingPurchase(true);
    setLines([]);
    setFromStockEntry(false);
    if (canEdit) {
      setStockBatches(await ipc.purchases.listStockEntryCandidates().catch(() => []));
    }
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  return (
    <div className="page-content">
      <div className="page-header"><h1>Tedarikçiler</h1></div>
      {toast && <div className="toast success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        {(['suppliers', 'purchases', 'account', 'payments'] as Tab[]).map((t) => (
          <button key={t} type="button" className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'suppliers' ? 'Tedarikçi Listesi' : t === 'purchases' ? 'Alış Faturaları' : t === 'account' ? 'Cari Hareketler' : 'Ödemeler'}
          </button>
        ))}
      </div>

      {tab === 'suppliers' && (
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tedarikçiler</span>
            {canEdit && (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => { setShowSupplierForm(true); setEditSupplierId(null); setSupplierForm(emptySupplier); }}>
                Yeni Tedarikçi
              </button>
            )}
          </div>
          <div className="panel-body">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Firma</th><th>Yetkili</th><th>Telefon</th><th>Vergi No</th>
                  <th className="text-right">Cari Bakiye</th><th>Son İşlem</th><th>Durum</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{String(s.name)}</td>
                    <td>{String(s.authorized_person || '-')}</td>
                    <td>{String(s.phone || '-')}</td>
                    <td>{String(s.tax_no || '-')}</td>
                    <td className="text-right">{formatCurrency(Number(s.balance ?? 0))}</td>
                    <td>{s.last_transaction_at ? formatDateTime(String(s.last_transaction_at)) : '-'}</td>
                    <td>{Number(s.is_active) ? 'Aktif' : 'Pasif'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => openDetail(Number(s.id))}>Detay</button>
                      {canEdit && Number(s.is_active) ? (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => {
                            setEditSupplierId(Number(s.id));
                            setSupplierForm({
                              name: String(s.name),
                              authorized_person: String(s.authorized_person || ''),
                              phone: String(s.phone || ''),
                              email: String(s.email || ''),
                              tax_office: String(s.tax_office || ''),
                              tax_no: String(s.tax_no || ''),
                              city: String(s.city || ''),
                              district: String(s.district || ''),
                              address: String(s.address || ''),
                              notes: String(s.notes || ''),
                            });
                            setShowSupplierForm(true);
                          }}> Düzenle</button>
                          <button type="button" className="btn btn-sm" onClick={async () => {
                            if (!window.confirm('Pasife alınsın mı?')) return;
                            await ipc.suppliers.deactivate(Number(s.id));
                            loadSuppliers();
                          }}> Pasife Al</button>
                        </>
                      ) : null}
                      <button type="button" className="btn btn-sm" onClick={async () => openPrintPreview(await ipc.suppliers.printStatement(Number(s.id)))}> Ekstre</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'purchases' && !creatingPurchase && (
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Alış Faturaları / İrsaliyeler</span>
            {canEdit && <button type="button" className="btn btn-sm btn-primary" onClick={startCreatePurchase}>Yeni Belge</button>}
          </div>
          <div className="panel-body">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Belge No</th><th>Tarih</th><th>Tedarikçi</th><th>Tip</th>
                  <th className="text-right">Adet</th><th className="text-right">Toplam</th>
                  <th className="text-right">Ödenen</th><th className="text-right">Kalan</th><th>Durum</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={String(p.id)}>
                    <td>{String(p.document_no)}</td>
                    <td>{String(p.document_date)}</td>
                    <td>{String(p.supplier_name)}</td>
                    <td>{String(p.document_type)}</td>
                    <td className="text-right">{String(p.total_quantity)}</td>
                    <td className="text-right">{formatCurrency(Number(p.total_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(p.paid_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(p.remaining_amount))}</td>
                    <td>{String(p.payment_status)}</td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={async () => setPurchaseDetail(await ipc.purchases.getById(Number(p.id)))}>Detay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'purchases' && creatingPurchase && canEdit && (
        <div className="panel">
          <div className="panel-header">Yeni Alış Belgesi</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>Belge Tipi</label>
                <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {PURCHASE_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Belge No</label><input className="form-input" value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="Otomatik" /></div>
              <div className="form-group"><label>Tarih</label><input type="date" className="form-input" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></div>
              <div className="form-group"><label>Vade</label><input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
              <div className="form-group">
                <label>Tedarikçi *</label>
                <select className="form-select" value={purchaseSupplierId} onChange={(e) => setPurchaseSupplierId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Seçin</option>
                  {suppliers.filter((s) => Number(s.is_active)).map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Mal kabul fişinden oluştur</label>
                <select className="form-select" value={selectedBatchId} onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : '';
                  setSelectedBatchId(v);
                  if (v) loadFromStockEntry(v);
                  else setFromStockEntry(false);
                }}>
                  <option value="">— Doğrudan ürün ekle —</option>
                  {stockBatches.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>{String(b.batch_no)} — {String(b.supplier_name || 'Tedarikçisiz')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Barkod okut</label>
                <input ref={barcodeRef} className="form-input" value={barcode} onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeSubmit(); } }} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Ürün ara</label>
                <input className="form-input" value={productSearch} onChange={async (e) => {
                  setProductSearch(e.target.value);
                  if (e.target.value.length >= 2) {
                    setSearchProducts((await ipc.products.list({ search: e.target.value, status: 'Aktif' })).slice(0, 20));
                  } else setSearchProducts([]);
                }} />
                {searchProducts.map((p) => (
                  <div key={p.id} style={{ fontSize: 12, padding: 4, cursor: 'pointer' }} onClick={() => { addLineFromProduct(p); setProductSearch(''); setSearchProducts([]); }}>
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
            {fromStockEntry && <div style={{ fontSize: 12, color: '#1a5276', marginBottom: 8 }}>Mal kabul bağlı — stok tekrar artmayacak.</div>}
            <table className="data-table compact">
              <thead><tr><th>Barkod</th><th>Ürün</th><th>Adet</th><th>Alış</th><th>KDV%</th><th>Toplam</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId}>
                    <td>{l.barcode}</td><td>{l.name}</td>
                    <td><input type="number" min={1} className="form-input" style={{ width: 60 }} value={l.quantity}
                      onChange={(e) => setLines((prev) => prev.map((x) => x.productId === l.productId ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                    <td><input type="number" className="form-input" style={{ width: 80 }} value={l.purchasePrice}
                      onChange={(e) => setLines((prev) => prev.map((x) => x.productId === l.productId ? { ...x, purchasePrice: Number(e.target.value) } : x))} /></td>
                    <td>{l.vatRate}</td>
                    <td className="text-right">{formatCurrency(l.quantity * l.purchasePrice * (1 + l.vatRate / 100))}</td>
                    <td><button type="button" className="btn btn-sm" onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', marginTop: 8 }}>Genel: <strong>{formatCurrency(lineTotal)}</strong></div>
            <div className="form-row" style={{ marginTop: 8 }}>
              <div className="form-group"><label>İlk ödeme</label><input type="number" className="form-input" value={initialPayAmount} onChange={(e) => setInitialPayAmount(e.target.value)} /></div>
              <div className="form-group">
                <label>Ödeme türü</label>
                <select className="form-select" value={initialPayType} onChange={(e) => setInitialPayType(e.target.value)}>
                  {SUPPLIER_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary" disabled={savingPurchase} onClick={savePurchase}>Belgeyi Kaydet</button>
              <button type="button" className="btn" onClick={() => setCreatingPurchase(false)}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'account' && (
        <div className="panel">
          <div className="panel-header">Cari Hareketler</div>
          <div className="panel-body">
            <table className="data-table compact">
              <thead><tr><th>Tarih</th><th>Tedarikçi</th><th>İşlem</th><th>Belge</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr></thead>
              <tbody>
                {allMovements.map((m, i) => (
                  <tr key={i}>
                    <td>{formatDateTime(String(m.created_at))}</td>
                    <td>{String(m.supplier_name)}</td>
                    <td>{String(m.movement_type)}</td>
                    <td>{String(m.document_no || '-')}</td>
                    <td className="text-right">{Number(m.debit_amount) > 0 ? formatCurrency(Number(m.debit_amount)) : '-'}</td>
                    <td className="text-right">{Number(m.credit_amount) > 0 ? formatCurrency(Number(m.credit_amount)) : '-'}</td>
                    <td className="text-right">{formatCurrency(Number(m.balance_after))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && canPay && (
        <div className="panel">
          <div className="panel-header">Tedarikçi Ödemesi</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group">
                <label>Tedarikçi</label>
                <select className="form-select" value={paymentSupplierId} onChange={(e) => setPaymentSupplierId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Seçin</option>
                  {suppliers.filter((s) => Number(s.is_active)).map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Tutar</label><input type="number" className="form-input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
              <div className="form-group">
                <label>Tür</label>
                <select className="form-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                  {SUPPLIER_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Tarih</label><input type="date" className="form-input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
              <div className="form-group">
                <label>Alış belgesi</label>
                <select className="form-select" value={paymentDocId} onChange={(e) => setPaymentDocId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">—</option>
                  {purchases.filter((p) => Number(p.remaining_amount) > 0).map((p) => (
                    <option key={String(p.id)} value={String(p.id)}>{String(p.document_no)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={savePayment}>Ödemeyi Kaydet</button>
          </div>
        </div>
      )}

      {showSupplierForm && (
        <div className="modal-overlay" onClick={() => setShowSupplierForm(false)}>
          <div className="modal-box" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{editSupplierId ? 'Düzenle' : 'Yeni Tedarikçi'}</h3></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Firma *</label><input className="form-input" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div>
                <div className="form-group"><label>Yetkili</label><input className="form-input" value={supplierForm.authorized_person} onChange={(e) => setSupplierForm({ ...supplierForm, authorized_person: e.target.value })} /></div>
                <div className="form-group"><label>Telefon</label><input className="form-input" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
                <div className="form-group"><label>E-posta</label><input className="form-input" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
                <div className="form-group"><label>Vergi Dairesi</label><input className="form-input" value={supplierForm.tax_office} onChange={(e) => setSupplierForm({ ...supplierForm, tax_office: e.target.value })} /></div>
                <div className="form-group"><label>Vergi No</label><input className="form-input" value={supplierForm.tax_no} onChange={(e) => setSupplierForm({ ...supplierForm, tax_no: e.target.value })} /></div>
                <div className="form-group"><label>İl</label><input className="form-input" value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} /></div>
                <div className="form-group"><label>İlçe</label><input className="form-input" value={supplierForm.district} onChange={(e) => setSupplierForm({ ...supplierForm, district: e.target.value })} /></div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Adres</label><input className="form-input" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></div>
              </div>
              <button type="button" className="btn btn-primary" onClick={saveSupplier}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {detailSupplier && (
        <div className="modal-overlay" onClick={() => setDetailSupplier(null)}>
          <div className="modal-box" style={{ width: 800, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{String(detailSupplier.name)}</h3></div>
            <div className="tab-bar">
              {(['info', 'purchases', 'account', 'payments'] as const).map((t) => (
                <button key={t} type="button" className={`tab-btn ${detailTab === t ? 'active' : ''}`} onClick={() => setDetailTab(t)}>{t}</button>
              ))}
            </div>
            {detailTab === 'info' && <p>Bakiye: {formatCurrency(Number(detailSupplier.balance ?? 0))}</p>}
            {detailTab === 'purchases' && (
              <table className="data-table compact">
                <tbody>{((detailSupplier.purchases as Record<string, unknown>[]) || []).map((p) => (
                  <tr key={String(p.id)}><td>{String(p.document_no)}</td><td>{formatCurrency(Number(p.total_amount))}</td><td>{String(p.payment_status)}</td></tr>
                ))}</tbody>
              </table>
            )}
            {detailTab === 'account' && (
              <table className="data-table compact">
                <tbody>{((detailSupplier.accountMovements as Record<string, unknown>[]) || []).map((m, i) => (
                  <tr key={i}><td>{formatDateTime(String(m.created_at))}</td><td>{String(m.movement_type)}</td><td>{formatCurrency(Number(m.balance_after))}</td></tr>
                ))}</tbody>
              </table>
            )}
            {detailTab === 'payments' && (
              <table className="data-table compact">
                <tbody>{((detailSupplier.payments as Record<string, unknown>[]) || []).map((p) => (
                  <tr key={String(p.id)}><td>{String(p.payment_date)}</td><td>{formatCurrency(Number(p.amount))}</td><td>{String(p.payment_type)}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {purchaseDetail && (
        <div className="modal-overlay" onClick={() => setPurchaseDetail(null)}>
          <div className="modal-box" style={{ width: 700 }} onClick={(e) => e.stopPropagation()}>
            <h3>{String(purchaseDetail.document_no)}</h3>
            <p>{String(purchaseDetail.supplier_name)} — {formatCurrency(Number(purchaseDetail.total_amount))}</p>
            {canEdit && purchaseDetail.status !== 'İptal' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input className="form-input" placeholder="İptal nedeni" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                <button type="button" className="btn btn-sm" onClick={async () => {
                  if (!cancelReason.trim()) return;
                  await ipc.purchases.cancel(Number(purchaseDetail.id), { cancel_reason: cancelReason });
                  setPurchaseDetail(null);
                  loadPurchases();
                  loadSuppliers();
                }}>İptal Et</button>
                <button type="button" className="btn btn-sm" onClick={async () => openPrintPreview(await ipc.purchases.print(Number(purchaseDetail.id)))}>Yazdır</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showQuickProduct && unknownBarcode && (
        <QuickProductModal barcode={unknownBarcode} onSave={async (r) => {
          setShowQuickProduct(false);
          const product = await ipc.products.getById(r.productId);
          if (product) addLineFromProduct(product);
          setUnknownBarcode(null);
        }} onCancel={() => { setShowQuickProduct(false); setUnknownBarcode(null); }} />
      )}
    </div>
  );
}
