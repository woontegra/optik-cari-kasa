import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import type { Customer, CustomerInput } from '@/types/electron';
import type { CustomerCategory } from '@/types/customerTracking';
import '@/components/products/ProductForm.css';

type FormTab = 'general' | 'contact' | 'institution' | 'invoice' | 'permissions' | 'notes' | 'categories';

const emptyForm = (): CustomerInput => ({
  full_name: '',
  tc_no: '',
  phone: '',
  email: '',
  birth_date: '',
  address: '',
  city: '',
  district: '',
  notes: '',
  kvkk_consent: false,
  sms_permission: false,
  email_permission: false,
  is_active: true,
  customer_category: '',
  second_phone: '',
  whatsapp_phone: '',
  institution_name: '',
  institution_no: '',
  occupation: '',
  reference_source: '',
  referred_by_customer_id: null,
  last_visit_date: '',
  next_control_date: '',
  whatsapp_permission: false,
  marketing_permission: false,
  important_note: '',
  risk_note: '',
  is_vip: false,
  invoice_title: '',
  tax_office: '',
  tax_no: '',
  invoice_address: '',
  invoice_city: '',
  invoice_district: '',
  is_einvoice_registered: false,
  invoice_party_type: 'Bireysel',
});

interface CustomerFormProps {
  customer?: Customer | null;
  mode: 'create' | 'edit' | 'view';
  onSave: (input: CustomerInput) => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onCancel: () => void;
}

