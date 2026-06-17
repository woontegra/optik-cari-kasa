import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDate } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import type { Customer, CustomerInput, CustomerListFilters } from '@/types/electron';
import type { CustomerCategory } from '@/types/customerTracking';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerDetail from '@/components/customers/CustomerDetail';
import CommunicationPrepModal from '@/components/customers/CommunicationPrepModal';
import PageTitleBar from '@/components/layout/PageTitleBar';

type FormMode = 'create' | 'edit' | 'view' | null;

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function CustomerPage() {
  const { hasPermission, session } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.CUSTOMERS_EDIT);
  const canComm = hasPermission(PERMISSIONS.COMMUNICATIONS_EDIT);
  const canExport = hasPermission(PERMISSIONS.EXCEL_EXPORT);
  const canDeactivate = canEdit && session?.role !== 'Satış Personeli';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [birthdayMonth, setBirthdayMonth] = useState(false);
  const [upcomingControl, setUpcomingControl] = useState(false);
  const [lensRenewal, setLensRenewal] = useState(false);
  const [hasDebt, setHasDebt] = useState(false);
  const [inactive6m, setInactive6m] = useState(false);
  const [marketingPerm, setMarketingPerm] = useState(false);
  const [whatsappPerm, setWhatsappPerm] = useState(false);
  const [smsPerm, setSmsPerm] = useState(false);
  const [emailPerm, setEmailPerm] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL' | null>(null);
  const [toast, setToast] = useState('');

  const buildFilters = useCallback((): CustomerListFilters => ({
    search: search || undefined,
    status: statusFilter || undefined,
    customer_category: categoryFilter || undefined,
    birthday_this_month: birthdayMonth || undefined,
    upcoming_control: upcomingControl || undefined,
    lens_renewal_soon: lensRenewal || undefined,
    has_debt: hasDebt || undefined,
    inactive_6_months: inactive6m || undefined,
    marketing_permission: marketingPerm || undefined,
    whatsapp_permission: whatsappPerm || undefined,
    sms_permission: smsPerm || undefined,
    email_permission: emailPerm || undefined,
  }), [search, statusFilter, categoryFilter, birthdayMonth, upcomingControl, lensRenewal, hasDebt, inactive6m, marketingPerm, whatsappPerm, smsPerm, emailPerm]);

  const loadCustomers = useCallback(() => {
    setLoading(true);
    ipc.customers.list(buildFilters())
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [buildFilters]);

  useEffect(() => {
    ipc.customers.listCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 200);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  const openCreate = () => {
    if (!canEdit) return;
    setSelectedCustomer(null);
    setFormMode('create');
    setShowDetail(false);
  };

  const openEdit = async () => {
    if (!canEdit || !selectedId) return;
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
    if (!selectedId || !canDeactivate) return;
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

  const handleExport = async () => {
    const res = await ipc.customers.exportReminderList(buildFilters());
    if (res.exported) setToast(`Liste kaydedildi: ${res.filePath}`);
  };

  const prepareBulkList = () => {
    if (customers.length === 0) return alert('Listede müşteri yok.');
    setShowBulkPanel(true);
  };

  const copyBulkMessages = async (channel: 'WHATSAPP' | 'SMS' | 'EMAIL') => {
    const lines: string[] = [];
    for (const c of customers) {
      try {
        const msg = await ipc.communications.prepareMessage({ customer_id: c.id, channel });
        lines.push(`${c.full_name} | ${c.phone || '-'} | ${msg.body}`);
        await ipc.communications.log({ customer_id: c.id, channel, message: msg.body, status: 'Hazırlandı' });
      } catch {
        lines.push(`${c.full_name} | HATA`);
      }
    }
    await navigator.clipboard.writeText(lines.join('\n\n'));
    setToast(`${customers.length} müşteri için ${channel} metin listesi panoya kopyalandı.`);
    setShowBulkPanel(false);
  };

  return (
    <div className="page-content">
      <PageTitleBar title="Müşteri / Hasta Kartları" />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="toolbar">
          {canEdit && <button className="btn btn-primary" onClick={openCreate}>Yeni Müşteri</button>}
          <button className="btn" disabled={!selectedId || !canEdit} onClick={openEdit}>Düzenle</button>
          <button className="btn" disabled={!selectedId} onClick={openDetail}>Detay</button>
          {canDeactivate && <button className="btn btn-danger" disabled={!selectedId} onClick={handleDeactivate}>Pasife Al</button>}
          {canExport && <button className="btn" onClick={handleExport}>Excel&apos;e Aktar</button>}
          {canComm && <button className="btn" onClick={prepareBulkList}>Toplu Mesaj Listesi</button>}
        </div>

        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <input className="form-input search-input" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="Aktif">Aktif</option>
            <option value="Pasif">Pasif</option>
          </select>
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Tüm Kategoriler</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <label className="checkbox-label"><input type="checkbox" checked={birthdayMonth} onChange={(e) => setBirthdayMonth(e.target.checked)} /> Doğum günü bu ay</label>
          <label className="checkbox-label"><input type="checkbox" checked={upcomingControl} onChange={(e) => setUpcomingControl(e.target.checked)} /> Yaklaşan kontrol</label>
          <label className="checkbox-label"><input type="checkbox" checked={lensRenewal} onChange={(e) => setLensRenewal(e.target.checked)} /> Lens yenileme</label>
          <label className="checkbox-label"><input type="checkbox" checked={hasDebt} onChange={(e) => setHasDebt(e.target.checked)} /> Borçlu</label>
          <label className="checkbox-label"><input type="checkbox" checked={inactive6m} onChange={(e) => setInactive6m(e.target.checked)} /> 6 ay alışveriş yok</label>
          <label className="checkbox-label"><input type="checkbox" checked={smsPerm} onChange={(e) => setSmsPerm(e.target.checked)} /> SMS izni</label>
          <label className="checkbox-label"><input type="checkbox" checked={emailPerm} onChange={(e) => setEmailPerm(e.target.checked)} /> E-posta izni</label>
          <label className="checkbox-label"><input type="checkbox" checked={whatsappPerm} onChange={(e) => setWhatsappPerm(e.target.checked)} /> WhatsApp izni</label>
          <label className="checkbox-label"><input type="checkbox" checked={marketingPerm} onChange={(e) => setMarketingPerm(e.target.checked)} /> Kampanya izni</label>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Kategori</th>
                  <th>Telefon</th>
                  <th className="text-right">Cari Bakiye</th>
                  <th>Son Satış</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={6} className="empty-text">Müşteri bulunamadı</td></tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className={selectedId === c.id ? 'selected' : ''}
                      onClick={() => setSelectedId(c.id)}
                      onDoubleClick={() => { setSelectedId(c.id); setShowDetail(true); }}
                    >
                      <td>{c.full_name}{c.is_vip ? ' ★' : ''}</td>
                      <td>{c.customer_category || '-'}</td>
                      <td>{c.phone || '-'}</td>
                      <td className={`text-right${c.balance > 0 ? ' amount-negative' : ''}`}>{formatCurrency(c.balance)}</td>
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
          onDeactivate={canDeactivate && formMode === 'edit' ? handleDeactivate : undefined}
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

      {showBulkPanel && (
        <div className="product-form-overlay">
          <div className="product-form-panel" style={{ width: 420 }}>
            <div className="product-form-header">
              <span>Toplu Mesaj Listesi ({customers.length} müşteri)</span>
              <button type="button" className="btn-close" onClick={() => setShowBulkPanel(false)}>×</button>
            </div>
            <div className="product-form-body">
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Mesajlar manuel gönderim için hazırlanır ve panoya kopyalanır.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => copyBulkMessages('WHATSAPP')}>WhatsApp listesi hazırla</button>
                <button type="button" className="btn" onClick={() => copyBulkMessages('SMS')}>SMS metin listesi hazırla</button>
                <button type="button" className="btn" onClick={() => copyBulkMessages('EMAIL')}>E-posta listesi hazırla</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkChannel && selectedId && (
        <CommunicationPrepModal customerId={selectedId} channel={bulkChannel} onClose={() => setBulkChannel(null)} />
      )}
    </div>
  );
}
