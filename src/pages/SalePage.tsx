import { useCallback, useEffect, useRef, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import type { Customer, CashPaymentType, PaymentType, Prescription, Product, SaleLineItem } from '@/types/electron';
import { PAYMENT_TYPES, CASH_PAYMENT_TYPES } from '@/types/electron';
import { sanitizeBarcode } from '@/utils/barcode';
import { formatScanNote, lineKey } from '@/types/barcode';
import type { ParsedBarcode } from '@/types/barcode';
import QuickCustomerForm from '@/components/customers/QuickCustomerForm';
import '@/components/products/ProductForm.css';

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function SalePage() {
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState<SaleLineItem[]>([]);
  const [error, setError] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentType>('Nakit');
  const [partialPaymentType, setPartialPaymentType] = useState<CashPaymentType>('Nakit');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerPrescriptions, setCustomerPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerPrescriptions([]);
      setSelectedPrescriptionId(null);
      return;
    }
    ipc.prescriptions.listByCustomer(selectedCustomer.id, true).then(setCustomerPrescriptions).catch(console.error);
  }, [selectedCustomer]);

  const searchCustomers = (query: string) => {
    setCustomerSearch(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await ipc.customers.search(query);
      setCustomerResults(results);
      setShowCustomerDropdown(true);
    }, 250);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setCustomerResults([]);
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setSelectedPrescriptionId(null);
    setCustomerPrescriptions([]);
  };

  const handleQuickCustomerSave = async (data: { full_name: string; phone: string }) => {
    const result = await ipc.customers.createQuick(data);
    const customer = await ipc.customers.getById(result.id);
    if (customer) {
      selectCustomer(customer);
      setToast('Hızlı müşteri eklendi.');
    }
    setShowQuickCustomer(false);
  };

  const addProduct = (product: Product, parsed?: ParsedBarcode) => {
    if (product.status !== 'Aktif') {
      setError('Bu ürün pasif durumda, satışa eklenemez.');
      setBarcode('');
      focusInput();
      return;
    }
    if (product.stock_quantity <= 0) {
      setError('Bu ürünün stoğu tükenmiş.');
      setBarcode('');
      focusInput();
      return;
    }

    const serialNo = parsed?.serialNo;
    const note = parsed ? formatScanNote(parsed) : undefined;
    const id = lineKey(product.id, serialNo);

    setItems((prev) => {
      if (serialNo) {
        const dup = prev.find((i) => i.serialNo === serialNo && i.productId === product.id);
        if (dup) {
          setError(`Bu seri numarası zaten listede: ${serialNo}`);
          return prev;
        }
      }

      const existing = prev.find((i) => i.lineId === id);
      if (existing && !serialNo) {
        const newQty = existing.quantity + 1;
        if (newQty > product.stock_quantity) {
          setError(`"${product.name}" için yetersiz stok. Mevcut: ${product.stock_quantity}`);
          return prev;
        }
        return prev.map((i) =>
          i.lineId === id
            ? { ...i, quantity: newQty, total: newQty * i.unitPrice, stockQuantity: product.stock_quantity }
            : i
        );
      }

      return [
        ...prev,
        {
          lineId: id,
          productId: product.id,
          name: product.name,
          barcode: parsed?.barcode || product.barcode || '',
          quantity: 1,
          unitPrice: product.sale_price,
          total: product.sale_price,
          stockQuantity: product.stock_quantity,
          note: note || undefined,
          serialNo: serialNo || undefined,
          lotNo: parsed?.lotNo,
          expiryDate: parsed?.expiryDate,
        },
      ];
    });
    setError('');
  };

  const handleBarcodeSubmit = async () => {
    const code = sanitizeBarcode(barcode);
    if (!code) return;
    try {
      const { product, parsed } = await ipc.products.resolveScan(code, false);
      if (!product) {
        setError('Bu barkoda veya karekoda ait ürün bulunamadı.');
        setBarcode('');
        focusInput();
        return;
      }
      if (product.status !== 'Aktif') {
        setError('Bu ürün pasif durumda, satışa eklenemez.');
        setBarcode('');
        focusInput();
        return;
      }
      addProduct(product, parsed);
      setBarcode('');
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit();
    }
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
    focusInput();
  };

  const clearList = () => {
    setItems([]);
    setError('');
    focusInput();
  };

  const handleCompleteSale = async () => {
    if (!items.length) {
      setError('Satış listesi boş.');
      return;
    }
    if ((paymentMode === 'Açık Hesap' || paymentMode === 'Parçalı Ödeme') && !selectedCustomer) {
      setError('Açık hesap ve parçalı ödeme için müşteri seçimi zorunludur.');
      return;
    }
    const total = items.reduce((sum, i) => sum + i.total, 0);
    const paidAmount = paymentMode === 'Parçalı Ödeme' ? parseFloat(paidAmountInput) || 0 : undefined;
    if (paymentMode === 'Parçalı Ödeme' && paidAmount > total) {
      setError('Alınan tutar toplam tutardan fazla olamaz.');
      return;
    }
    setCompleting(true);
    setError('');
    try {
      const result = await ipc.sales.complete(items, {
        customerId: selectedCustomer?.id ?? null,
        prescriptionId: selectedPrescriptionId,
        paymentMode,
        paymentType: paymentMode === 'Parçalı Ödeme' ? partialPaymentType : undefined,
        paidAmount,
      });
      const label = selectedCustomer ? selectedCustomer.full_name : 'Hızlı satış';
      setToast(`Satış tamamlandı (${label}): ${result.saleNo}`);
      setItems([]);
      setBarcode('');
      setPaidAmountInput('');
      clearCustomer();
      focusInput();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const totalAmount = items.reduce((sum, i) => sum + i.total, 0);
  const selectedPrescription = customerPrescriptions.find((p) => p.id === selectedPrescriptionId);

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Barkodlu Satış</h2>
        <button className="btn" onClick={clearList}>Listeyi Temizle</button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="customer-select-bar">
        <div className="customer-search-wrap">
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Müşteri Seç (opsiyonel)</label>
          {selectedCustomer ? (
            <div className="customer-selected">
              <strong>{selectedCustomer.full_name}</strong>
              {selectedCustomer.phone && ` — ${selectedCustomer.phone}`}
              <button type="button" className="btn btn-remove" style={{ marginLeft: 8 }} onClick={clearCustomer}>Kaldır</button>
            </div>
          ) : (
            <>
              <input
                className="form-input"
                placeholder="Ad, telefon veya T.C. kimlik no ile ara..."
                value={customerSearch}
                onChange={(e) => searchCustomers(e.target.value)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="customer-dropdown">
                  {customerResults.map((c) => (
                    <div key={c.id} className="customer-dropdown-item" onMouseDown={() => selectCustomer(c)}>
                      {c.full_name} {c.phone ? `(${c.phone})` : ''} {c.tc_no ? `— ${c.tc_no}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <button type="button" className="btn" onClick={() => setShowQuickCustomer(true)}>Yeni Müşteri</button>
        {selectedCustomer && customerPrescriptions.length > 0 && (
          <div className="form-group" style={{ minWidth: 200 }}>
            <label>Reçete Bağla</label>
            <select
              className="form-select"
              value={selectedPrescriptionId || ''}
              onChange={(e) => setSelectedPrescriptionId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Reçete seçmeyin</option>
              {customerPrescriptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prescription_no || p.e_prescription_no} — {p.prescription_date}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedPrescription && (
        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          Bağlı reçete: {selectedPrescription.prescription_no} | Sağ: {selectedPrescription.right_eye} | Sol: {selectedPrescription.left_eye}
        </div>
      )}

      {!selectedCustomer && (
        <div className="alert alert-info" style={{ marginBottom: 0 }}>Hızlı satış modu — müşteri seçilmedi</div>
      )}

      <div className="barcode-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="barcode-input"
          placeholder="Barkod okutunuz..."
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="panel-header">Satış Listesi</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Barkod</th>
                <th>Ürün Adı</th>
                <th>Not (Seri/Lot/SKT)</th>
                <th className="text-center">Adet</th>
                <th className="text-right">Birim Fiyat</th>
                <th className="text-right">Toplam</th>
                <th className="text-center">Sil</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="empty-text">Barkod okutarak ürün ekleyin</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.lineId}>
                    <td>{item.barcode}</td>
                    <td>{item.name}</td>
                    <td style={{ fontSize: 11 }}>{item.note || '-'}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right">{formatCurrency(item.total)}</td>
                    <td className="text-center">
                      <button type="button" className="btn btn-remove" onClick={() => removeItem(item.lineId)}>Sil</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sale-payment-bar">
        <label>Ödeme:</label>
        <select className="form-select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentType)}>
          {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {paymentMode === 'Parçalı Ödeme' && (
          <>
            <select className="form-select" value={partialPaymentType} onChange={(e) => setPartialPaymentType(e.target.value as CashPaymentType)}>
              {CASH_PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              type="number"
              className="form-input"
              style={{ width: 120 }}
              placeholder="Alınan tutar"
              value={paidAmountInput}
              onChange={(e) => setPaidAmountInput(e.target.value)}
              max={totalAmount}
              step="0.01"
            />
          </>
        )}
        <div className="toolbar-spacer" />
        <span style={{ fontWeight: 600 }}>Toplam: {formatCurrency(totalAmount)}</span>
        <button className="btn btn-primary" onClick={handleCompleteSale} disabled={completing || items.length === 0}>
          {completing ? 'Tamamlanıyor...' : 'Satışı Tamamla'}
        </button>
      </div>

      <div className="sale-total-bar">
        <span className="total-label">Genel Toplam:</span>
        <span className="total-amount">{formatCurrency(totalAmount)}</span>
      </div>

      {showQuickCustomer && (
        <QuickCustomerForm
          onSave={handleQuickCustomerSave}
          onCancel={() => setShowQuickCustomer(false)}
        />
      )}
    </div>
  );
}
