export const USER_ROLES = [
  'Yönetici',
  'Satış Personeli',
  'Kasa Personeli',
  'Stok Personeli',
  'Rapor Kullanıcısı',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  STOCK_VIEW: 'stock.view',
  STOCK_EDIT: 'stock.edit',
  STOCK_DELETE: 'stock.delete',
  SALES_CREATE: 'sales.create',
  SALES_CANCEL: 'sales.cancel',
  RETURNS_CREATE: 'returns.create',
  CASH_VIEW: 'cash.view',
  CASH_EDIT: 'cash.edit',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_EDIT: 'customers.edit',
  PRESCRIPTIONS_VIEW: 'prescriptions.view',
  PRESCRIPTIONS_EDIT: 'prescriptions.edit',
  MEDULA_VIEW: 'medula.view',
  MEDULA_EXPORT: 'medula.export',
  MEDULA_EDIT: 'medula.edit',
  MEDULA_MARK_PROCESSED: 'medula.markProcessed',
  SGK_VIEW: 'sgk.view',
  SGK_EDIT: 'sgk.edit',
  EINVOICE_VIEW: 'einvoice.view',
  EINVOICE_EDIT: 'einvoice.edit',
  EINVOICE_EXPORT: 'einvoice.export',
  EINVOICE_MARK_OFFICIAL: 'einvoice.markOfficial',
  REPORTS_VIEW: 'reports.view',
  EXCEL_EXPORT: 'excel.export',
  SETTINGS_EDIT: 'settings.edit',
  USERS_MANAGE: 'users.manage',
  BACKUP_MANAGE: 'backup.manage',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_EDIT: 'suppliers.edit',
  SUPPLIER_PAYMENTS: 'suppliers.payments',
  FINANCE_VIEW: 'finance.view',
  FINANCE_EDIT: 'finance.edit',
  CAMPAIGN_VIEW: 'campaigns.view',
  CAMPAIGN_EDIT: 'campaigns.edit',
  MANUAL_DISCOUNT: 'sales.manual_discount',
  APPOINTMENTS_VIEW: 'appointments.view',
  APPOINTMENTS_EDIT: 'appointments.edit',
  COMMUNICATIONS_VIEW: 'communications.view',
  COMMUNICATIONS_EDIT: 'communications.edit',
  UTS_VIEW: 'uts.view',
  UTS_EDIT: 'uts.edit',
  UTS_EXPORT: 'uts.export',
  UTS_MARK_PROCESSED: 'uts.markProcessed',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'Dashboard görüntüleme',
  'stock.view': 'Stok görüntüleme',
  'stock.edit': 'Stok ekleme/düzenleme',
  'stock.delete': 'Stok silme/pasife alma',
  'sales.create': 'Satış yapma',
  'sales.cancel': 'Satış iptal etme',
  'returns.create': 'İade/değişim yapma',
  'cash.view': 'Kasa görüntüleme',
  'cash.edit': 'Kasa gelir/gider ekleme',
  'customers.view': 'Müşteri görüntüleme',
  'customers.edit': 'Müşteri ekleme/düzenleme',
  'prescriptions.view': 'Reçete görüntüleme',
  'prescriptions.edit': 'Reçete ekleme/düzenleme',
  'medula.view': 'Medula/ÜTS görüntüleme',
  'medula.export': 'Medula dışa aktarım',
  'medula.edit': 'Medula bilgi düzenleme',
  'medula.markProcessed': 'Medula işlendi / fatura işaretleme',
  'sgk.view': 'SGK/Kurum reçete görüntüleme',
  'sgk.edit': 'SGK fatura ve kurum alacağı düzenleme',
  'einvoice.view': 'E-Dönüşüm görüntüleme',
  'einvoice.edit': 'Fatura taslağı oluşturma/düzenleme',
  'einvoice.export': 'E-Dönüşüm dışa aktarım',
  'einvoice.markOfficial': 'Resmi belge no / gönderildi işaretleme',
  'reports.view': 'Raporları görüntüleme',
  'excel.export': 'Excel dışa aktarım',
  'settings.edit': 'Ayarları değiştirme',
  'users.manage': 'Kullanıcı yönetimi',
  'backup.manage': 'Yedekleme/geri yükleme',
  'suppliers.view': 'Tedarikçi görüntüleme',
  'suppliers.edit': 'Tedarikçi ve alış belgesi düzenleme',
  'suppliers.payments': 'Tedarikçi ödemesi yapma',
  'finance.view': 'Finans görüntüleme',
  'finance.edit': 'Finans işlemleri',
  'campaigns.view': 'Kampanya görüntüleme',
  'campaigns.edit': 'Kampanya oluşturma/düzenleme',
  'sales.manual_discount': 'Manuel indirim uygulama',
  'appointments.view': 'Randevu görüntüleme',
  'appointments.edit': 'Randevu oluşturma/düzenleme',
  'communications.view': 'İletişim geçmişi görüntüleme',
  'communications.edit': 'Mesaj hazırlama',
  'uts.view': 'ÜTS operasyonları görüntüleme',
  'uts.edit': 'ÜTS operasyonu hazırlama',
  'uts.export': 'ÜTS Excel dışa aktarım',
  'uts.markProcessed': 'ÜTS\'de işlendi işaretleme',
};

