import type { Permission } from './auth';
import { PERMISSIONS } from './auth';

export interface MenuItemDef {
  path: string;
  label: string;
  icon: string;
  permission: Permission | Permission[];
  /** HashRouter search string, örn. ?tab=titubb */
  search?: string;
}

export interface MenuGroupDef {
  id: string;
  label: string;
  icon: string;
  items: MenuItemDef[];
}

export const MENU_GROUPS: MenuGroupDef[] = [
  {
    id: 'home',
    label: 'Ana Sayfa',
    icon: '▣',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: '▣', permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    id: 'stock',
    label: 'Ürün / Stok',
    icon: '▤',
    items: [
      { path: '/stok', label: 'Stok Kartları', icon: '▤', permission: PERMISSIONS.STOCK_VIEW },
      { path: '/stok-giris', label: 'Mal Kabul', icon: '⊕', permission: PERMISSIONS.STOCK_EDIT },
      { path: '/stok-sayim', label: 'Envanter / Sayım', icon: '☰', permission: PERMISSIONS.STOCK_EDIT },
      { path: '/optik-tanimlar', label: 'Optik Tanımlar', icon: '◎', permission: PERMISSIONS.SETTINGS_EDIT },
      { path: '/stok', label: 'Barkod / Etiket', icon: '▥', permission: PERMISSIONS.STOCK_VIEW },
      { path: '/medula', label: 'ÜTS / UBB Takip', icon: '◎', permission: PERMISSIONS.MEDULA_VIEW, search: '?tab=uts' },
    ],
  },
  {
    id: 'sales',
    label: 'Satış / Müşteri',
    icon: '⊞',
    items: [
      { path: '/satis', label: 'Barkodlu Satış', icon: '⊞', permission: PERMISSIONS.SALES_CREATE },
      { path: '/satislar', label: 'Satışlar', icon: '⊡', permission: PERMISSIONS.SALES_CREATE },
      { path: '/kampanyalar', label: 'Kampanyalar', icon: '％', permission: PERMISSIONS.CAMPAIGN_VIEW },
      { path: '/iade', label: 'İade / Değişim', icon: '↩', permission: PERMISSIONS.RETURNS_CREATE },
      { path: '/musteri', label: 'Müşteri / Hasta', icon: '☺', permission: PERMISSIONS.CUSTOMERS_VIEW },
      { path: '/randevular', label: 'Randevular', icon: '◷', permission: PERMISSIONS.APPOINTMENTS_VIEW },
      { path: '/recete', label: 'Reçete Kayıtları', icon: '◎', permission: PERMISSIONS.PRESCRIPTIONS_VIEW },
    ],
  },
  {
    id: 'finance',
    label: 'Finans',
    icon: '₺',
    items: [
      { path: '/kasa', label: 'Kasa / Tahsilat', icon: '₺', permission: PERMISSIONS.CASH_VIEW },
      { path: '/banka-pos', label: 'Banka / POS', icon: '⊞', permission: PERMISSIONS.FINANCE_VIEW },
      { path: '/giderler', label: 'Giderler', icon: '↦', permission: PERMISSIONS.FINANCE_VIEW },
      { path: '/tedarikciler', label: 'Tedarikçiler', icon: '⊟', permission: PERMISSIONS.SUPPLIERS_VIEW },
      { path: '/tedarikciler', label: 'Tedarikçi Cari', icon: '⊡', permission: PERMISSIONS.SUPPLIERS_VIEW, search: '?tab=account' },
      { path: '/tedarikciler', label: 'Tedarikçi Ödemeleri', icon: '↦', permission: PERMISSIONS.SUPPLIER_PAYMENTS, search: '?tab=payments' },
      { path: '/acik-hesaplar', label: 'Açık Hesaplar', icon: '⊟', permission: PERMISSIONS.FINANCE_VIEW },
      { path: '/ekstreler', label: 'Ekstreler', icon: '▦', permission: PERMISSIONS.FINANCE_VIEW },
      { path: '/kar-zarar', label: 'Kâr-Zarar', icon: '▤', permission: PERMISSIONS.FINANCE_VIEW },
    ],
  },
  {
    id: 'official',
    label: 'Resmi İşlemler',
    icon: '⊕',
    items: [
      { path: '/medula', label: 'Medula / ÜTS', icon: '⊕', permission: PERMISSIONS.MEDULA_VIEW },
      { path: '/e-donusum', label: 'E-Dönüşüm', icon: '▦', permission: PERMISSIONS.EINVOICE_VIEW },
      { path: '/medula', label: 'TİTUBB Bildirimi', icon: '▦', permission: PERMISSIONS.MEDULA_VIEW, search: '?tab=titubb' },
    ],
  },
  {
    id: 'reports',
    label: 'Raporlar',
    icon: '▦',
    items: [
      { path: '/raporlar', label: 'Raporlar', icon: '▦', permission: PERMISSIONS.REPORTS_VIEW },
    ],
  },
  {
    id: 'admin',
    label: 'Yönetim',
    icon: '⚙',
    items: [
      { path: '/firma', label: 'Firma Ayarları', icon: '⌂', permission: PERMISSIONS.SETTINGS_EDIT },
      { path: '/kullanicilar', label: 'Kullanıcılar', icon: '👤', permission: PERMISSIONS.USERS_MANAGE },
      { path: '/yedekleme', label: 'Yedekleme', icon: '↓', permission: PERMISSIONS.BACKUP_MANAGE },
      { path: '/ayarlar', label: 'Ayarlar', icon: '⚙', permission: PERMISSIONS.SETTINGS_EDIT },
    ],
  },
];

