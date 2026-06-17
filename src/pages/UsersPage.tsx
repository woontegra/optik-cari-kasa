import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { PERMISSION_LABELS, USER_ROLES, type Permission, type UserRole } from '@/types/auth';
import PageTitleBar from '@/components/layout/PageTitleBar';
import '@/components/products/ProductForm.css';

interface UserListItem {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  is_active: number;
  last_login_at: string | null;
}

interface UserFormState {
  full_name: string;
  username: string;
  password: string;
  role: UserRole;
  phone: string;
  email: string;
  is_active: boolean;
  permissions: Permission[];
}

const emptyForm = (): UserFormState => ({
  full_name: '',
  username: '',
  password: '',
  role: 'Satış Personeli',
  phone: '',
  email: '',
  is_active: true,
  permissions: [],
});

export default function UsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [resetPwd, setResetPwd] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    ipc.users.list().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setResetPwd('');
    setShowForm(true);
  };

  const openEdit = async (id: number) => {
    const u = await ipc.users.getById(id);
    if (!u) return;
    setEditId(id);
    setForm({
      full_name: u.full_name,
      username: u.username,
      password: '',
      role: u.role,
      phone: u.phone || '',
      email: u.email || '',
      is_active: u.is_active === 1,
      permissions: u.permissions || [],
    });
    setResetPwd('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    try {
      if (editId) {
        await ipc.users.update(editId, {
          full_name: form.full_name,
          username: form.username,
          role: form.role,
          phone: form.phone,
          email: form.email,
          is_active: form.is_active,
          permissions: form.permissions,
        });
        if (resetPwd) await ipc.users.resetPassword(editId, resetPwd);
        setToast('Kullanıcı güncellendi.');
      } else {
        await ipc.users.create({
          full_name: form.full_name,
          username: form.username,
          password: form.password,
          role: form.role,
          phone: form.phone,
          email: form.email,
          is_active: form.is_active,
          permissions: form.permissions,
        });
        setToast('Kullanıcı oluşturuldu.');
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deactivate = async (id: number) => {
    if (!confirm('Kullanıcı pasife alınsın mı?')) return;
    try {
      await ipc.users.deactivate(id);
      setToast('Kullanıcı pasife alındı.');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const togglePerm = (p: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  };

  if (loading && !users.length) return <div className="loading-text">Yükleniyor...</div>;

  return (
    <div className="page-content">
      <PageTitleBar title="Kullanıcılar">
        <button className="btn btn-primary" onClick={openCreate}>Yeni Kullanıcı</button>
      </PageTitleBar>
      {error && <div className="alert alert-error">{error}</div>}
      {toast && <div className="toast-success" onAnimationEnd={() => setToast('')}>{toast}</div>}

      <div className="panel" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Kullanıcı Adı</th>
                <th>Rol</th>
                <th>Telefon</th>
                <th>Durum</th>
                <th>Son Giriş</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>{u.phone || '-'}</td>
                  <td>{u.is_active ? 'Aktif' : 'Pasif'}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString('tr-TR') : '-'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(u.id)}>Düzenle</button>
                    {u.is_active === 1 && u.username !== 'admin' && (
                      <button className="btn btn-sm" onClick={() => deactivate(u.id)} style={{ marginLeft: 4 }}>Pasife Al</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="product-form-overlay">
          <div className="product-form-panel" style={{ width: 560 }}>
            <div className="product-form-header">
              <span>{editId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</span>
              <button type="button" className="btn-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="product-form-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Ad Soyad</label>
                  <input className="form-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Kullanıcı Adı</label>
                  <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                    {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {!editId && (
                  <div className="form-group">
                    <label>Şifre</label>
                    <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                )}
                {editId && (
                  <div className="form-group">
                    <label>Şifre Sıfırla</label>
                    <input className="form-input" type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="Boş bırakılabilir" />
                  </div>
                )}
                <div className="form-group">
                  <label>Telefon</label>
                  <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>E-posta</label>
                  <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Aktif
                </label>
              </div>
              {form.role !== 'Yönetici' && (
                <div style={{ marginTop: 12 }}>
                  <div className="panel-header" style={{ marginBottom: 6 }}>Ek Yetkiler (rol varsayılanına ek)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
                    {(Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => (
                      <label key={p}>
                        <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                        {' '}{PERMISSION_LABELS[p]}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="product-form-footer">
              <button className="btn btn-primary" onClick={save}>Kaydet</button>
              <button className="btn" onClick={() => setShowForm(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
