import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import type { Customer, Prescription, PrescriptionInput } from '@/types/electron';
import { PRESCRIPTION_STATUSES, USAGE_TYPES, PRESCRIPTION_TYPES, MEDULA_STATUSES } from '@/types/electron';
import TransposeTool from '@/components/products/TransposeTool';
import '@/components/products/ProductForm.css';

const emptyForm = (customerId = 0): PrescriptionInput => ({
  customer_id: customerId,
  e_prescription_no: '',
  prescription_date: new Date().toISOString().slice(0, 10),
  doctor: '',
  institution: '',
  right_sph: '',
  right_cyl: '',
  right_ax: '',
  left_sph: '',
  left_cyl: '',
  left_ax: '',
  add_value: '',
  pd: '',
  lens_type: '',
  usage_type: 'Uzak',
  notes: '',
  status: 'Aktif',
  prescription_type: 'Özel',
  e_report_no: '',
  provision_no: '',
  sgk_tracking_no: '',
  institution_code: '',
  doctor_registration_no: '',
  patient_tc: '',
  beneficiary_note: '',
  medula_status: 'Hazırlanmadı',
  medula_note: '',
  examination_date: '',
  rx_delivery_date: '',
  patient_card_no: '',
  doctor_branch: '',
  medula_approval_status: '',
});

interface PrescriptionFormProps {
  prescription?: Prescription | null;
  mode: 'create' | 'edit' | 'view';
  defaultCustomerId?: number;
  onSave: (input: PrescriptionInput) => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onCancel: () => void;
}

