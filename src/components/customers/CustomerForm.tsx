import { useEffect, useState } from 'react';
import type { Customer, CustomerInput } from '@/types/electron';
import '@/components/products/ProductForm.css';

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = mode === 'view';

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

  const title = mode === 'create' ? 'Yeni Müşteri' : mode === 'edit' ? 'Müşteri Düzenle' : 'Müşteri Detayı';

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 640 }}>
        <div className="product-form-header">
          <span>{title}</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>
        {error && <div className="alert alert-error product-form-alert">{error}</div>}
        <div className="product-form-body">
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
              <label>Telefon</label>
              <input className="form-input" value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>E-posta</label>
              <input className="form-input" value={form.email || ''} onChange={(e) => setField('email', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Doğum Tarihi</label>
              <input type="date" className="form-input" value={form.birth_date || ''} onChange={(e) => setField('birth_date', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Durum</label>
              <select className="form-select" value={form.is_active !== false ? 'Aktif' : 'Pasif'} onChange={(e) => setField('is_active', e.target.value === 'Aktif')} disabled={readOnly}>
                <option value="Aktif">Aktif</option>
                <option value="Pasif">Pasif</option>
              </select>
            </div>
            <div className="form-group">
              <label>İl</label>
              <input className="form-input" value={form.city || ''} onChange={(e) => setField('city', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>İlçe</label>
              <input className="form-input" value={form.district || ''} onChange={(e) => setField('district', e.target.value)} readOnly={readOnly} />
            </div>
          </div>
          <div className="form-group">
            <label>Adres</label>
            <textarea className="form-textarea" value={form.address || ''} onChange={(e) => setField('address', e.target.value)} readOnly={readOnly} rows={2} />
          </div>
          <div className="form-row" style={{ marginTop: 8 }}>
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
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Notlar</label>
            <textarea className="form-textarea" value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} readOnly={readOnly} rows={3} />
          </div>
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
