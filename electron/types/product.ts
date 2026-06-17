export const PRODUCT_TYPES = [
  'Çerçeve',
  'Güneş Gözlüğü',
  'Optik Cam',
  'Cam',
  'Kontakt Lens',
  'Lens',
  'Lens Solüsyonu',
  'Aksesuar',
  'Hizmet',
  'Diğer',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const GENDER_OPTIONS = ['Kadın', 'Erkek', 'Unisex', 'Çocuk'] as const;

export interface FrameExtra {
  color?: string;
  size?: string;
  bridge_size?: string;
  temple_length?: string;
  gender?: string;
  material?: string;
}

export interface GlassExtra {
  sph?: string;
  cyl?: string;
  ax?: string;
  add?: string;
  diameter?: string;
  index?: string;
  coating?: string;
}

export interface LensExtra {
  sph?: string;
  cyl?: string;
  ax?: string;
  bc?: string;
  dia?: string;
  add?: string;
  color?: string;
  expiry_date?: string;
  lot_no?: string;
}

export type ProductExtraFields = FrameExtra | GlassExtra | LensExtra | Record<string, string>;

export interface ProductOpticalFields {
  group_id?: number | null;
  subgroup_id?: number | null;
  brand_id?: number | null;
  model_id?: number | null;
  color_id?: number | null;
  frame_type_id?: number | null;
  frame_material_id?: number | null;
  lens_type_id?: number | null;
  lens_material_id?: number | null;
  lens_coating_id?: number | null;
  contact_lens_type_id?: number | null;
  gender?: string;
  age_group?: string;
  frame_color?: string;
  lens_color?: string;
  frame_shape?: string;
  eye_size?: string;
  bridge_size?: string;
  temple_length?: string;
  sph?: string;
  cyl?: string;
  axis?: string;
  addition?: string;
  diameter?: string;
  base_curve?: string;
  lens_index?: string;
  usage_period?: string;
  package_quantity?: string;
  season?: string;
  collection_name?: string;
  accessory_type?: string;
  material?: string;
  compatible_product?: string;
  label_name?: string;
  last_purchase_price?: number | null;
  average_cost?: number | null;
  is_polarized?: boolean;
  has_uv_protection?: boolean;
  has_blue_light_filter?: boolean;
  is_photochromic?: boolean;
  is_progressive?: boolean;
  group_name?: string;
  subgroup_name?: string;
  brand_lookup_name?: string;
  model_lookup_name?: string;
  color_name?: string;
  lens_type_name?: string;
  contact_lens_type_name?: string;
  lens_material_name?: string;
  lens_coating_name?: string;
}

export interface ProductInput extends ProductOpticalFields {
  barcode?: string;
  stock_code?: string;
  name: string;
  product_type: ProductType;
  brand?: string;
  model?: string;
  category?: string;
  purchase_price: number;
  sale_price: number;
  vat_rate?: number;
  stock_quantity: number;
  min_stock?: number;
  shelf_location?: string;
  description?: string;
  status?: string;
  extra_fields?: ProductExtraFields;
  ubb_code?: string;
  uts_product_no?: string;
  uts_barcode?: string;
  serial_no?: string;
  lot_no?: string;
  uts_expiry_date?: string;
  medical_device_class?: string;
  uts_tracking_required?: boolean;
  uts_status?: string;
  uts_note?: string;
}

export interface ProductListFilters {
  search?: string;
  product_type?: string;
  status?: string;
  group_id?: number;
  subgroup_id?: number;
  brand_id?: number;
  model_id?: number;
  color_id?: number;
  shelf_location?: string;
  critical_only?: boolean;
  uts_tracking_required?: boolean;
  no_barcode?: boolean;
}

export interface SaleItemInput {
  productId: number;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  campaignId?: number | null;
  lineNote?: string;
}

export const PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT', 'Açık Hesap', 'Parçalı Ödeme'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const CASH_PAYMENT_TYPES = ['Nakit', 'Kredi Kartı', 'Havale/EFT'] as const;
export type CashPaymentType = (typeof CASH_PAYMENT_TYPES)[number];

/** Eski product_type → yeni ana grup adı eşlemesi */
export const LEGACY_TYPE_TO_GROUP: Record<string, string> = {
  Çerçeve: 'Çerçeve',
  Cam: 'Optik Cam',
  Lens: 'Kontakt Lens',
  Aksesuar: 'Aksesuar',
  Diğer: 'Diğer',
};
