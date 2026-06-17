import { useState } from 'react';
import { ipc } from '@/services/ipc';
import '@/components/products/ProductForm.css';

interface Props {
  saleId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function MedulaInfoModal({ saleId, onClose, onSaved }: Props) {
  const [provisionNo, setProvisionNo] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [institutionAmount, setInstitutionAmount] = useState('');
  const [patientAmount, setPatientAmount] = useState('');
  const [contribution, setContribution] = useState('');
  const [diffFee, setDiffFee] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await ipc.medula.enterMedulaInfo({
        sale_id: saleId,
        provision_no: provisionNo || undefined,
        sgk_tracking_no: trackingNo || undefined,
        approval_status: approvalStatus || undefined,
        institution_amount: parseFloat(institutionAmount) || undefined,
        patient_amount: parseFloat(patientAmount) || undefined,
        contribution_amount: parseFloat(contribution) || undefined,
        difference_fee: parseFloat(diffFee) || undefined,
        medula_note: note || undefined,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Medula Bilgisi Gir</div>
        <div className="modal-body" style={{ fontSize: 12 }}>
          <p style={{ color: '#666', marginBottom: 8 }}>Medula sisteminden alınan bilgileri manuel girin.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group"><label>Provizyon No</label><input className="form-input" value={provisionNo} onChange={(e) => setProvisionNo(e.target.value)} /></div>
          <div className="form-group"><label>Takip No</label><input className="form-input" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} /></div>
          <div className="form-group"><label>Onay Durumu</label><input className="form-input" value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} /></div>
          <div className="form-group"><label>Kurum Karşılığı (₺)</label><input className="form-input" type="number" step="0.01" value={institutionAmount} onChange={(e) => setInstitutionAmount(e.target.value)} /></div>
          <div className="form-group"><label>Hasta Katkı Payı (₺)</label><input className="form-input" type="number" step="0.01" value={contribution} onChange={(e) => setContribution(e.target.value)} /></div>
          <div className="form-group"><label>Hasta Payı (₺)</label><input className="form-input" type="number" step="0.01" value={patientAmount} onChange={(e) => setPatientAmount(e.target.value)} /></div>
          <div className="form-group"><label>Fark Ücreti (₺)</label><input className="form-input" type="number" step="0.01" value={diffFee} onChange={(e) => setDiffFee(e.target.value)} /></div>
          <div className="form-group"><label>Medula Açıklaması</label><textarea className="form-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  );
}
