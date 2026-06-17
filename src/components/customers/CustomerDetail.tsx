import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import { PERMISSIONS } from '@/types/auth';
import type { AccountMovement, Customer, CustomerSale, Prescription } from '@/types/electron';
import type {
  Appointment,
  CommunicationChannel,
  CommunicationLog,
  CUSTOMER_DOCUMENT_TYPES,
  ImportantDate,
} from '@/types/customerTracking';
import CommunicationPrepModal from './CommunicationPrepModal';
import '@/components/products/ProductForm.css';

type DetailTab =
  | 'general'
  | 'prescriptions'
  | 'sales'
  | 'account'
  | 'appointments'
  | 'dates'
  | 'communications'
  | 'documents'
  | 'notes';

interface CustomerDetailProps {
  customerId: number;
  onClose: () => void;
  onEdit: () => void;
}

export default function CustomerDetail({ customerId, onClose, onEdit }: CustomerDetailProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.CUSTOMERS_EDIT);
  const canComm = hasPermission(PERMISSIONS.COMMUNICATIONS_EDIT);
  const canAppt = hasPermission(PERMISSIONS.APPOINTMENTS_EDIT);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('general');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [commLogs, setCommLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [commModal, setCommModal] = useState<{ channel: CommunicationChannel; template?: string } | null>(null);

  const [newDate, setNewDate] = useState({ title: '', date: '', repeat_type: 'Tek seferlik', notes: '' });
  const [newAppt, setNewAppt] = useState({ appointment_date: '', appointment_time: '', appointment_type: 'Muayene', notes: '' });

  const reload = () => {
    setLoading(true);
    Promise.all([
      ipc.customers.getById(customerId),
      ipc.customers.getPhotoData(customerId),
      ipc.prescriptions.listByCustomer(customerId),
      ipc.customers.getSales(customerId),
      ipc.customers.getAccountMovements(customerId),
      ipc.appointments.getByCustomer(customerId),
      ipc.customerDates.list(customerId),
      ipc.communications.listByCustomer(customerId),
    ])
      .then(([c, photo, pr, sa, mv, ap, dt, cl]) => {
        setCustomer(c);
        setPhotoUrl(photo.dataUrl);
        setPrescriptions(pr);
        setSales(sa);
        setMovements(mv);
        setAppointments(ap);
        setImportantDates(dt);
        setCommLogs(cl);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [customerId]);

  const handleUploadPhoto = async () => {
    const res = await ipc.customers.uploadPhoto(customerId);
    if (!res.cancelled) reload();
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Fotoğraf kaldırılsın mı?')) return;
    await ipc.customers.removePhoto(customerId);
    reload();
  };

  const handleAddDate = async () => {
    if (!newDate.title || !newDate.date) return alert('Başlık ve tarih zorunludur.');
    await ipc.customerDates.create({ customer_id: customerId, ...newDate });
    setNewDate({ title: '', date: '', repeat_type: 'Tek seferlik', notes: '' });
    reload();
  };

  const handleAddAppt = async () => {
    if (!newAppt.appointment_date) return alert('Randevu tarihi zorunludur.');
    await ipc.appointments.create({ customer_id: customerId, ...newAppt });
    setNewAppt({ appointment_date: '', appointment_time: '', appointment_type: 'Muayene', notes: '' });
    reload();
  };

  const handlePrintDoc = async (docType: (typeof CUSTOMER_DOCUMENT_TYPES)[number]) => {
    const doc = await ipc.customerDocuments.print(docType, customerId);
    openPrintPreview(doc);
  };

  if (loading || !customer) {
    return (
      <div className="product-form-overlay">
        <div className="product-form-panel" style={{ width: 820 }}>
          <div className="loading-text">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'general', label: 'Genel' },
    { id: 'prescriptions', label: 'Reçeteler' },
    { id: 'sales', label: 'Satış Geçmişi' },
    { id: 'account', label: 'Cari Hareketler' },
    { id: 'appointments', label: 'Randevular' },
    { id: 'dates', label: 'Önemli Tarihler' },
    { id: 'communications', label: 'İletişim Geçmişi' },
    { id: 'documents', label: 'Belgeler' },
    { id: 'notes', label: 'Notlar' },
  ];

  return (
    <>
      <div className="product-form-overlay">
        <div className="product-form-panel" style={{ width: 860, maxHeight: '90vh' }}>
          <div className="product-form-header">
            <span>{customer.full_name} — Müşteri Detayı</span>
            <button type="button" className="btn-close" onClick={onClose}>×</button>
          </div>

          <div className="product-form-tabs" style={{ flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button key={t.id} type="button" className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="product-form-body">
            {tab === 'general' && (
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, background: 'var(--bg-muted)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>☺</div>
                  )}
                  {canEdit && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button type="button" className="btn btn-sm" onClick={handleUploadPhoto}>Fotoğraf</button>
                      {photoUrl && <button type="button" className="btn btn-sm" onClick={handleRemovePhoto}>Kaldır</button>}
                    </div>
                  )}
                </div>
                <div className="detail-grid" style={{ flex: 1 }}>
                  <div><strong>Kategori:</strong> {customer.customer_category || '-'}{customer.is_vip ? ' (VIP)' : ''}</div>
                  <div><strong>Telefon:</strong> {customer.phone || '-'}</div>
                  <div><strong>WhatsApp:</strong> {customer.whatsapp_phone || '-'}</div>
                  <div><strong>Kurum:</strong> {customer.institution_name || '-'}</div>
                  <div><strong>Referans:</strong> {customer.reference_source || '-'}{customer.referred_by_name ? ` (${customer.referred_by_name})` : ''}</div>
                  <div><strong>Cari Bakiye:</strong> {formatCurrency(customer.balance)}</div>
                  <div><strong>Son Satış:</strong> {formatDate(customer.last_sale_date)}</div>
                  <div><strong>Son Reçete:</strong> {customer.last_prescription_no || '-'} {customer.last_prescription_date ? `(${formatDate(customer.last_prescription_date)})` : ''}</div>
                  <div><strong>Yaklaşan Randevu:</strong> {customer.next_appointment ? `${formatDate(customer.next_appointment.appointment_date)} ${customer.next_appointment.appointment_time || ''} — ${customer.next_appointment.appointment_type}` : '-'}</div>
                  <div><strong>Sonraki Kontrol:</strong> {formatDate(customer.next_control_date)}</div>
                </div>
              </div>
            )}

            {tab === 'prescriptions' && (
              <table className="data-table">
                <thead><tr><th>Reçete No</th><th>Tarih</th><th>Doktor</th><th>Sağ</th><th>Sol</th><th>Durum</th></tr></thead>
                <tbody>
                  {prescriptions.length === 0 ? <tr><td colSpan={6} className="empty-text">Reçete kaydı yok</td></tr> : prescriptions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.prescription_no || p.e_prescription_no || '-'}</td>
                      <td>{formatDate(p.prescription_date)}</td>
                      <td>{p.doctor || '-'}</td>
                      <td>{p.right_eye || '-'}</td>
                      <td>{p.left_eye || '-'}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'sales' && (
              <table className="data-table">
                <thead><tr><th>Satış No</th><th>Tarih</th><th>Reçete</th><th className="text-right">Tutar</th></tr></thead>
                <tbody>
                  {sales.length === 0 ? <tr><td colSpan={4} className="empty-text">Satış kaydı yok</td></tr> : sales.map((s) => (
                    <tr key={s.id}><td>{s.sale_no}</td><td>{formatDateTime(s.sale_date)}</td><td>{s.prescription_no || '-'}</td><td className="text-right">{formatCurrency(s.net_amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'account' && (
              <table className="data-table">
                <thead><tr><th>Tarih</th><th>İşlem</th><th>Açıklama</th><th className="text-right">Borç</th><th className="text-right">Alacak</th><th className="text-right">Bakiye</th></tr></thead>
                <tbody>
                  {movements.length === 0 ? <tr><td colSpan={6} className="empty-text">Cari hareket yok</td></tr> : movements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.created_at)}</td><td>{m.movement_type}</td><td>{m.description || '-'}</td>
                      <td className="text-right amount-negative">{m.debit_amount > 0 ? formatCurrency(m.debit_amount) : '-'}</td>
                      <td className="text-right amount-positive">{m.credit_amount > 0 ? formatCurrency(m.credit_amount) : '-'}</td>
                      <td className="text-right">{formatCurrency(m.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'appointments' && (
              <>
                {canAppt && (
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input type="date" className="form-input" value={newAppt.appointment_date} onChange={(e) => setNewAppt((p) => ({ ...p, appointment_date: e.target.value }))} />
                    <input type="time" className="form-input" value={newAppt.appointment_time} onChange={(e) => setNewAppt((p) => ({ ...p, appointment_time: e.target.value }))} />
                    <select className="form-select" value={newAppt.appointment_type} onChange={(e) => setNewAppt((p) => ({ ...p, appointment_type: e.target.value }))}>
                      {['Muayene', 'Gözlük Teslim', 'Lens Kontrol', 'Reçete Takip', 'Servis / Arıza', 'Diğer'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleAddAppt}>Randevu Ekle</button>
                  </div>
                )}
                <table className="data-table">
                  <thead><tr><th>Tarih</th><th>Saat</th><th>Tür</th><th>Durum</th><th>Not</th></tr></thead>
                  <tbody>
                    {appointments.length === 0 ? <tr><td colSpan={5} className="empty-text">Randevu yok</td></tr> : appointments.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.appointment_date)}</td><td>{a.appointment_time || '-'}</td><td>{a.appointment_type}</td><td>{a.status}</td><td>{a.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {tab === 'dates' && (
              <>
                {canEdit && (
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <input className="form-input" placeholder="Başlık" value={newDate.title} onChange={(e) => setNewDate((p) => ({ ...p, title: e.target.value }))} />
                    <input type="date" className="form-input" value={newDate.date} onChange={(e) => setNewDate((p) => ({ ...p, date: e.target.value }))} />
                    <select className="form-select" value={newDate.repeat_type} onChange={(e) => setNewDate((p) => ({ ...p, repeat_type: e.target.value }))}>
                      {['Tek seferlik', 'Yıllık', 'Aylık', 'Yok'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleAddDate}>Ekle</button>
                  </div>
                )}
                <table className="data-table">
                  <thead><tr><th>Başlık</th><th>Tarih</th><th>Tekrar</th><th>Hatırlatma (gün)</th><th>Not</th></tr></thead>
                  <tbody>
                    {importantDates.length === 0 ? <tr><td colSpan={5} className="empty-text">Önemli tarih yok</td></tr> : importantDates.map((d) => (
                      <tr key={d.id}><td>{d.title}</td><td>{formatDate(d.date)}</td><td>{d.repeat_type}</td><td>{d.reminder_days_before}</td><td>{d.notes || '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {tab === 'communications' && (
              <>
                {canComm && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setCommModal({ channel: 'WHATSAPP' })}>WhatsApp</button>
                    <button type="button" className="btn btn-sm" onClick={() => setCommModal({ channel: 'SMS' })}>SMS</button>
                    <button type="button" className="btn btn-sm" onClick={() => setCommModal({ channel: 'EMAIL' })}>E-posta</button>
                    {customer.balance > 0 && (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => setCommModal({ channel: 'WHATSAPP', template: 'Borç bakiye hatırlatma' })}>
                        Borç Bakiye Mesajı
                      </button>
                    )}
                  </div>
                )}
                <table className="data-table">
                  <thead><tr><th>Tarih</th><th>Kanal</th><th>Şablon</th><th>Durum</th><th>Mesaj</th></tr></thead>
                  <tbody>
                    {commLogs.length === 0 ? <tr><td colSpan={5} className="empty-text">İletişim kaydı yok</td></tr> : commLogs.map((l) => (
                      <tr key={l.id}>
                        <td>{formatDateTime(l.created_at)}</td><td>{l.channel}</td><td>{l.template_name || '-'}</td><td>{l.status}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {tab === 'documents' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['Müşteri bilgi formu', 'Satış geçmişi dökümü', 'Reçete özeti', 'Cari hesap dökümü', 'Teslim belgesi'] as const).map((doc) => (
                  <button key={doc} type="button" className="btn btn-sm" style={{ textAlign: 'left' }} onClick={() => handlePrintDoc(doc)}>
                    {doc} — Yazdır
                  </button>
                ))}
              </div>
            )}

            {tab === 'notes' && (
              <div>
                <p><strong>Genel Notlar:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>{customer.notes || '-'}</p>
                <p style={{ marginTop: 12 }}><strong>Önemli Not:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{customer.important_note || '-'}</p>
                <p style={{ marginTop: 12 }}><strong>Risk Notu:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{customer.risk_note || '-'}</p>
              </div>
            )}
          </div>

          <div className="product-form-footer">
            {canEdit && <button type="button" className="btn btn-primary" onClick={onEdit}>Düzenle</button>}
            <button type="button" className="btn" onClick={onClose}>Kapat</button>
          </div>
        </div>
      </div>

      {commModal && (
        <CommunicationPrepModal
          customerId={customerId}
          channel={commModal.channel}
          defaultTemplateName={commModal.template}
          onClose={() => setCommModal(null)}
          onLogged={reload}
        />
      )}
    </>
  );
}
