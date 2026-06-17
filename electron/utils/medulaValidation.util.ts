import type Database from 'better-sqlite3';
import { INSTITUTION_PRESCRIPTION_TYPES } from '../types/medulaOperation';

export interface MedulaValidationDetail {
  saleId: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function hasEyeData(row: Record<string, unknown>, side: 'right' | 'left'): boolean {
  const prefix = side === 'right' ? 'right' : 'left';
  return !!(row[`${prefix}_sph`] || row[`${prefix}_cyl`] || row[`${prefix}_ax`]);
}

export function isInstitutionPrescriptionType(type: unknown): boolean {
  return INSTITUTION_PRESCRIPTION_TYPES.includes(String(type) as (typeof INSTITUTION_PRESCRIPTION_TYPES)[number]);
}

export function validateMedulaSaleRecord(
  db: Database.Database,
  saleId: number,
  options: { requireInstitutionFields?: boolean } = {}
): MedulaValidationDetail {
  const sale = db
    .prepare(
      `SELECT s.*, c.full_name as customer_name, c.tc_no as customer_tc, c.phone as customer_phone
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ? AND s.prescription_id IS NOT NULL`
    )
    .get(saleId) as Record<string, unknown> | undefined;

  if (!sale) {
    return { saleId, isValid: false, errors: ['Kayıt bulunamadı.'], warnings: [] };
  }

  const prescription = db
    .prepare(`SELECT * FROM prescriptions WHERE id = ?`)
    .get(sale.prescription_id) as Record<string, unknown>;

  const items = db
    .prepare(
      `SELECT si.*, p.name as product_name, p.product_type, p.ubb_code, p.uts_product_no,
              COALESCE(si.barcode, pb.barcode) as barcode
       FROM sale_items si
       INNER JOIN products p ON p.id = si.product_id
       LEFT JOIN product_barcodes pb ON pb.product_id = p.id AND pb.is_primary = 1
       WHERE si.sale_id = ?`
    )
    .all(saleId) as Array<Record<string, unknown>>;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sale.customer_name) errors.push('Hasta adı eksik');
  const tc = String(prescription.patient_tc || sale.customer_tc || '').trim();
  if (!tc) errors.push('Hasta T.C. eksik');

  const rxNo = String(prescription.prescription_no || '').trim();
  const eRxNo = String(prescription.e_prescription_no || '').trim();
  if (!rxNo && !eRxNo) errors.push('Reçete no veya e-reçete no eksik');

  if (!prescription.prescription_date) errors.push('Reçete tarihi eksik');
  if (!prescription.prescription_type) errors.push('Reçete türü eksik');

  const requireInstitution =
    options.requireInstitutionFields ?? isInstitutionPrescriptionType(prescription.prescription_type);
  if (requireInstitution) {
    if (!prescription.institution && !prescription.institution_code) {
      errors.push('Kurum bilgisi eksik');
    }
  }

  if (!items.length) errors.push('Ürün satırları eksik');

  const needsOptical =
    items.some((i) => {
      const t = String(i.product_type || '').toLowerCase();
      return t.includes('cam') || t.includes('lens') || t.includes('gözlük');
    }) || !!prescription.right_sph || !!prescription.left_sph;

  if (needsOptical && !hasEyeData(prescription, 'right') && !hasEyeData(prescription, 'left')) {
    errors.push('Cam/reçete değerleri eksik');
  }

  for (const item of items) {
    if (!item.barcode) warnings.push(`Ürün barkodu eksik: ${item.product_name}`);
    const ubb = item.ubb_code;
    const utsNo = item.uts_product_no;
    const needsUts = ['Cam', 'Lens', 'Gözlük', 'Çerçeve'].some((t) =>
      String(item.product_type || '').includes(t)
    );
    if (needsUts && !ubb && !utsNo) {
      warnings.push(`UBB/ÜTS bilgisi eksik: ${item.product_name}`);
    }
  }

  return { saleId, isValid: errors.length === 0, errors, warnings };
}

export function missingFieldsSummary(validation: MedulaValidationDetail): {
  missing_fields: string;
  missing_count: number;
} {
  const all = [...validation.errors, ...validation.warnings];
  return { missing_fields: all.join('; ') || '-', missing_count: all.length };
}
