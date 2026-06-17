import type { ProductInput } from '../types/product';

export const PRODUCT_LOOKUP_JOIN_SQL = `
  LEFT JOIN optical_lookup_values g ON g.id = p.group_id
  LEFT JOIN optical_lookup_values sg ON sg.id = p.subgroup_id
  LEFT JOIN optical_lookup_values b ON b.id = p.brand_id
  LEFT JOIN optical_lookup_values m ON m.id = p.model_id
  LEFT JOIN optical_lookup_values c ON c.id = p.color_id
  LEFT JOIN optical_lookup_values lt ON lt.id = p.lens_type_id
  LEFT JOIN optical_lookup_values clt ON clt.id = p.contact_lens_type_id
  LEFT JOIN optical_lookup_values lm ON lm.id = p.lens_material_id
  LEFT JOIN optical_lookup_values lc ON lc.id = p.lens_coating_id
`;

export const PRODUCT_LOOKUP_SELECT = `
  g.name as group_name, sg.name as subgroup_name,
  b.name as brand_lookup_name, m.name as model_lookup_name, c.name as color_name,
  lt.name as lens_type_name, clt.name as contact_lens_type_name,
  lm.name as lens_material_name, lc.name as lens_coating_name
`;

const BOOL_COLS = [
  'is_polarized',
  'has_uv_protection',
  'has_blue_light_filter',
  'is_photochromic',
  'is_progressive',
] as const;

const NULLABLE_ID_COLS = [
  'group_id',
  'subgroup_id',
  'brand_id',
  'model_id',
  'color_id',
  'frame_type_id',
  'frame_material_id',
  'lens_type_id',
  'lens_material_id',
  'lens_coating_id',
  'contact_lens_type_id',
] as const;

const TEXT_OPTICAL_COLS = [
  'gender',
  'age_group',
  'frame_color',
  'lens_color',
  'frame_shape',
  'eye_size',
  'bridge_size',
  'temple_length',
  'sph',
  'cyl',
  'axis',
  'addition',
  'diameter',
  'base_curve',
  'lens_index',
  'usage_period',
  'package_quantity',
  'season',
  'collection_name',
  'accessory_type',
  'material',
  'compatible_product',
  'label_name',
] as const;

const NUM_OPTICAL_COLS = ['last_purchase_price', 'average_cost'] as const;

export function opticalColumnNames(): string[] {
  return [...NULLABLE_ID_COLS, ...TEXT_OPTICAL_COLS, ...NUM_OPTICAL_COLS, ...BOOL_COLS];
}

export function opticalPlaceholders(): string {
  return opticalColumnNames().map(() => '?').join(', ');
}

export function opticalBindValues(input: ProductInput): unknown[] {
  const values: unknown[] = [];
  for (const col of NULLABLE_ID_COLS) {
    values.push(input[col] ?? null);
  }
  for (const col of TEXT_OPTICAL_COLS) {
    const v = input[col];
    values.push(typeof v === 'string' ? v.trim() || null : v ?? null);
  }
  for (const col of NUM_OPTICAL_COLS) {
    const v = input[col];
    values.push(v == null || v === '' ? null : Number(v));
  }
  for (const col of BOOL_COLS) {
    values.push(input[col] ? 1 : 0);
  }
  return values;
}

export function mergeLegacyExtraFields(input: ProductInput): ProductInput {
  const extra = (input.extra_fields || {}) as Record<string, string>;
  const merged = { ...input };

  if (!merged.eye_size && extra.size) merged.eye_size = extra.size;
  if (!merged.bridge_size && extra.bridge_size) merged.bridge_size = extra.bridge_size;
  if (!merged.temple_length && extra.temple_length) merged.temple_length = extra.temple_length;
  if (!merged.gender && extra.gender) merged.gender = extra.gender;
  if (!merged.frame_color && extra.color) merged.frame_color = extra.color;
  if (!merged.material && extra.material) merged.material = extra.material;
  if (!merged.sph && extra.sph) merged.sph = extra.sph;
  if (!merged.cyl && extra.cyl) merged.cyl = extra.cyl;
  if (!merged.axis && extra.ax) merged.axis = extra.ax;
  if (!merged.addition && extra.add) merged.addition = extra.add;
  if (!merged.diameter && (extra.diameter || extra.dia)) merged.diameter = extra.diameter || extra.dia;
  if (!merged.base_curve && extra.bc) merged.base_curve = extra.bc;
  if (!merged.lens_index && extra.index) merged.lens_index = extra.index;
  if (!merged.lens_color && extra.color) merged.lens_color = extra.color;
  if (!merged.lot_no && extra.lot_no) merged.lot_no = extra.lot_no;
  if (!merged.uts_expiry_date && extra.expiry_date) merged.uts_expiry_date = extra.expiry_date;

  return merged;
}

export function hydrateFromLegacyRow(row: Record<string, unknown>): Record<string, unknown> {
  const extra = row.extra_fields as Record<string, string> | undefined;
  if (!extra || typeof extra !== 'object') return row;

  const out = { ...row };
  if (!out.eye_size && extra.size) out.eye_size = extra.size;
  if (!out.bridge_size && extra.bridge_size) out.bridge_size = extra.bridge_size;
  if (!out.temple_length && extra.temple_length) out.temple_length = extra.temple_length;
  if (!out.gender && extra.gender) out.gender = extra.gender;
  if (!out.frame_color && extra.color && !out.lens_color) out.frame_color = extra.color;
  if (!out.sph && extra.sph) out.sph = extra.sph;
  if (!out.cyl && extra.cyl) out.cyl = extra.cyl;
  if (!out.axis && extra.ax) out.axis = extra.ax;
  if (!out.addition && extra.add) out.addition = extra.add;
  if (!out.diameter && (extra.diameter || extra.dia)) out.diameter = extra.diameter || extra.dia;
  if (!out.base_curve && extra.bc) out.base_curve = extra.bc;
  if (!out.lens_index && extra.index) out.lens_index = extra.index;
  return out;
}
