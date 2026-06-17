import { formatDate } from '@/utils/format';
import type { Prescription } from '@/types/electron';
import '@/components/products/ProductForm.css';

interface PrescriptionDetailProps {
  prescription: Prescription;
  onClose: () => void;
  onEdit: () => void;
}

function EyeCard({ title, sph, cyl, ax }: { title: string; sph?: string | null; cyl?: string | null; ax?: string | null }) {
  return (
    <div className="eye-box">
      <div className="eye-box-title">{title}</div>
      <table className="eye-table">
        <tbody>
          <tr><td>SPH</td><td>{sph || '-'}</td></tr>
          <tr><td>CYL</td><td>{cyl || '-'}</td></tr>
          <tr><td>AX</td><td>{ax || '-'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function PrescriptionDetail({ prescription, onClose, onEdit }: PrescriptionDetailProps) {
  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 640 }}>
        <div className="product-form-header">
          <span>Reçete: {prescription.prescription_no || prescription.e_prescription_no || `#${prescription.id}`}</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="product-form-body">
          <div className="detail-grid">
            <div><strong>Müşteri:</strong> {prescription.customer_name || '-'}</div>
            <div><strong>Tarih:</strong> {formatDate(prescription.prescription_date)}</div>
            <div><strong>Doktor:</strong> {prescription.doctor || '-'}</div>
            <div><strong>Kurum:</strong> {prescription.institution || '-'}</div>
            <div><strong>Cam Tipi:</strong> {prescription.lens_type || '-'}</div>
            <div><strong>Kullanım:</strong> {prescription.usage_type || '-'}</div>
            <div><strong>Durum:</strong> {prescription.status}</div>
            <div><strong>E-reçete:</strong> {prescription.e_prescription_no || '-'}</div>
          </div>

          <div className="eye-section" style={{ marginTop: 12 }}>
            <EyeCard title="Sağ Göz" sph={prescription.right_sph} cyl={prescription.right_cyl} ax={prescription.right_ax} />
            <EyeCard title="Sol Göz" sph={prescription.left_sph} cyl={prescription.left_cyl} ax={prescription.left_ax} />
          </div>

          <div className="detail-grid" style={{ marginTop: 12 }}>
            <div><strong>ADD:</strong> {prescription.add_value || '-'}</div>
            <div><strong>PD:</strong> {prescription.pd || '-'}</div>
          </div>

          {prescription.notes && (
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Not</label>
              <p style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap' }}>{prescription.notes}</p>
            </div>
          )}
        </div>
        <div className="product-form-footer">
          <button type="button" className="btn btn-primary" onClick={onEdit}>Düzenle</button>
          <button type="button" className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