export default function CustomerForm({ customer, mode, onSave, onDeactivate, onCancel }: CustomerFormProps) {
  const [form, setForm] = useState<CustomerInput>(emptyForm());
  const [tab, setTab] = useState<FormTab>('general');
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = mode === 'view';

  useEffect(() => {
    ipc.customers.listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name,
        tc_no: customer.tc_no || '',
        phone: customer.phone || '',
        email: customer.email || '',
        birth_date: customer.birth_date || '',
        address: customer.address || '',
        city: customer.city || '',
        district: customer.district || '',
        notes: customer.notes || '',
        kvkk_consent: !!customer.kvkk_consent,
        sms_permission: !!customer.sms_permission,
        email_permission: !!customer.email_permission,
        is_active: customer.status !== 'Pasif' && customer.is_active !== 0,
        customer_category: customer.customer_category || '',
        second_phone: customer.second_phone || '',
        whatsapp_phone: customer.whatsapp_phone || '',
        institution_name: customer.institution_name || '',
        institution_no: customer.institution_no || '',
        occupation: customer.occupation || '',
        reference_source: customer.reference_source || '',
        referred_by_customer_id: customer.referred_by_customer_id || null,
        last_visit_date: customer.last_visit_date || '',
        next_control_date: customer.next_control_date || '',
        whatsapp_permission: !!customer.whatsapp_permission,
        marketing_permission: !!customer.marketing_permission,
        important_note: customer.important_note || '',
        risk_note: customer.risk_note || '',
        is_vip: !!customer.is_vip,
        invoice_title: customer.invoice_title || '',
        tax_office: customer.tax_office || '',
        tax_no: customer.tax_no || '',
        invoice_address: customer.invoice_address || '',
        invoice_city: customer.invoice_city || '',
        invoice_district: customer.invoice_district || '',
        is_einvoice_registered: !!customer.is_einvoice_registered,
        invoice_party_type: customer.invoice_party_type || 'Bireysel',
      });
    } else {
      setForm(emptyForm());
    }
    setError('');
  }, [customer, mode]);

  const setField = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: FormTab; label: string }[] = [
    { id: 'general', label: 'Genel Bilgiler' },
    { id: 'contact', label: 'İletişim' },
    { id: 'institution', label: 'Kurum / Referans' },
    { id: 'invoice', label: 'Fatura Bilgileri' },
    { id: 'permissions', label: 'İzinler' },
    { id: 'notes', label: 'Notlar' },
    { id: 'categories', label: 'Kategoriler' },
  ];

  const title = mode === 'create' ? 'Yeni Müşteri' : mode === 'edit' ? 'Müşteri Düzenle' : 'Müşteri Detayı';

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 700, maxHeight: '90vh' }}>
        <div className="product-form-header">
          <span>{title}</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>
        {error && <div className="alert alert-error product-form-alert">{error}</div>}
        <div className="product-form-tabs">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="product-form-body">
          {tab === 'general' && (
            <div className="form-row">
              <div className="form-group">
                <label>Ad Soyad *</label>
                <input className="form-input" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>T.C. Kimlik No</label>
                <input className="form-input" value={form.tc_no || ''} onChange={(e) => setField('tc_no', e.target.value)} readOnly={readOnly} maxLength={11} />
              </div>
              <div className="form-group">
                <label>Doğum Tarihi</label>
                <input type="date" className="form-input" value={form.birth_date || ''} onChange={(e) => setField('birth_date', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Meslek</label>
                <input className="form-input" value={form.occupation || ''} onChange={(e) => setField('occupation', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Son Ziyaret</label>
                <input type="date" className="form-input" value={form.last_visit_date || ''} onChange={(e) => setField('last_visit_date', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Sonraki Kontrol</label>
                <input type="date" className="form-input" value={form.next_control_date || ''} onChange={(e) => setField('next_control_date', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Durum</label>
                <select className="form-select" value={form.is_active !== false ? 'Aktif' : 'Pasif'} onChange={(e) => setField('is_active', e.target.value === 'Aktif')} disabled={readOnly}>
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
              <label className="checkbox-label" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={!!form.is_vip} onChange={(e) => setField('is_vip', e.target.checked)} disabled={readOnly} />
                VIP Müşteri
              </label>
            </div>
          )}

          {tab === 'contact' && (
            <div className="form-row">
              <div className="form-group">
                <label>Telefon</label>
                <input className="form-input" value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>İkinci Telefon</label>
                <input className="form-input" value={form.second_phone || ''} onChange={(e) => setField('second_phone', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>WhatsApp</label>
                <input className="form-input" value={form.whatsapp_phone || ''} onChange={(e) => setField('whatsapp_phone', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>E-posta</label>
                <input className="form-input" value={form.email || ''} onChange={(e) => setField('email', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>İl</label>
                <input className="form-input" value={form.city || ''} onChange={(e) => setField('city', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>İlçe</label>
                <input className="form-input" value={form.district || ''} onChange={(e) => setField('district', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Adres</label>
                <textarea className="form-textarea" value={form.address || ''} onChange={(e) => setField('address', e.target.value)} readOnly={readOnly} rows={2} />
              </div>
            </div>
          )}

          {tab === 'institution' && (
            <div className="form-row">
              <div className="form-group">
                <label>Kurum Adı</label>
                <input className="form-input" value={form.institution_name || ''} onChange={(e) => setField('institution_name', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Kurum No</label>
                <input className="form-input" value={form.institution_no || ''} onChange={(e) => setField('institution_no', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Referans Kaynağı</label>
                <input className="form-input" value={form.reference_source || ''} onChange={(e) => setField('reference_source', e.target.value)} readOnly={readOnly} placeholder="Tavsiye, reklam, sosyal medya..." />
              </div>
              <div className="form-group">
                <label>Tavsiye Eden Müşteri ID</label>
                <input type="number" className="form-input" value={form.referred_by_customer_id || ''} onChange={(e) => setField('referred_by_customer_id', e.target.value ? Number(e.target.value) : null)} readOnly={readOnly} />
              </div>
            </div>
          )}

          {tab === 'invoice' && (
            <div className="form-row">
              <div className="form-group">
                <label>Fatura Unvanı</label>
                <input className="form-input" value={form.invoice_title || ''} onChange={(e) => setField('invoice_title', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Fatura Tipi</label>
                <select className="form-select" value={form.invoice_party_type || 'Bireysel'} onChange={(e) => setField('invoice_party_type', e.target.value)} disabled={readOnly}>
                  <option value="Bireysel">Bireysel</option>
                  <option value="Kurumsal">Kurumsal</option>
                </select>
              </div>
              <div className="form-group">
                <label>VKN / TCKN</label>
                <input className="form-input" value={form.tax_no || ''} onChange={(e) => setField('tax_no', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Vergi Dairesi</label>
                <input className="form-input" value={form.tax_office || ''} onChange={(e) => setField('tax_office', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Fatura Adresi</label>
                <input className="form-input" value={form.invoice_address || ''} onChange={(e) => setField('invoice_address', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>İl</label>
                <input className="form-input" value={form.invoice_city || ''} onChange={(e) => setField('invoice_city', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>İlçe</label>
                <input className="form-input" value={form.invoice_district || ''} onChange={(e) => setField('invoice_district', e.target.value)} readOnly={readOnly} />
              </div>
              <label className="checkbox-label" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={!!form.is_einvoice_registered} onChange={(e) => setField('is_einvoice_registered', e.target.checked)} disabled={readOnly} />
                E-fatura mükellefi
              </label>
            </div>
          )}

          {tab === 'permissions' && (
            <div className="form-row" style={{ flexDirection: 'column', gap: 8 }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.kvkk_consent} onChange={(e) => setField('kvkk_consent', e.target.checked)} disabled={readOnly} />
                KVKK Onayı
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.sms_permission} onChange={(e) => setField('sms_permission', e.target.checked)} disabled={readOnly} />
                SMS İzni
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.email_permission} onChange={(e) => setField('email_permission', e.target.checked)} disabled={readOnly} />
                E-posta İzni
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.whatsapp_permission} onChange={(e) => setField('whatsapp_permission', e.target.checked)} disabled={readOnly} />
                WhatsApp İzni
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={!!form.marketing_permission} onChange={(e) => setField('marketing_permission', e.target.checked)} disabled={readOnly} />
                Kampanya / Pazarlama İzni
              </label>
            </div>
          )}

          {tab === 'notes' && (
            <>
              <div className="form-group">
                <label>Genel Notlar</label>
                <textarea className="form-textarea" value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} readOnly={readOnly} rows={3} />
              </div>
              <div className="form-group">
                <label>Önemli Not</label>
                <textarea className="form-textarea" value={form.important_note || ''} onChange={(e) => setField('important_note', e.target.value)} readOnly={readOnly} rows={2} />
              </div>
              <div className="form-group">
                <label>Risk Notu</label>
                <textarea className="form-textarea" value={form.risk_note || ''} onChange={(e) => setField('risk_note', e.target.value)} readOnly={readOnly} rows={2} />
              </div>
            </>
          )}

          {tab === 'categories' && (
            <div className="form-group">
              <label>Müşteri Kategorisi</label>
              <select className="form-select" value={form.customer_category || ''} onChange={(e) => setField('customer_category', e.target.value)} disabled={readOnly}>
                <option value="">Seçiniz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <p className="form-hint" style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Kategori listesi optik tanımlardan yönetilir (CUSTOMER_CATEGORY).
              </p>
            </div>
          )}
        </div>
        <div className="product-form-footer">
          {mode !== 'view' && (
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
          {mode === 'edit' && onDeactivate && customer?.status === 'Aktif' && (
            <button type="button" className="btn btn-danger" onClick={onDeactivate} disabled={saving}>Pasife Al</button>
          )}
          <button type="button" className="btn" onClick={onCancel}>{mode === 'view' ? 'Kapat' : 'Vazgeç'}</button>
        </div>
      </div>
    </div>
  );
}
