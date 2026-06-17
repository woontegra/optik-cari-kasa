import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatDate } from '@/utils/format';
import type { Prescription, PrescriptionInput } from '@/types/electron';
import { PRESCRIPTION_STATUSES } from '@/types/electron';
import PrescriptionForm from '@/components/prescriptions/PrescriptionForm';
import PrescriptionDetail from '@/components/prescriptions/PrescriptionDetail';
import PageTitleBar from '@/components/layout/PageTitleBar';
import '@/components/products/ProductForm.css';

type FormMode = 'create' | 'edit' | 'view' | null;

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function PrescriptionPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toast, setToast] = useState('');

  const loadPrescriptions = useCallback(() => {
    setLoading(true);
    ipc.prescriptions
      .list({
        search: search || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      .then(setPrescriptions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(loadPrescriptions, 200);
    return () => clearTimeout(timer);
  }, [loadPrescriptions]);

  const openCreate = () => {
    setSelectedPrescription(null);
    setFormMode('create');
    setShowDetail(false);
  };

  const openEdit = async () => {
    if (!selectedId) return;
    const p = await ipc.prescriptions.getById(selectedId);
    if (p) {
      setSelectedPrescription(p);
      setFormMode('edit');
      setShowDetail(false);
    }
  };

  const openDetail = async () => {
    if (!selectedId) return;
    const p = await ipc.prescriptions.getById(selectedId);
    if (p) {
      setSelectedPrescription(p);
      setShowDetail(true);
      setFormMode(null);
    }
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedPrescription(null);
  };

  const handleSave = async (input: PrescriptionInput) => {
    if (formMode === 'create') {
      const result = await ipc.prescriptions.create(input);
      setToast(`Reçete kaydedildi: ${result.prescription_no}`);
    } else if (formMode === 'edit' && selectedId) {
      await ipc.prescriptions.update(selectedId, input);
      setToast('Reçete başarıyla güncellendi.');
    }
    closeForm();
    loadPrescriptions();
  };

  const handleDeactivate = async () => {
    if (!selectedId) return;
    if (!confirm('Reçeteyi pasife almak istediğinize emin misiniz?')) return;
    try {
      await ipc.prescriptions.deactivate(selectedId);
      setToast('Reçete pasife alındı.');
      closeForm();
      setSelectedId(null);
      loadPrescriptions();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <PageTitleBar title="Reçete Kayıtları">
        <button className="btn btn-primary" onClick={openCreate}>Yeni Reçete</button>
      </PageTitleBar>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="toolbar">
          <button className="btn" disabled={!selectedId} onClick={openEdit}>Düzenle</button>
          <button className="btn" disabled={!selectedId} onClick={openDetail}>Detay</button>
          <button className="btn btn-danger" disabled={!selectedId} onClick={handleDeactivate}>Pasife Al</button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input search-input"
            placeholder="Ara: reçete no, müşteri, doktor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            {PRESCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Başlangıç tarihi" />
          <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Bitiş tarihi" />
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reçete No</th>
                  <th>Müşteri</th>
                  <th>Tarih</th>
                  <th>Doktor</th>
                  <th>Kurum</th>
                  <th>Sağ Göz</th>
                  <th>Sol Göz</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.length === 0 ? (
                  <tr><td colSpan={8} className="empty-text">Reçete kaydı bulunamadı</td></tr>
                ) : (
                  prescriptions.map((p) => (
                    <tr
                      key={p.id}
                      className={selectedId === p.id ? 'selected' : ''}
                      onClick={() => setSelectedId(p.id)}
                      onDoubleClick={() => { setSelectedId(p.id); openDetail(); }}
                    >
                      <td>{p.prescription_no || p.e_prescription_no || '-'}</td>
                      <td>{p.customer_name || '-'}</td>
                      <td>{formatDate(p.prescription_date)}</td>
                      <td>{p.doctor || '-'}</td>
                      <td>{p.institution || '-'}</td>
                      <td>{p.right_eye || '-'}</td>
                      <td>{p.left_eye || '-'}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {formMode && (
        <PrescriptionForm
          prescription={selectedPrescription}
          mode={formMode}
          onSave={handleSave}
          onDeactivate={formMode === 'edit' ? handleDeactivate : undefined}
          onCancel={closeForm}
        />
      )}

      {showDetail && selectedPrescription && (
        <PrescriptionDetail
          prescription={selectedPrescription}
          onClose={() => setShowDetail(false)}
          onEdit={() => { setShowDetail(false); openEdit(); }}
        />
      )}
    </div>
  );
}
