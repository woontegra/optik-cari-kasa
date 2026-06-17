import { useState } from 'react';
import '@/components/products/ProductForm.css';

interface QuickCustomerFormProps {
  onSave: (data: { full_name: string; phone: string }) => Promise<void>;
  onCancel: () => void;
}

export default function QuickCustomerForm({ onSave, onCancel }: QuickCustomerFormProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Ad soyad zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ full_name: fullName.trim(), phone: phone.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 400 }}>
        <div className="product-form-header">
          <span>Hızlı Müşteri Ekle</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>
        {error && <div className="alert alert-error product-form-alert">{error}</div>}
        <div className="product-form-body">
          <div className="form-group">
            <label>Ad Soyad *</label>
            <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Telefon</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="product-form-footer">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
