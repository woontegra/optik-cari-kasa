import { useState } from 'react';
import { getRememberedUsername, setRememberedUsername } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import '@/styles/login.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState(getRememberedUsername());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(!!getRememberedUsername());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setRememberedUsername(username.trim(), remember);
      await login(username.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <div className="login-title">Woontegra Optik Desktop</div>
          <div className="login-sub">Kullanıcı Girişi</div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Kullanıcı Adı</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Şifre</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <label className="checkbox-label login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Beni hatırla
          </label>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
        <div className="login-hint">Varsayılan: admin / admin123</div>
      </div>
    </div>
  );
}
