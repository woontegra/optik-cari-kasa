export const OPTICAL_LOOKUP_TYPES = [
  'PRODUCT_GROUP',
  'PRODUCT_SUBGROUP',
  'BRAND',
  'MODEL',
  'COLOR',
  'FRAME_TYPE',
  'FRAME_MATERIAL',
  'LENS_TYPE',
  'LENS_MATERIAL',
  'LENS_COATING',
  'CONTACT_LENS_TYPE',
] as const;

export type OpticalLookupType = (typeof OPTICAL_LOOKUP_TYPES)[number];

export interface OpticalLookupListFilters {
  type?: OpticalLookupType;
  parent_id?: number;
  search?: string;
  active_only?: boolean;
}

export interface OpticalLookupInput {
  type: OpticalLookupType;
  parent_id?: number | null;
  name: string;
  code?: string | null;
  sort_order?: number;
}

export const GROUP_FIELD_PROFILES = {
  FRAME: ['Çerçeve', 'Güneş Gözlüğü'],
  GLASS: ['Optik Cam', 'Cam'],
  CONTACT: ['Kontakt Lens', 'Lens', 'Lens Solüsyonu'],
  ACCESSORY: ['Aksesuar'],
} as const;

export function getGroupFieldProfile(groupName?: string | null): 'FRAME' | 'GLASS' | 'CONTACT' | 'ACCESSORY' | 'OTHER' {
  if (!groupName) return 'OTHER';
  if ((GROUP_FIELD_PROFILES.FRAME as readonly string[]).includes(groupName)) return 'FRAME';
  if ((GROUP_FIELD_PROFILES.GLASS as readonly string[]).includes(groupName)) return 'GLASS';
  if ((GROUP_FIELD_PROFILES.CONTACT as readonly string[]).includes(groupName)) return 'CONTACT';
  if ((GROUP_FIELD_PROFILES.ACCESSORY as readonly string[]).includes(groupName)) return 'ACCESSORY';
  return 'OTHER';
}