export interface UserSession {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: Permission[];
  mustChangePassword: boolean;
}

export interface SecuritySettings {
  autoLockMinutes: number;
}

export const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Kapalı' },
  { value: 5, label: '5 dakika' },
  { value: 10, label: '10 dakika' },
  { value: 30, label: '30 dakika' },
  { value: 60, label: '1 saat' },
] as const;

export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[] | null> = {
  '/dashboard': PERMISSIONS.DASHBOARD_VIEW,
  '/firma': PERMISSIONS.SETTINGS_EDIT,
  '/stok': PERMISSIONS.STOCK_VIEW,
  '/optik-tanimlar': PERMISSIONS.SETTINGS_EDIT,
  '/stok-giris': PERMISSIONS.STOCK_EDIT,
  '/stok-sayim': PERMISSIONS.STOCK_EDIT,
  '/tedarikciler': PERMISSIONS.SUPPLIERS_VIEW,
  '/musteri': PERMISSIONS.CUSTOMERS_VIEW,
  '/randevular': PERMISSIONS.APPOINTMENTS_VIEW,
  '/recete': PERMISSIONS.PRESCRIPTIONS_VIEW,
  '/satislar': PERMISSIONS.SALES_CREATE,
  '/iade': PERMISSIONS.RETURNS_CREATE,
  '/medula': PERMISSIONS.MEDULA_VIEW,
  '/e-donusum': PERMISSIONS.EINVOICE_VIEW,
  '/satis': PERMISSIONS.SALES_CREATE,
  '/kasa': PERMISSIONS.CASH_VIEW,
  '/banka-pos': PERMISSIONS.FINANCE_VIEW,
  '/giderler': PERMISSIONS.FINANCE_VIEW,
  '/acik-hesaplar': PERMISSIONS.FINANCE_VIEW,
  '/ekstreler': PERMISSIONS.FINANCE_VIEW,
  '/kar-zarar': PERMISSIONS.FINANCE_VIEW,
  '/kampanyalar': PERMISSIONS.CAMPAIGN_VIEW,
  '/raporlar': PERMISSIONS.REPORTS_VIEW,
  '/yedekleme': PERMISSIONS.BACKUP_MANAGE,
  '/kullanicilar': PERMISSIONS.USERS_MANAGE,
  '/ayarlar': PERMISSIONS.SETTINGS_EDIT,
};

const REMEMBER_KEY = 'woontegra_remembered_username';

export function getRememberedUsername(): string {
  return localStorage.getItem(REMEMBER_KEY) || '';
}

export function setRememberedUsername(username: string, remember: boolean): void {
  if (remember) localStorage.setItem(REMEMBER_KEY, username);
  else localStorage.removeItem(REMEMBER_KEY);
}