export function checkMenuPermission(
  permission: Permission | Permission[],
  hasPermission: (p: Permission) => boolean
): boolean {
  if (Array.isArray(permission)) return permission.some((p) => hasPermission(p));
  return hasPermission(permission);
}

export function filterVisibleMenuGroups(
  groups: MenuGroupDef[],
  hasPermission: (p: Permission) => boolean
): MenuGroupDef[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => checkMenuPermission(item.permission, hasPermission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function menuItemKey(item: MenuItemDef): string {
  return `${item.path}${item.search || ''}`;
}

export function isMenuItemActive(pathname: string, search: string, item: MenuItemDef): boolean {
  if (pathname !== item.path && !pathname.startsWith(`${item.path}/`)) return false;

  const params = new URLSearchParams(search);
  const itemParams = new URLSearchParams(item.search?.replace(/^\?/, '') || '');

  if (item.path === '/e-donusum' && !item.search) {
    const tab = params.get('tab');
    return !tab || tab === 'sale';
  }

  if (item.path === '/medula' && !item.search) {
    const tab = params.get('tab');
    return !tab || tab === 'medula';
  }

  if (item.path === '/tedarikciler' && !item.search) {
    const tab = params.get('tab');
    return !tab || tab === 'suppliers';
  }

  if (item.path === '/raporlar' && !item.search) {
    const tab = params.get('tab');
    return !tab;
  }

  if (!item.search) return true;

  for (const [key, value] of itemParams.entries()) {
    if (params.get(key) !== value) return false;
  }
  return true;
}

export function findActiveMenuGroup(pathname: string, search: string, groups: MenuGroupDef[]): string | null {
  for (const group of groups) {
    if (group.items.some((item) => isMenuItemActive(pathname, search, item))) {
      return group.id;
    }
  }
  return null;
}

export interface DashboardQuickLink {
  label: string;
  path: string;
  search?: string;
  permission: Permission | Permission[];
}

export interface DashboardModuleDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  quickLinks: DashboardQuickLink[];
}

export const DASHBOARD_MODULES: DashboardModuleDef[] = [
  {
    id: 'stock',
    title: 'Ürün / Stok',
    icon: '▤',
    description: 'Stok kartları, mal kabul, barkodlu sayım ve etiket işlemleri.',
    quickLinks: [
      { label: 'Stok Kartları', path: '/stok', permission: PERMISSIONS.STOCK_VIEW },
      { label: 'Optik Tanımlar', path: '/optik-tanimlar', permission: PERMISSIONS.SETTINGS_EDIT },
      { label: 'Mal Kabul', path: '/stok-giris', permission: PERMISSIONS.STOCK_EDIT },
      { label: 'Sayım Başlat', path: '/stok-sayim', permission: PERMISSIONS.STOCK_EDIT },
    ],
  },
  {
    id: 'sales',
    title: 'Satış',
    icon: '⊞',
    description: 'Barkodlu satış, satış takibi, iade ve değişim işlemleri.',
    quickLinks: [
      { label: 'Barkodlu Satış', path: '/satis', permission: PERMISSIONS.SALES_CREATE },
      { label: 'Satışlar', path: '/satislar', permission: PERMISSIONS.SALES_CREATE },
      { label: 'İade / Değişim', path: '/iade', permission: PERMISSIONS.RETURNS_CREATE },
    ],
  },
  {
    id: 'customer',
    title: 'Müşteri / Reçete',
    icon: '☺',
    description: 'Hasta kartları, reçete kayıtları ve müşteri geçmişi.',
    quickLinks: [
      { label: 'Müşteri / Hasta', path: '/musteri', permission: PERMISSIONS.CUSTOMERS_VIEW },
      { label: 'Randevular', path: '/randevular', permission: PERMISSIONS.APPOINTMENTS_VIEW },
      { label: 'Reçete Kayıtları', path: '/recete', permission: PERMISSIONS.PRESCRIPTIONS_VIEW },
    ],
  },
  {
    id: 'finance',
    title: 'Finans',
    icon: '₺',
    description: 'Kasa, tahsilat, tedarikçi cari ve ödeme işlemleri.',
    quickLinks: [
      { label: 'Kasa / Tahsilat', path: '/kasa', permission: PERMISSIONS.CASH_VIEW },
      { label: 'Banka / POS', path: '/banka-pos', permission: PERMISSIONS.FINANCE_VIEW },
      { label: 'Giderler', path: '/giderler', permission: PERMISSIONS.FINANCE_VIEW },
      { label: 'Tedarikçiler', path: '/tedarikciler', permission: PERMISSIONS.SUPPLIERS_VIEW },
      { label: 'Kâr-Zarar', path: '/kar-zarar', permission: PERMISSIONS.FINANCE_VIEW },
    ],
  },
  {
    id: 'official',
    title: 'Resmi İşlemler',
    icon: '⊕',
    description: 'Medula, ÜTS ve TİTUBB bildirim hazırlıkları.',
    quickLinks: [
      { label: 'Medula / ÜTS', path: '/medula', permission: PERMISSIONS.MEDULA_VIEW },
      { label: 'E-Dönüşüm', path: '/e-donusum', permission: PERMISSIONS.EINVOICE_VIEW },
      { label: 'TİTUBB Bildirimi', path: '/medula', search: '?tab=titubb', permission: PERMISSIONS.MEDULA_VIEW },
    ],
  },
  {
    id: 'reports',
    title: 'Raporlar',
    icon: '▦',
    description: 'Satış, stok, kasa, cari, sayım ve alış raporları.',
    quickLinks: [{ label: 'Raporlar', path: '/raporlar', permission: PERMISSIONS.REPORTS_VIEW }],
  },
  {
    id: 'admin',
    title: 'Yönetim',
    icon: '⚙',
    description: 'Firma, kullanıcı, yedekleme ve sistem ayarları.',
    quickLinks: [
      { label: 'Firma Ayarları', path: '/firma', permission: PERMISSIONS.SETTINGS_EDIT },
      { label: 'Kullanıcılar', path: '/kullanicilar', permission: PERMISSIONS.USERS_MANAGE },
      { label: 'Yedekleme', path: '/yedekleme', permission: PERMISSIONS.BACKUP_MANAGE },
    ],
  },
];

export function filterDashboardModules(
  modules: DashboardModuleDef[],
  hasPermission: (p: Permission) => boolean
): Array<DashboardModuleDef & { quickLinks: DashboardQuickLink[] }> {
  return modules
    .map((mod) => ({
      ...mod,
      quickLinks: mod.quickLinks.filter((link) => checkMenuPermission(link.permission, hasPermission)),
    }))
    .filter((mod) => mod.quickLinks.length > 0);
}

/** Geriye dönük uyumluluk — düz menü listesi */
export const MENU_ITEMS = MENU_GROUPS.flatMap((g) => g.items);
