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
  REPORTS_VIEW: 'reports.view',
  EXCEL_EXPORT: 'excel.export',
  SETTINGS_EDIT: 'settings.edit',
  USERS_MANAGE: 'users.manage',
  BACKUP_MANAGE: 'backup.manage',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_EDIT: 'suppliers.edit',
  SUPPLIER_PAYMENTS: 'suppliers.payments',
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
  'reports.view': 'Raporları görüntüleme',
  'excel.export': 'Excel dışa aktarım',
  'settings.edit': 'Ayarları değiştirme',
  'users.manage': 'Kullanıcı yönetimi',
  'backup.manage': 'Yedekleme/geri yükleme',
  'suppliers.view': 'Tedarikçi görüntüleme',
  'suppliers.edit': 'Tedarikçi ve alış belgesi düzenleme',
  'suppliers.payments': 'Tedarikçi ödemesi yapma',
};

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const SALES_STAFF: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.SALES_CREATE,
  PERMISSIONS.RETURNS_CREATE,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_EDIT,
  PERMISSIONS.PRESCRIPTIONS_VIEW,
  PERMISSIONS.PRESCRIPTIONS_EDIT,
  PERMISSIONS.MEDULA_VIEW,
];

const CASH_STAFF: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.CASH_VIEW,
  PERMISSIONS.CASH_EDIT,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.SUPPLIER_PAYMENTS,
];

const STOCK_STAFF: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.STOCK_EDIT,
  PERMISSIONS.STOCK_DELETE,
  PERMISSIONS.EXCEL_EXPORT,
  PERMISSIONS.SUPPLIERS_VIEW,
  PERMISSIONS.SUPPLIERS_EDIT,
];

const REPORT_USER: Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.EXCEL_EXPORT,
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.MEDULA_VIEW,
];

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  Yönetici: ALL_PERMISSIONS,
  'Satış Personeli': SALES_STAFF,
  'Kasa Personeli': CASH_STAFF,
  'Stok Personeli': STOCK_STAFF,
  'Rapor Kullanıcısı': REPORT_USER,
};
