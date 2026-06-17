import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/types/auth';
import type { AddPaymentInput, SaleDetail as SaleDetailType } from '@/types/electron';
import { CASH_PAYMENT_TYPES } from '@/types/electron';
import type { SaleReturnHistory } from '@/types/returns';
import '@/components/products/ProductForm.css';

interface SaleDetailProps {
  saleId: number;
  onClose: () => void;
  onUpdated: () => void;
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

function groupReturns(rows: SaleReturnHistory[] = []): SaleReturnHistory[] {
  const map = new Map<number, SaleReturnHistory>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, { ...row });
    }
  }
  return Array.from(map.values());
}

export default function SaleDetail({ saleId, onClose, onUpdated }: SaleDetailProps) {
  const { hasPermission } = useAuth();
  const canCreateDraft = hasPermission(PERMISSIONS.EINVOICE_EDIT);
  const [sale, setSale] = useState<SaleDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState<AddPaymentInput['paymentType']>('Nakit');
  const [payDesc, setPayDesc] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [draftDocType, setDraftDocType] = useState('E-Arşiv');
  const [showDraft, setShowDraft] = useState(false);

  const load = () => {
    setLoading(true);
    ipc.sales.getById(saleId).then(setSale).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [saleId]);

  const handleAddPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      setError('Geçerli bir tutar girin.');
      return;
    }
    setError('');
    try {
      await ipc.sales.addPayment({
        saleId,
        amount,
        paymentType: payType,
        description: payDesc || undefined,
      });
      setToast('Tahsilat kaydedildi.');
      setShowPayment(false);
      setPayAmount('');
      load();
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePrintSale = async () => {
    try {
      const doc = await ipc.print.saleReceipt(saleId);
      openPrintPreview(doc);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handlePrintPayment = async (paymentId: number) => {
    try {
      const doc = await ipc.print.paymentReceipt(paymentId);
      openPrintPreview(doc);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleCreateDraft = async (force = false) => {
    setError('');
    try {
      const r = await ipc.invoiceDrafts.createFromSale({
        sale_id: saleId,
        document_type: draftDocType,
        force,
      });
      setToast(`Fatura taslağı oluşturuldu (#${r.draftId})`);
      if (r.warning) setError(r.warning);
      setShowDraft(false);
    } catch (err) {
      const msg = (err as Error).message;
      if (!force && msg.includes('zaten fatura taslağı')) {
        if (confirm(`${msg}\n\nYine de oluşturmak istiyor musunuz?`)) {
          await handleCreateDraft(true);
        }
      } else {
        setError(msg);
      }
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError('İptal nedeni zorunludur.');
      return;
    }
    setError('');
    try {
      const result = await ipc.sales.cancel({ saleId, reason: cancelReason.trim(), note: cancelNote.trim() || undefined });
      setToast(result.message);
      setShowCancel(false);
      load();
      onUpdated();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading || !sale) {
    return (
      <div className="product-form-overlay">
        <div className="product-form-panel" style={{ width: 800 }}><div className="loading-text">Yükleniyor...</div></div>
      </div>
    );
  }

  const prescriptionLabel = sale.prescription_no || sale.e_prescription_no || '-';
  const isCancelled = sale.status === 'İptal edildi';
  const returnHistory = groupReturns(sale.returns as SaleReturnHistory[] | undefined);

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 900, maxHeight: '90vh' }}>
        <div className="product-form-header">
          <span>Satış Detayı — {sale.sale_no}</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>

        {toast && <Toast message={toast} onDone={() => setToast('')} />}
        {error && !showCancel && <div className="alert alert-error product-form-alert">{error}</div>}

        <div className="product-form-body">
          <div className="detail-grid">
            <div><strong>Satış No:</strong> {sale.sale_no}</div>
            <div><strong>Tarih:</strong> {formatDateTime(sale.sale_date)}</div>
            <div><strong>Müşteri:</strong> {sale.customer_name || 'Perakende'}</div>
            <div><strong>Reçete:</strong> {prescriptionLabel}</div>
            <div><strong>Satış Durumu:</strong> {sale.status}</div>
            <div><strong>Ödeme Durumu:</strong> {sale.payment_status}</div>
            <div><strong>Toplam:</strong> {formatCurrency(sale.net_amount)}</div>
            <div><strong>Ödenen:</strong> {formatCurrency(sale.paid_amount)}</div>
            <div><strong>Kalan:</strong> <span className={sale.remaining_amount > 0 ? 'amount-negative' : ''}>{formatCurrency(sale.remaining_amount)}</span></div>
            {isCancelled && (
              <>
                <div><strong>İptal Nedeni:</strong> {sale.cancel_reason || '-'}</div>
                <div><strong>İptal Tarihi:</strong> {formatDateTime(sale.cancelled_at)}</div>
                {sale.cancel_note && <div style={{ gridColumn: '1 / -1' }}><strong>İptal Notu:</strong> {sale.cancel_note}</div>}
              </>
            )}
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <div className="panel-header">Satış Kalemleri</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Barkod</th><th>Ürün</th><th>Tip</th>
                  <th className="text-center">Satılan</th>
                  <th className="text-center">İade</th>
                  <th className="text-center">Kalan</th>
                  <th className="text-right">Birim Fiyat</th>
                  <th className="text-right">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => {
                  const returned = i.returned_quantity ?? 0;
                  const remaining = i.quantity - returned;
                  return (
                    <tr key={i.id}>
                      <td>{i.barcode || '-'}</td>
                      <td>{i.product_name}</td>
                      <td>{i.product_type}</td>
                      <td className="text-center">{i.quantity}</td>
                      <td className="text-center">{returned}</td>
                      <td className="text-center">{remaining}</td>
                      <td className="text-right">{formatCurrency(i.unit_price)}</td>
                      <td className="text-right">{formatCurrency(i.total_price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="panel" style={{ marginTop: 8 }}>
            <div className="panel-header">Ödeme Hareketleri</div>
            <table className="data-table">
              <thead>
                <tr><th>Tarih</th><th>Tür</th><th>Açıklama</th><th className="text-right">Tutar</th><th></th></tr>
              </thead>
              <tbody>
                {sale.payments.length === 0 ? (
                  <tr><td colSpan={5} className="empty-text">Ödeme kaydı yok</td></tr>
                ) : (
                  sale.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateTime(p.payment_date)}</td>
                      <td>{p.payment_type}</td>
                      <td>{p.description || '-'}</td>
                      <td className="text-right amount-positive">{formatCurrency(p.amount)}</td>
                      <td><button className="btn btn-sm" onClick={() => handlePrintPayment(p.id)}>Makbuz</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {returnHistory.length > 0 && (
            <div className="panel" style={{ marginTop: 8 }}>
              <div className="panel-header">İade / Değişim Geçmişi</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th><th>İşlem Tipi</th><th>Ürün</th>
                    <th className="text-center">Adet</th>
                    <th className="text-right">Tutar</th>
                    <th>Neden</th><th>Durum</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {returnHistory.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{r.return_type}</td>
                      <td>{r.product_name || '-'}</td>
                      <td className="text-center">{r.quantity ?? '-'}</td>
                      <td className="text-right">{formatCurrency(r.total_amount)}</td>
                      <td>{r.reason || '-'}</td>
                      <td>{r.status}</td>
                      <td>
                        <button className="btn btn-sm" onClick={async () => {
                          const doc = await ipc.print.returnReceipt(r.id);
                          openPrintPreview(doc);
                        }}>Fiş</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showPayment && sale.remaining_amount > 0 && !isCancelled && (
            <div className="panel" style={{ marginTop: 8 }}>
              <div className="panel-header">Tahsilat Ekle (Kalan: {formatCurrency(sale.remaining_amount)})</div>
              <div className="panel-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Tutar</label>
                    <input type="number" className="form-input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} max={sale.remaining_amount} step="0.01" />
                  </div>
                  <div className="form-group">
                    <label>Ödeme Türü</label>
                    <select className="form-select" value={payType} onChange={(e) => setPayType(e.target.value as AddPaymentInput['paymentType'])}>
                      {CASH_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Açıklama</label>
                    <input className="form-input" value={payDesc} onChange={(e) => setPayDesc(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleAddPayment}>Tahsilat Kaydet</button>
                <button className="btn" style={{ marginLeft: 6 }} onClick={() => setShowPayment(false)}>Vazgeç</button>
              </div>
            </div>
          )}

          {showCancel && !isCancelled && (
            <div className="panel" style={{ marginTop: 8 }}>
              <div className="panel-header">Satışı İptal Et</div>
              <div className="panel-body">
                <p style={{ fontSize: 12, margin: '0 0 8px', color: '#555' }}>
                  Bu işlem satış kalemlerini stoklara geri alır ve kasa/cari hareketlerini düzeltir.
                </p>
                {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>İptal Nedeni *</label>
                    <input className="form-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Not</label>
                    <input className="form-input" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-danger" onClick={handleCancel}>Satışı İptal Et</button>
                <button className="btn" style={{ marginLeft: 6 }} onClick={() => { setShowCancel(false); setError(''); }}>Vazgeç</button>
              </div>
            </div>
          )}
          {showDraft && !isCancelled && sale.status === 'Tamamlandı' && canCreateDraft && (
            <div className="panel" style={{ marginTop: 8 }}>
              <div className="panel-header">Fatura Taslağı Oluştur</div>
              <div className="panel-body">
                <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
                  Bu işlem e-fatura/e-arşiv hazırlık taslağı oluşturur. Resmi gönderim entegratörünüz üzerinden yapılır.
                </p>
                <div className="form-group">
                  <label>Belge Türü</label>
                  <select className="form-select" value={draftDocType} onChange={(e) => setDraftDocType(e.target.value)}>
                    <option value="E-Arşiv">E-Arşiv</option>
                    <option value="E-Fatura">E-Fatura</option>
                    <option value="Kağıt Fatura Notu">Kağıt Fatura Notu</option>
                    <option value="Bilgi Fişi">Bilgi Fişi</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={() => handleCreateDraft()}>Taslak Oluştur</button>
                <button className="btn" style={{ marginLeft: 6 }} onClick={() => setShowDraft(false)}>Vazgeç</button>
              </div>
            </div>
          )}
        </div>

        <div className="product-form-footer">
          {sale.remaining_amount > 0 && !isCancelled && (
            <button className="btn btn-primary" onClick={() => setShowPayment(true)}>Tahsilat Ekle</button>
          )}
          {!isCancelled && sale.status === 'Tamamlandı' && canCreateDraft && (
            <button className="btn" onClick={() => setShowDraft(true)}>Fatura Taslağı Oluştur</button>
          )}
          <button className="btn" onClick={handlePrintSale}>Satış Fişi Yazdır</button>
          {!isCancelled && sale.status === 'Tamamlandı' && (
            <button className="btn btn-danger" onClick={() => setShowCancel(true)}>Satışı İptal Et</button>
          )}
          <button className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