export default function PrescriptionForm({
  prescription,
  mode,
  defaultCustomerId,
  onSave,
  onDeactivate,
  onCancel,
}: PrescriptionFormProps) {
  const [form, setForm] = useState<PrescriptionInput>(emptyForm(defaultCustomerId));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [tab, setTab] = useState<'main' | 'medula'>('main');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = mode === 'view';

  useEffect(() => {
    ipc.customers.list({ status: 'Aktif' }).then(setCustomers).catch(console.error);
  }, []);

  useEffect(() => {
    if (prescription) {
      setForm({
        customer_id: prescription.customer_id,
        e_prescription_no: prescription.e_prescription_no || '',
        prescription_date: prescription.prescription_date || '',
        doctor: prescription.doctor || '',
        institution: prescription.institution || '',
        right_sph: prescription.right_sph || '',
        right_cyl: prescription.right_cyl || '',
        right_ax: prescription.right_ax || '',
        left_sph: prescription.left_sph || '',
        left_cyl: prescription.left_cyl || '',
        left_ax: prescription.left_ax || '',
        add_value: prescription.add_value || '',
        pd: prescription.pd || '',
        lens_type: prescription.lens_type || '',
        usage_type: (prescription.usage_type as PrescriptionInput['usage_type']) || 'Uzak',
        notes: prescription.notes || '',
        status: (prescription.status as PrescriptionInput['status']) || 'Aktif',
        prescription_type: prescription.prescription_type || 'Özel',
        e_report_no: prescription.e_report_no || '',
        provision_no: prescription.provision_no || '',
        sgk_tracking_no: prescription.sgk_tracking_no || '',
        institution_code: prescription.institution_code || '',
        doctor_registration_no: prescription.doctor_registration_no || '',
        patient_tc: prescription.patient_tc || '',
        beneficiary_note: prescription.beneficiary_note || '',
        medula_status: prescription.medula_status || 'Hazırlanmadı',
        medula_note: prescription.medula_note || '',
        examination_date: prescription.examination_date || '',
        rx_delivery_date: prescription.rx_delivery_date || '',
        patient_card_no: prescription.patient_card_no || '',
        doctor_branch: prescription.doctor_branch || '',
        medula_approval_status: prescription.medula_approval_status || '',
      });
    } else {
      setForm(emptyForm(defaultCustomerId));
    }
    setTab('main');
    setError('');
  }, [prescription, mode, defaultCustomerId]);

  const setField = <K extends keyof PrescriptionInput>(key: K, value: PrescriptionInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(
        (c) =>
          c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          (c.tc_no || '').includes(customerSearch) ||
          (c.phone || '').includes(customerSearch)
      )
    : customers;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'create' ? 'Yeni Reçete' : mode === 'edit' ? 'Reçete Düzenle' : 'Reçete Detayı';

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 760 }}>
        <div className="product-form-header">
          <span>{title}</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>
        {error && <div className="alert alert-error product-form-alert">{error}</div>}
        <div className="product-form-tabs">
          <button type="button" className={`tab-btn${tab === 'main' ? ' active' : ''}`} onClick={() => setTab('main')}>Reçete Bilgileri</button>
          <button type="button" className={`tab-btn${tab === 'medula' ? ' active' : ''}`} onClick={() => setTab('medula')}>Medula / SGK Bilgileri</button>
        </div>
        <div className="product-form-body">
          {tab === 'main' && (
          <>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Müşteri *</label>
              {mode === 'create' && (
                <input
                  className="form-input"
                  placeholder="Müşteri ara..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ marginBottom: 4 }}
                />
              )}
              <select
                className="form-select"
                value={form.customer_id || ''}
                onChange={(e) => setField('customer_id', Number(e.target.value))}
                disabled={readOnly || mode === 'edit'}
              >
                <option value="">Seçiniz</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>E-reçete No</label>
              <input className="form-input" value={form.e_prescription_no || ''} onChange={(e) => setField('e_prescription_no', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Reçete Tarihi</label>
              <input type="date" className="form-input" value={form.prescription_date || ''} onChange={(e) => setField('prescription_date', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Doktor</label>
              <input className="form-input" value={form.doctor || ''} onChange={(e) => setField('doctor', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Kurum</label>
              <input className="form-input" value={form.institution || ''} onChange={(e) => setField('institution', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Cam Tipi</label>
              <input className="form-input" value={form.lens_type || ''} onChange={(e) => setField('lens_type', e.target.value)} readOnly={readOnly} />
            </div>
            <div className="form-group">
              <label>Kullanım Tipi</label>
              <select className="form-select" value={form.usage_type || 'Uzak'} onChange={(e) => setField('usage_type', e.target.value as PrescriptionInput['usage_type'])} disabled={readOnly}>
                {USAGE_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Durum</label>
              <select className="form-select" value={form.status || 'Aktif'} onChange={(e) => setField('status', e.target.value as PrescriptionInput['status'])} disabled={readOnly}>
                {PRESCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="eye-section">
            <div className="eye-box">
              <div className="eye-box-title">Sağ Göz</div>
              <div className="form-row">
                <div className="form-group"><label>SPH</label><input className="form-input" value={form.right_sph || ''} onChange={(e) => setField('right_sph', e.target.value)} readOnly={readOnly} /></div>
                <div className="form-group"><label>CYL</label><input className="form-input" value={form.right_cyl || ''} onChange={(e) => setField('right_cyl', e.target.value)} readOnly={readOnly} /></div>
                <div className="form-group"><label>AX</label><input className="form-input" value={form.right_ax || ''} onChange={(e) => setField('right_ax', e.target.value)} readOnly={readOnly} /></div>
              </div>
            </div>
            {!readOnly && (
              <TransposeTool
                compact
                initial={{ sph: form.right_sph, cyl: form.right_cyl, axis: form.right_ax }}
                onApply={(r) => { setField('right_sph', r.sph); setField('right_cyl', r.cyl); setField('right_ax', r.axis); }}
              />
            )}
            <div className="eye-box">
              <div className="eye-box-title">Sol Göz</div>
              <div className="form-row">
                <div className="form-group"><label>SPH</label><input className="form-input" value={form.left_sph || ''} onChange={(e) => setField('left_sph', e.target.value)} readOnly={readOnly} /></div>
                <div className="form-group"><label>CYL</label><input className="form-input" value={form.left_cyl || ''} onChange={(e) => setField('left_cyl', e.target.value)} readOnly={readOnly} /></div>
                <div className="form-group"><label>AX</label><input className="form-input" value={form.left_ax || ''} onChange={(e) => setField('left_ax', e.target.value)} readOnly={readOnly} /></div>
              </div>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-group"><label>ADD</label><input className="form-input" value={form.add_value || ''} onChange={(e) => setField('add_value', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>PD</label><input className="form-input" value={form.pd || ''} onChange={(e) => setField('pd', e.target.value)} readOnly={readOnly} /></div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label>Not</label>
            <textarea className="form-textarea" value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} readOnly={readOnly} rows={3} />
          </div>
          </>
          )}

          {tab === 'medula' && (
            <>
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
              Bu alanlar Medula hazırlık ve takip içindir. Resmi işlemler ilgili sistemde yapılır.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Reçete Türü</label>
                <select className="form-select" value={form.prescription_type || 'Özel'} onChange={(e) => setField('prescription_type', e.target.value as PrescriptionInput['prescription_type'])} disabled={readOnly}>
                  {PRESCRIPTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>E-reçete No</label><input className="form-input" value={form.e_prescription_no || ''} onChange={(e) => setField('e_prescription_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>E-rapor No</label><input className="form-input" value={form.e_report_no || ''} onChange={(e) => setField('e_report_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Provizyon No</label><input className="form-input" value={form.provision_no || ''} onChange={(e) => setField('provision_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Medula Takip No</label><input className="form-input" value={form.sgk_tracking_no || ''} onChange={(e) => setField('sgk_tracking_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Kurum Kodu</label><input className="form-input" value={form.institution_code || ''} onChange={(e) => setField('institution_code', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Kurum Adı</label><input className="form-input" value={form.institution || ''} onChange={(e) => setField('institution', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Doktor Adı</label><input className="form-input" value={form.doctor || ''} onChange={(e) => setField('doctor', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Doktor Diploma / Tescil No</label><input className="form-input" value={form.doctor_registration_no || ''} onChange={(e) => setField('doctor_registration_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Branş</label><input className="form-input" value={form.doctor_branch || ''} onChange={(e) => setField('doctor_branch', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Hasta T.C.</label><input className="form-input" value={form.patient_tc || ''} onChange={(e) => setField('patient_tc', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Hasta Karne / Sicil No</label><input className="form-input" value={form.patient_card_no || ''} onChange={(e) => setField('patient_card_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Hak Sahibi Bilgisi</label><input className="form-input" value={form.beneficiary_note || ''} onChange={(e) => setField('beneficiary_note', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Muayene Tarihi</label><input type="date" className="form-input" value={form.examination_date || ''} onChange={(e) => setField('examination_date', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Teslim Tarihi</label><input type="date" className="form-input" value={form.rx_delivery_date || ''} onChange={(e) => setField('rx_delivery_date', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group">
                <label>Medula Durumu</label>
                <select className="form-select" value={form.medula_status || 'Hazırlanmadı'} onChange={(e) => setField('medula_status', e.target.value)} disabled={readOnly}>
                  {MEDULA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Onay Durumu</label><input className="form-input" value={form.medula_approval_status || ''} onChange={(e) => setField('medula_approval_status', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Medula Notu</label>
                <input className="form-input" value={form.medula_note || ''} onChange={(e) => setField('medula_note', e.target.value)} readOnly={readOnly} />
              </div>
            </div>
            </>
          )}
        </div>
        <div className="product-form-footer">
          {mode !== 'view' && (
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
          {mode === 'edit' && onDeactivate && prescription?.status === 'Aktif' && (
            <button type="button" className="btn btn-danger" onClick={onDeactivate} disabled={saving}>Pasife Al</button>
          )}
          <button type="button" className="btn" onClick={onCancel}>{mode === 'view' ? 'Kapat' : 'Vazgeç'}</button>
        </div>
      </div>
    </div>
  );
}
