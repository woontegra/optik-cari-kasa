import type Database from 'better-sqlite3';
import type { PrescriptionInput, PrescriptionListFilters } from '../types/prescription';
import { PRESCRIPTION_STATUSES, USAGE_TYPES } from '../types/prescription';

export class PrescriptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrescriptionValidationError';
  }
}

function formatEye(sph: string | null, cyl: string | null, ax: string | null): string {
  if (!sph && !cyl && !ax) return '-';
  return `${sph || '0'} / ${cyl || '0'} x ${ax || '0'}`;
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    right_eye: formatEye(
      row.right_sph as string | null,
      row.right_cyl as string | null,
      row.right_ax as string | null
    ),
    left_eye: formatEye(
      row.left_sph as string | null,
      row.left_cyl as string | null,
      row.left_ax as string | null
    ),
    is_active: row.is_active === 1 || row.is_active === undefined ? 1 : 0,
  };
}

export class PrescriptionService {
  constructor(private db: Database.Database) {}

  private validateOpticalValue(
    value: string | undefined,
    label: string,
    type: 'numeric' | 'axis'
  ): void {
    if (!value?.trim()) return;
    const v = value.trim().replace(',', '.');
    if (type === 'numeric' && isNaN(Number(v))) {
      throw new PrescriptionValidationError(`${label} sayısal olmalıdır.`);
    }
    if (type === 'axis') {
      const num = Number(v);
      if (isNaN(num) || num < 0 || num > 180) {
        throw new PrescriptionValidationError(`${label} 0-180 arasında olmalıdır.`);
      }
    }
  }

  validate(input: PrescriptionInput): void {
    if (!input.customer_id) {
      throw new PrescriptionValidationError('Müşteri seçimi zorunludur.');
    }
    const customer = this.db.prepare(`SELECT id FROM customers WHERE id = ?`).get(input.customer_id);
    if (!customer) {
      throw new PrescriptionValidationError('Seçilen müşteri bulunamadı.');
    }
    if (input.status && !PRESCRIPTION_STATUSES.includes(input.status)) {
      throw new PrescriptionValidationError('Geçersiz reçete durumu.');
    }
    if (input.usage_type && !USAGE_TYPES.includes(input.usage_type)) {
      throw new PrescriptionValidationError('Geçersiz kullanım tipi.');
    }

    this.validateOpticalValue(input.right_sph, 'Sağ SPH', 'numeric');
    this.validateOpticalValue(input.right_cyl, 'Sağ CYL', 'numeric');
    this.validateOpticalValue(input.right_ax, 'Sağ AX', 'axis');
    this.validateOpticalValue(input.left_sph, 'Sol SPH', 'numeric');
    this.validateOpticalValue(input.left_cyl, 'Sol CYL', 'numeric');
    this.validateOpticalValue(input.left_ax, 'Sol AX', 'axis');
    this.validateOpticalValue(input.add_value, 'ADD', 'numeric');
    this.validateOpticalValue(input.pd, 'PD', 'numeric');
  }

  private baseSelect(): string {
    return `
      SELECT pr.*, c.full_name as customer_name
      FROM prescriptions pr
      LEFT JOIN customers c ON c.id = pr.customer_id
    `;
  }

