import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Customer, CustomerInput } from '@/types/electron';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerDetail from '@/components/customers/CustomerDetail';
import '@/components/products/ProductForm.css';

type FormMode = 'create' | 'edit' | 'view' | null;

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState('');

  const loadCustomers = useCallback(() => {
    setLoading(true);
    ipc.customers
      .list({ search: search || undefined, status: statusFilter || undefined })
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 200);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  const openCreate = () => {
    setSelectedCustomer(null);
    setFormMode('create');
    setShowDetail(false);
  };

  const openEdit = async () => {
    if (!selectedId) return;
    const c = await ipc.customers.getById(selectedId);
    if (c) {
      setSelectedCustomer(c);
      setFormMode('edit');
      setShowDetail(false);
    }
  };

  const openDetail = () => {
    if (!selectedId) return;
    setShowDetail(true);
    setFormMode(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedCustomer(null);
  };

  const handleSave = async (input: CustomerInput) => {
    if (formMode === 'create') {
      await ipc.customers.create(input);
      setToast('Müşteri başarıyla eklendi.');
    } else if (formMode === 'edit' && selectedId) {
      await ipc.customers.update(selectedId, input);
      setToast('Müşteri başarıyla güncellendi.');
    }
    closeForm();
    loadCustomers();
  };

  const handleDeactivate = async () => {
    if (!selectedId) return;
    if (!confirm('Müşteriyi pasife almak istediğinize emin misiniz?')) return;
    try {
      await ipc.customers.deactivate(selectedId);
      setToast('Müşteri pasife alındı.');
      closeForm();
      setSelectedId(null);
      loadCustomers();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Müşteri / Hasta Kartları</h2>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={openCreate}>Yeni Müşteri</button>
          <button className="btn" disabled={!selectedId} onClick={openEdit}>Düzenle</button>
          <button className="btn" disabled={!selectedId} onClick={openDetail}>Detay</button>
          <button className="btn btn-danger" disabled={!selectedId} onClick={handleDeactivate}>Pasife Al</button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input search-input"
            placeholder="Ara: ad, T.C., telefon, e-posta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="Aktif">Aktif</option>
            <option value="Pasif">Pasif</option>
          </select>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>T.C. Kimlik No</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th className="text-right">Cari Bakiye</th>
                  <th>Son Satış Tarihi</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={7} className="empty-text">Müşteri bulunamadı</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className={selectedId === c.id ? 'selected' : ''}
                      onClick={() => setSelectedId(c.id)}
                      onDoubleClick={() => { setSelectedId(c.id); setShowDetail(true); }}
                    >
                      <td>{c.full_name}</td>
                      <td>{c.tc_no || '-'}</td>
                      <td>{c.phone || '-'}</td>
                      <td>{c.email || '-'}</td>
                      <td className="text-right">{formatCurrency(c.balance)}</td>
                      <td>{formatDate(c.last_sale_date)}</td>
                      <td>{c.status || 'Aktif'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {formMode && (
        <CustomerForm
          customer={selectedCustomer}
          mode={formMode}
          onSave={handleSave}
          onDeactivate={formMode === 'edit' ? handleDeactivate : undefined}
          onCancel={closeForm}
        />
      )}

      {showDetail && selectedId && (
        <CustomerDetail
          customerId={selectedId}
          onClose={() => setShowDetail(false)}
          onEdit={() => { setShowDetail(false); openEdit(); }}
        />
      )}
    </div>
  );
}
