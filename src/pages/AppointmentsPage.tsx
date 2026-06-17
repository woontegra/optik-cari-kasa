import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatDate } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import type { Appointment, AppointmentListFilters } from '@/types/customerTracking';
import CommunicationPrepModal from '@/components/customers/CommunicationPrepModal';

type ViewFilter = AppointmentListFilters['view'];

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.APPOINTMENTS_EDIT);
  const canComm = hasPermission(PERMISSIONS.COMMUNICATIONS_EDIT);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<ViewFilter>('today');
  const [loading, setLoading] = useState(true);
  const [commCustomerId, setCommCustomerId] = useState<number | null>(null);
  const [commApptId, setCommApptId] = useState<number | undefined>();

  const load = useCallback(() => {
    setLoading(true);
    ipc.appointments.list({ view })
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    await ipc.appointments.updateStatus(id, status);
    load();
  };

  const views: { id: ViewFilter; label: string }[] = [
    { id: 'today', label: 'Bugün' },
    { id: 'week', label: 'Bu Hafta' },
    { id: 'overdue', label: 'Gecikenler' },
    { id: 'all', label: 'Tüm Randevular' },
  ];

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Randevular</h2>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="filter-bar">
          {views.map((v) => (
            <button key={v.id} type="button" className={`btn btn-sm${view === v.id ? ' btn-primary' : ''}`} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
          <button type="button" className="btn btn-sm" onClick={load}>Yenile</button>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Müşteri</th>
                  <th>Telefon</th>
                  <th>Tür</th>
                  <th>Durum</th>
                  <th>Not</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr><td colSpan={8} className="empty-text">Randevu bulunamadı</td></tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.appointment_date)}</td>
                      <td>{a.appointment_time || '-'}</td>
                      <td>{a.customer_name}</td>
                      <td>{a.customer_phone || '-'}</td>
                      <td>{a.appointment_type}</td>
                      <td>{a.status}</td>
                      <td>{a.notes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {canEdit && a.status === 'Planlandı' && (
                            <>
                              <button type="button" className="btn btn-sm" onClick={() => updateStatus(a.id, 'Geldi')}>Geldi</button>
                              <button type="button" className="btn btn-sm" onClick={() => updateStatus(a.id, 'Gelmedi')}>Gelmedi</button>
                              <button type="button" className="btn btn-sm" onClick={() => updateStatus(a.id, 'Ertelendi')}>Ertele</button>
                              <button type="button" className="btn btn-sm" onClick={() => ipc.appointments.cancel(a.id).then(load)}>İptal</button>
                            </>
                          )}
                          <button type="button" className="btn btn-sm" onClick={() => navigate('/musteri')}>Müşteri</button>
                          {canComm && (
                            <button type="button" className="btn btn-sm" onClick={() => { setCommCustomerId(a.customer_id); setCommApptId(a.id); }}>
                              WhatsApp
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {commCustomerId && (
        <CommunicationPrepModal
          customerId={commCustomerId}
          channel="WHATSAPP"
          defaultTemplateName="Randevu hatırlatma"
          appointmentId={commApptId}
          onClose={() => { setCommCustomerId(null); setCommApptId(undefined); }}
        />
      )}
    </div>
  );
}
