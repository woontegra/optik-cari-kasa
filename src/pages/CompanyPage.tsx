import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';

interface CompanyForm {
  name: string;
  authorized_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  tax_office: string;
  tax_number: string;
  logo_path: string;
  receipt_footer_note: string;
  support_phone: string;
  support_email: string;
  website: string;
}

const empty: CompanyForm = {
  name: '',
  authorized_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  district: '',
  tax_office: '',
  tax_number: '',
  logo_path: '',
  receipt_footer_note: '',
  support_phone: '',
  support_email: '',
  website: '',
};

export default function CompanyPage() {
  const [form, setForm] = useState<CompanyForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    ipc.settings
      .getCompany()
      .then((data) => {
        if (data) setForm({ ...empty, ...(data as CompanyForm) });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof CompanyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectLogo = async () => {
    try {
      const res = await ipc.settings.selectLogo();
      if (res.path) handleChange('logo_path', res.path);
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await ipc.settings.updateCompany(form as Record<string, unknown>);
      setMessage('Firma bilgileri kaydedildi.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-text">Yükleniyor...</div>;

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Firma Ayarları</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>

      {message && (
        <div className={`alert ${message.includes('kaydedildi') ? 'alert-success' : 'alert-error'}`}>{message}</div>
      )}

      <div className="panel">
        <div className="panel-header">Firma Bilgileri</div>
        <div className="panel-body">
          <div className="form-row">
            <div className="form-group">
              <label>Firma Adı</label>
              <input className="form-input" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Yetkili Kişi</label>
              <input className="form-input" value={form.authorized_person} onChange={(e) => handleChange('authorized_person', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input className="form-input" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>E-posta</label>
              <input className="form-input" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>İl</label>
              <input className="form-input" value={form.city} onChange={(e) => handleChange('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label>İlçe</label>
              <input className="form-input" value={form.district} onChange={(e) => handleChange('district', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vergi No / T.C.</label>
              <input className="form-input" value={form.tax_number} onChange={(e) => handleChange('tax_number', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Vergi Dairesi</label>
              <input className="form-input" value={form.tax_office} onChange={(e) => handleChange('tax_office', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Destek Telefonu</label>
              <input className="form-input" value={form.support_phone} onChange={(e) => handleChange('support_phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Destek E-postası</label>
              <input className="form-input" value={form.support_email} onChange={(e) => handleChange('support_email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Web Sitesi</label>
              <input className="form-input" value={form.website} onChange={(e) => handleChange('website', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Adres</label>
            <textarea className="form-textarea" value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Fiş / Makbuz Alt Notu</label>
            <textarea className="form-textarea" value={form.receipt_footer_note} onChange={(e) => handleChange('receipt_footer_note', e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label>Logo Dosyası</label>
              <input className="form-input" value={form.logo_path} readOnly />
            </div>
            <button type="button" className="btn" onClick={selectLogo}>
              Logo Seç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
