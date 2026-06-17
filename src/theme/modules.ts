/** Merkezi modül renk sistemi — soft masaüstü tonları */
export type ModuleId =
  | 'home'
  | 'stock'
  | 'sales'
  | 'finance'
  | 'official'
  | 'reports'
  | 'admin';

export const MODULE_LABELS: Record<ModuleId, string> = {
  home: 'Ana Sayfa',
  stock: 'Ürün / Stok',
  sales: 'Satış / Müşteri',
  finance: 'Finans',
  official: 'Resmi İşlemler',
  reports: 'Raporlar',
  admin: 'Yönetim',
};

/** Sol menü grup id → modül */
export const MENU_GROUP_MODULE: Record<string, ModuleId> = {
  home: 'home',
  stock: 'stock',
  sales: 'sales',
  finance: 'finance',
  official: 'official',
  reports: 'reports',
  admin: 'admin',
};

export const ROUTE_MODULE: Record<string, ModuleId> = {
  '/dashboard': 'home',
  '/stok': 'stock',
  '/optik-tanimlar': 'stock',
  '/stok-giris': 'stock',
  '/stok-sayim': 'stock',
  '/satis': 'sales',
  '/satislar': 'sales',
  '/kampanyalar': 'sales',
  '/iade': 'sales',
  '/musteri': 'sales',
  '/randevular': 'sales',
  '/recete': 'sales',
  '/kasa': 'finance',
  '/banka-pos': 'finance',
  '/giderler': 'finance',
  '/tedarikciler': 'finance',
  '/acik-hesaplar': 'finance',
  '/ekstreler': 'finance',
  '/kar-zarar': 'finance',
  '/medula': 'official',
  '/e-donusum': 'official',
  '/raporlar': 'reports',
  '/firma': 'admin',
  '/kullanicilar': 'admin',
  '/yedekleme': 'admin',
  '/ayarlar': 'admin',
};

export function getModuleForPath(pathname: string): ModuleId | null {
  const base = '/' + (pathname.split('/').filter(Boolean)[0] || 'dashboard');
  return ROUTE_MODULE[base] ?? null;
}

/** Hızlı işlem buton renkleri */
export const QUICK_ACTION_TONE: Record<string, string> = {
  '/satis': 'sales',
  '/stok-giris': 'stock',
  '/musteri': 'sales',
  '/recete': 'official',
  '/kasa': 'finance',
  '/stok-sayim': 'stock',
  '/medula': 'official',
  '/raporlar': 'reports',
};
