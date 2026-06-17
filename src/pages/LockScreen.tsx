import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import '@/styles/login.css';

export default function LockScreen() {
  const { session, unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await unlock(password);
      setPassword('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lock-overlay">
      <div className="login-panel lock-panel">
        <div className="login-brand">
          <div className="login-title">Oturum Kilitlendi</div>
          <div className="login-sub">{session?.fullName || session?.username}</div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Şifre</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Kontrol ediliyor...' : 'Kilidi Aç'}
          </button>
        </form>
      </div>
    </div>
  );
}