  list(filters: PrescriptionListFilters = {}): Record<string, unknown>[] {
    let sql = `${this.baseSelect()} WHERE (pr.is_active = 1 OR pr.is_active IS NULL)`;
    const params: unknown[] = [];

    if (filters.search?.trim()) {
      sql += ` AND (pr.prescription_no LIKE ? OR pr.e_prescription_no LIKE ? OR c.full_name LIKE ? OR pr.doctor LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (filters.customer_id) {
      sql += ` AND pr.customer_id = ?`;
      params.push(filters.customer_id);
    }
    if (filters.date_from) {
      sql += ` AND date(pr.prescription_date) >= date(?)`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date(pr.prescription_date) <= date(?)`;
      params.push(filters.date_to);
    }
    if (filters.status) {
      sql += ` AND pr.status = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY pr.prescription_date DESC, pr.id DESC`;
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  listByCustomer(customerId: number, activeOnly = false): Record<string, unknown>[] {
    let sql = `${this.baseSelect()} WHERE pr.customer_id = ?`;
    if (activeOnly) {
      sql += ` AND pr.status = 'Aktif' AND (pr.is_active = 1 OR pr.is_active IS NULL)`;
    }
    sql += ` ORDER BY pr.prescription_date DESC`;
    const rows = this.db.prepare(sql).all(customerId) as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  getById(id: number): Record<string, unknown> | null {
    const row = this.db.prepare(`${this.baseSelect()} WHERE pr.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  private generatePrescriptionNo(): string {
    return `REC-${Date.now()}`;
  }

  create(input: PrescriptionInput): { id: number; prescription_no: string } {
    this.validate(input);
    const prescriptionNo = this.generatePrescriptionNo();

    const result = this.db
      .prepare(
        `INSERT INTO prescriptions (
          customer_id, prescription_no, e_prescription_no, prescription_date,
          doctor, institution, right_sph, right_cyl, right_ax,
          left_sph, left_cyl, left_ax, add_value, pd,
          lens_type, usage_type, notes, status, is_active,
          prescription_type, e_report_no, provision_no, sgk_tracking_no,
          institution_code, doctor_registration_no, patient_tc, beneficiary_note,
          medula_status, medula_note, examination_date, rx_delivery_date,
          patient_card_no, doctor_branch, medula_approval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customer_id,
        prescriptionNo,
        input.e_prescription_no?.trim() || null,
        input.prescription_date || new Date().toISOString().slice(0, 10),
        input.doctor?.trim() || null,
        input.institution?.trim() || null,
        input.right_sph?.trim() || null,
        input.right_cyl?.trim() || null,
        input.right_ax?.trim() || null,
        input.left_sph?.trim() || null,
        input.left_cyl?.trim() || null,
        input.left_ax?.trim() || null,
        input.add_value?.trim() || null,
        input.pd?.trim() || null,
        input.lens_type?.trim() || null,
        input.usage_type || null,
        input.notes?.trim() || null,
        input.status || 'Aktif',
        input.prescription_type || 'Özel',
        input.e_report_no?.trim() || null,
        input.provision_no?.trim() || null,
        input.sgk_tracking_no?.trim() || null,
        input.institution_code?.trim() || null,
        input.doctor_registration_no?.trim() || null,
        input.patient_tc?.trim() || null,
        input.beneficiary_note?.trim() || null,
        input.medula_status || 'Hazırlanmadı',
        input.medula_note?.trim() || null,
        input.examination_date || null,
        input.rx_delivery_date || null,
        input.patient_card_no?.trim() || null,
        input.doctor_branch?.trim() || null,
        input.medula_approval_status?.trim() || null
      );

    return { id: Number(result.lastInsertRowid), prescription_no: prescriptionNo };
  }

  update(id: number, input: PrescriptionInput): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new PrescriptionValidationError('Reçete bulunamadı.');
    this.validate(input);

    this.db
      .prepare(
        `UPDATE prescriptions SET
          customer_id = ?, e_prescription_no = ?, prescription_date = ?,
          doctor = ?, institution = ?, right_sph = ?, right_cyl = ?, right_ax = ?,
          left_sph = ?, left_cyl = ?, left_ax = ?, add_value = ?, pd = ?,
          lens_type = ?, usage_type = ?, notes = ?, status = ?,
          prescription_type = ?, e_report_no = ?, provision_no = ?, sgk_tracking_no = ?,
          institution_code = ?, doctor_registration_no = ?, patient_tc = ?, beneficiary_note = ?,
          medula_status = ?, medula_note = ?,
          examination_date = ?, rx_delivery_date = ?, patient_card_no = ?,
          doctor_branch = ?, medula_approval_status = ?,
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.customer_id,
        input.e_prescription_no?.trim() || null,
        input.prescription_date || null,
        input.doctor?.trim() || null,
        input.institution?.trim() || null,
        input.right_sph?.trim() || null,
        input.right_cyl?.trim() || null,
        input.right_ax?.trim() || null,
        input.left_sph?.trim() || null,
        input.left_cyl?.trim() || null,
        input.left_ax?.trim() || null,
        input.add_value?.trim() || null,
        input.pd?.trim() || null,
        input.lens_type?.trim() || null,
        input.usage_type || null,
        input.notes?.trim() || null,
        input.status || 'Aktif',
        input.prescription_type || 'Özel',
        input.e_report_no?.trim() || null,
        input.provision_no?.trim() || null,
        input.sgk_tracking_no?.trim() || null,
        input.institution_code?.trim() || null,
        input.doctor_registration_no?.trim() || null,
        input.patient_tc?.trim() || null,
        input.beneficiary_note?.trim() || null,
        input.medula_status || 'Hazırlanmadı',
        input.medula_note?.trim() || null,
        input.examination_date || null,
        input.rx_delivery_date || null,
        input.patient_card_no?.trim() || null,
        input.doctor_branch?.trim() || null,
        input.medula_approval_status?.trim() || null,
        id
      );
    return { id };
  }

  deactivate(id: number): { id: number } {
    const existing = this.getById(id);
    if (!existing) throw new PrescriptionValidationError('Reçete bulunamadı.');
    this.db
      .prepare(
        `UPDATE prescriptions SET is_active = 0, status = 'İptal', updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }
}
