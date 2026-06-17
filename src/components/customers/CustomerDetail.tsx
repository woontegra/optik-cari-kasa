import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import type { AccountMovement, Customer, CustomerSale, Prescription } from '@/types/electron';
import '@/components/products/ProductForm.css';

type DetailTab = 'general' | 'prescriptions' | 'sales' | 'account' | 'notes';

interface CustomerDetailProps {
  customerId: number;
  onClose: () => void;
  onEdit: () => void;
}

export default function CustomerDetail({ customerId, onClose, onEdit }: CustomerDetailProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<DetailTab>('general');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ipc.customers.getById(customerId),
      ipc.prescriptions.listByCustomer(customerId),
      ipc.customers.getSales(customerId),
      ipc.customers.getAccountMovements(customerId),
    ])
      .then(([c, pr, sa, mv]) => {
        setCustomer(c);
        setPrescriptions(pr);
        setSales(sa);
        setMovements(mv);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading || !customer) {
    return (
      <div className="product-form-overlay">
        <div className="product-form-panel" style={{ width: 720 }}>
          <div className="loading-text">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'general', label: 'Genel Bilgiler' },
    { id: 'prescriptions', label: 'Reçeteler' },
    { id: 'sales', label: 'Satış Geçmişi' },
    { id: 'account', label: 'Cari Hareketler' },
    { id: 'notes', label: 'Notlar' },
  ];

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 780, maxHeight: '85vh' }}>
        <div className="product-form-header">
          <span>{customer.full_name} — Müşteri Detayı</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="product-form-tabs">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="product-form-body">
          {tab === 'general' && (
            <div className="detail-grid">
              <div><strong>T.C. Kimlik:</strong> {customer.tc_no || '-'}</div>
              <div><strong>Telefon:</strong> {customer.phone || '-'}</div>
              <div><strong>E-posta:</strong> {customer.email || '-'}</div>
              <div><strong>Doğum Tarihi:</strong> {formatDate(customer.birth_date)}</div>
              <div><strong>İl / İlçe:</strong> {[customer.city, customer.district].filter(Boolean).join(' / ') || '-'}</div>
              <div><strong>Durum:</strong> {customer.status || 'Aktif'}</div>
              <div><strong>Cari Bakiye:</strong> {formatCurrency(customer.balance)}</div>
              <div><strong>Son Satış:</strong> {formatDate(customer.last_sale_date)}</div>
              <div className="detail-full"><strong>Adres:</strong> {customer.address || '-'}</div>
              <div className="detail-full">
                <strong>İzinler:</strong>{' '}
                {[
                  customer.kvkk_consent && 'KVKK',
                  customer.sms_permission && 'SMS',
                  customer.email_permission && 'E-posta',
                ].filter(Boolean).join(', ') || 'Yok'}
              </div>
            </div>
          )}

          {tab === 'prescriptions' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reçete No</th>
                  <th>Tarih</th>
                  <th>Doktor</th>
                  <th>Sağ Göz</th>
                  <th>Sol Göz</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.length === 0 ? (
                  <tr><td colSpan={6} className="empty-text">Reçete kaydı yok</td></tr>
                ) : (
                  prescriptions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.prescription_no || p.e_prescription_no || '-'}</td>
                      <td>{formatDate(p.prescription_date)}</td>
                      <td>{p.doctor || '-'}</td>
                      <td>{p.right_eye || '-'}</td>
                      <td>{p.left_eye || '-'}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'sales' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Satış No</th>
                  <th>Tarih</th>
                  <th>Reçete</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={4} className="empty-text">Satış kaydı yok</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.sale_no}</td>
                      <td>{formatDateTime(s.sale_date)}</td>
                      <td>{s.prescription_no || s.e_prescription_no || '-'}</td>
                      <td className="text-right">{formatCurrency(s.net_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'account' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>İşlem Türü</th>
                  <th>Açıklama</th>
                  <th className="text-right">Borç</th>
                  <th className="text-right">Alacak</th>
                  <th className="text-right">Bakiye</th>
                  <th>Satış No</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={7} className="empty-text">Cari hareket yok</td></tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.created_at)}</td>
                      <td>{m.movement_type}</td>
                      <td>{m.description || '-'}</td>
                      <td className="text-right amount-negative">{m.debit_amount > 0 ? formatCurrency(m.debit_amount) : '-'}</td>
                      <td className="text-right amount-positive">{m.credit_amount > 0 ? formatCurrency(m.credit_amount) : '-'}</td>
                      <td className="text-right">{formatCurrency(m.balance_after)}</td>
                      <td>{m.sale_no || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === 'notes' && (
            <div className="form-group">
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>
                {customer.notes || 'Not bulunmuyor.'}
              </p>
            </div>
          )}
        </div>

        <div className="product-form-footer">
          <button type="button" className="btn btn-primary" onClick={onEdit}>Düzenle</button>
          <button type="button" className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
