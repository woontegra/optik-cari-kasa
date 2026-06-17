import { useState } from 'react';
import { ipc } from '@/services/ipc';
import { useAuth } from '@/context/AuthContext';
import '@/components/products/ProductForm.css';

export default function ChangePasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const { refreshSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (next.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (next !== confirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      await ipc.auth.changePassword({ currentPassword: current, newPassword: next });
      await refreshSession();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 400 }}>
        <div className="product-form-header">
          <span>Şifre Değiştir</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="product-form-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Mevcut Şifre</label>
            <input className="form-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Yeni Şifre</label>
            <input className="form-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Yeni Şifre (Tekrar)</label>
            <input className="form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <div className="product-form-footer">
          <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          <button className="btn" onClick={onClose}>İptal</button>
        </div>
      </div>
    </div>
  );
}
