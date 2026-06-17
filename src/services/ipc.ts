import type {
  AddPaymentInput,
  CashMovementRow,
  CashSummary,
  CompleteSaleOptions,
  CustomerAccountMovement,
  DashboardStats,
  IpcResult,
  PaymentType,
  Product,
  ProductInput,
  ProductListFilters,
  SaleDetail,
  SaleLineItem,
  SaleListFilters,
  SaleListItem,
  CashPaymentType,
} from '@/types/electron';

class IpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcError';
  }
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.electronAPI) {
    throw new IpcError('Electron API kullanılamıyor. Uygulama Electron içinde çalıştırılmalıdır.');
  }
  const result: IpcResult<T> = await window.electronAPI.invoke(channel, ...args);
  if (!result.success) {
    throw new IpcError(result.error || 'Bilinmeyen hata oluştu');
  }
  return result.data as T;
}

export const ipc = {
  barcode: {
    parse: (rawCode: string) => invoke<import('@/types/barcode').ParsedBarcode>('barcode:parse', rawCode),
  },
  license: {
    getStatus: () => invoke<import('@/types/license').LicenseStatusResult>('license:getStatus'),
    activate: (input: { licenseKey: string; companyName?: string; customerEmail?: string }) =>
      invoke<{ activated: boolean }>('license:activate', input),
    activateDemo: (input?: { companyName?: string; email?: string }) =>
      invoke<{ activated: boolean }>('license:activateDemo', input),
    revalidate: () => invoke<{ validated: boolean; warning?: string }>('license:revalidate'),
    getInfo: () =>
      invoke<{ info: import('@/types/license').LicenseInfoView | null; status: import('@/types/license').LicenseStatusResult }>(
        'license:getInfo'
      ),
    changeKey: (input: { licenseKey: string; companyName?: string; customerEmail?: string }) =>
      invoke<{ changed: boolean }>('license:changeKey', input),
    copyInfo: () => invoke<{ text: string }>('license:copyInfo'),
    getDeviceInfo: () => invoke<{ deviceName: string; deviceHash: string }>('license:getDeviceInfo'),
  },
  auth: {
    login: (input: { username: string; password: string }) =>
      invoke<import('@/types/auth').UserSession>('auth:login', input),
    logout: () => invoke<{ loggedOut: boolean }>('auth:logout'),
    getSession: () => invoke<import('@/types/auth').UserSession | null>('auth:getSession'),
    changePassword: (input: { currentPassword: string; newPassword: string }) =>
      invoke<{ changed: boolean; mustChangePassword: boolean }>('auth:changePassword', input),
    unlock: (password: string) => invoke<import('@/types/auth').UserSession>('auth:unlock', password),
    getSecurity: () => invoke<import('@/types/auth').SecuritySettings>('settings:getSecurity'),
    updateSecurity: (settings: import('@/types/auth').SecuritySettings) =>
      invoke<{ saved: boolean }>('settings:updateSecurity', settings),
    getPermissions: () =>
      invoke<{ role: string; permissions: string[]; roleDefaults: string[] } | null>('permissions:getCurrent'),
  },
  users: {
    list: () => invoke<import('@/types/auth').UserSession[]>('users:list'),
    getById: (id: number) => invoke<Record<string, unknown> | null>('users:getById', id),
    create: (input: Record<string, unknown>) => invoke<{ id: number }>('users:create', input),
    update: (id: number, input: Record<string, unknown>) => invoke<{ id: number }>('users:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('users:deactivate', id),
    resetPassword: (id: number, newPassword: string) =>
      invoke<{ reset: boolean }>('users:resetPassword', { id, newPassword }),
  },
  audit: {
    list: (filters?: Record<string, unknown>) => invoke<unknown[]>('audit:list', filters),
  },
  products: {
    list: (filters?: ProductListFilters) => invoke<Product[]>('products:list', filters),
    getById: (id: number) => invoke<Product | null>('products:getById', id),
    findByBarcode: (barcode: string, activeOnly = false) =>
      invoke<Product | null>('products:findByBarcode', barcode, activeOnly),
    resolveScan: (rawCode: string, activeOnly = false) =>
      invoke<import('@/types/barcode').ScanResolveResult>('products:resolveScan', rawCode, activeOnly),
    create: (input: ProductInput) => invoke<{ id: number }>('products:create', input),
    update: (id: number, input: ProductInput) => invoke<{ id: number }>('products:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('products:deactivate', id),
    delete: (id: number) => invoke<{ id: number }>('products:delete', id),
    selectImportFile: () =>
      invoke<import('@/types/importExport').ParsedImportFile | null>('products:selectImportFile'),
    previewImport: (payload: { rows: Record<string, string>[]; mapping: import('@/types/importExport').ColumnMapping }) =>
      invoke<import('@/types/importExport').ImportPreviewResult>('products:previewImport', payload),
    importFromExcel: (payload: {
      rows: Record<string, string>[];
      mapping: import('@/types/importExport').ColumnMapping;
      duplicateAction: import('@/types/importExport').DuplicateBarcodeAction;
    }) => invoke<import('@/types/importExport').ImportResult>('products:importFromExcel', payload),
    exportToExcel: () => invoke<{ exported: boolean; filePath?: string }>('products:exportToExcel'),
    downloadImportTemplate: () => invoke<{ saved: boolean; filePath?: string }>('products:downloadImportTemplate'),
  },
  opticalLookups: {
    list: (filters?: import('@/types/opticalLookup').OpticalLookupListFilters) =>
      invoke<Record<string, unknown>[]>('opticalLookups:list', filters),
    listByType: (type: import('@/types/opticalLookup').OpticalLookupType) =>
      invoke<Record<string, unknown>[]>('opticalLookups:listByType', type),
    listChildren: (parentId: number) => invoke<Record<string, unknown>[]>('opticalLookups:listChildren', parentId),
    create: (input: import('@/types/opticalLookup').OpticalLookupInput) =>
      invoke<{ id: number }>('opticalLookups:create', input),
    update: (id: number, input: Partial<import('@/types/opticalLookup').OpticalLookupInput>) =>
      invoke<{ id: number }>('opticalLookups:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('opticalLookups:deactivate', id),
    logTranspose: (payload: Record<string, unknown>) => invoke<{ ok: boolean }>('opticalLookups:logTranspose', payload),
  },
  sales: {
    list: (filters?: SaleListFilters) => invoke<SaleListItem[]>('sales:list', filters),
    getById: (id: number) => invoke<SaleDetail | null>('sales:getById', id),
    complete: (items: SaleLineItem[], options: CompleteSaleOptions) =>
      invoke<{ saleId: number; saleNo: string }>('sales:complete', {
        items: items.map((i) => ({
          productId: i.productId,
          barcode: i.barcode,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineNote: i.note,
        })),
        paymentMode: options.paymentMode,
        paymentType: options.paymentType,
        paidAmount: options.paidAmount,
        customerId: options.customerId ?? null,
        prescriptionId: options.prescriptionId ?? null,
      }),
    addPayment: (input: AddPaymentInput) => invoke<{ paymentId: number }>('sales:addPayment', input),
    cancel: (input: import('@/types/returns').CancelSaleInput) =>
      invoke<{ cancelled: boolean; message: string }>('sales:cancel', input),
    listByCustomer: (customerId: number) => invoke<unknown[]>('sales:listByCustomer', customerId),
  },
  customers: {
    list: (filters?: import('@/types/electron').CustomerListFilters) =>
      invoke<import('@/types/electron').Customer[]>('customers:list', filters),
    search: (query: string) => invoke<import('@/types/electron').Customer[]>('customers:search', query),
    getById: (id: number) => invoke<import('@/types/electron').Customer | null>('customers:getById', id),
    create: (input: import('@/types/electron').CustomerInput) =>
      invoke<{ id: number }>('customers:create', input),
    createQuick: (input: import('@/types/electron').CustomerQuickInput) =>
      invoke<{ id: number }>('customers:createQuick', input),
    update: (id: number, input: import('@/types/electron').CustomerInput) =>
      invoke<{ id: number }>('customers:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('customers:deactivate', id),
    getSales: (customerId: number) => invoke<import('@/types/electron').CustomerSale[]>('customers:getSales', customerId),
    getAccountMovements: (customerId: number) =>
      invoke<CustomerAccountMovement[]>('customers:getAccountMovements', customerId),
  },
  customerAccount: {
    getBalance: (customerId: number) => invoke<{ balance: number }>('customerAccount:getBalance', customerId),
    listMovements: (customerId: number) =>
      invoke<CustomerAccountMovement[]>('customerAccount:listMovements', customerId),
  },
  prescriptions: {
    list: (filters?: import('@/types/electron').PrescriptionListFilters) =>
      invoke<import('@/types/electron').Prescription[]>('prescriptions:list', filters),
    getById: (id: number) => invoke<import('@/types/electron').Prescription | null>('prescriptions:getById', id),
    listByCustomer: (customerId: number, activeOnly = false) =>
      invoke<import('@/types/electron').Prescription[]>('prescriptions:listByCustomer', customerId, activeOnly),
    create: (input: import('@/types/electron').PrescriptionInput) =>
      invoke<{ id: number; prescription_no: string }>('prescriptions:create', input),
    update: (id: number, input: import('@/types/electron').PrescriptionInput) =>
      invoke<{ id: number }>('prescriptions:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('prescriptions:deactivate', id),
  },
  dashboard: {
    getStats: () => invoke<DashboardStats>('dashboard:getStats'),
  },
  cash: {
    getSummary: () => invoke<CashSummary>('cash:getSummary'),
    listMovements: (filters?: { date_from?: string; date_to?: string }) =>
      invoke<CashMovementRow[]>('cash:listMovements', filters),
    addIncome: (input: {
      amount: number;
      paymentType: CashPaymentType;
      description?: string;
      customerId?: number;
    }) => invoke<{ id: number }>('cash:addIncome', input),
    addExpense: (input: {
      amount: number;
      paymentType: CashPaymentType;
      description: string;
      category?: string;
    }) => invoke<{ id: number }>('cash:addExpense', input),
    list: () => invoke<CashMovementRow[]>('cash:list'),
  },
  backup: {
    getSettings: () =>
      invoke<{
        autoBackupEnabled: boolean;
        backupFolder: string;
        backupFrequency: string;
        lastBackupAt: string | null;
        dbPath: string;
      }>('backup:getSettings'),
    setAutoBackup: (enabled: boolean) => invoke<{ saved: boolean }>('backup:setAutoBackup', enabled),
    setFrequency: (frequency: 'on_close' | 'daily' | 'weekly') =>
      invoke<{ saved: boolean }>('backup:setFrequency', frequency),
    selectFolder: () => invoke<{ folder: string | null }>('backup:selectFolder'),
    create: (folder?: string) => invoke<{ backupPath: string; size: number }>('backup:create', folder),
    restore: () =>
      invoke<{ restored: boolean; message?: string; needsRestart?: boolean; safetyBackupPath?: string }>(
        'backup:restore'
      ),
    list: () => invoke<unknown[]>('backup:list'),
  },
  app: {
    getDbPath: () => invoke<{ path: string }>('app:getDbPath'),
    getVersion: () => invoke<{ version: string; name: string }>('app:getVersion'),
    getAbout: () =>
      invoke<{
        appName: string;
        version: string;
        licenseStatus: string;
        licenseMasked: string;
        dbPath: string;
        backupFolder: string;
        lastBackupAt: string | null;
        supportEmail: string;
        copyright: string;
        logsPath: string;
      }>('app:getAbout'),
    openLogsFolder: () => invoke<{ opened: boolean; path: string }>('app:openLogsFolder'),
    openDbFolder: () => invoke<{ opened: boolean; path: string }>('app:openDbFolder'),
    relaunch: () => invoke<{ relaunching: boolean }>('app:relaunch'),
  },
  db: {
    integrityCheck: () => invoke<{ ok: boolean; message: string }>('db:integrityCheck'),
    vacuum: () => invoke<{ ok: boolean; message: string; dbPath: string }>('db:vacuum'),
    clearDemoData: () =>
      invoke<{ products: number; customers: number; prescriptions: number; stockMovements: number; message: string }>(
        'db:clearDemoData'
      ),
  },
  suppliers: {
    list: (activeOnly = true) => invoke<Record<string, unknown>[]>('suppliers:list', activeOnly),
    getById: (id: number) => invoke<Record<string, unknown> | null>('suppliers:getById', id),
    create: (input: Record<string, unknown>) => invoke<{ id: number }>('suppliers:create', input),
    update: (id: number, input: Record<string, unknown>) => invoke<{ id: number }>('suppliers:update', id, input),
    deactivate: (id: number) => invoke<{ id: number }>('suppliers:deactivate', id),
    getAccountMovements: (supplierId: number) =>
      invoke<Record<string, unknown>[]>('suppliers:getAccountMovements', supplierId),
    addPayment: (input: Record<string, unknown>) => invoke<{ paymentId: number }>('suppliers:addPayment', input),
    printStatement: (supplierId: number) => invoke<{ html: string; title: string }>('suppliers:printStatement', supplierId),
  },
  purchases: {
    list: (filters?: Record<string, unknown>) => invoke<Record<string, unknown>[]>('purchases:list', filters),
    getById: (id: number) => invoke<Record<string, unknown> | null>('purchases:getById', id),
    create: (input: Record<string, unknown>) =>
      invoke<{ id: number; documentNo: string }>('purchases:create', input),
    createFromStockEntry: (batchId: number, input: Record<string, unknown>) =>
      invoke<{ id: number; documentNo: string }>('purchases:createFromStockEntry', batchId, input),
    cancel: (id: number, input: { cancel_reason: string }) =>
      invoke<{ cancelled: boolean }>('purchases:cancel', id, input),
    addPayment: (input: Record<string, unknown>) => invoke<{ paymentId: number }>('purchases:addPayment', input),
    listBySupplier: (supplierId: number) => invoke<Record<string, unknown>[]>('purchases:listBySupplier', supplierId),
    listStockEntryCandidates: () => invoke<Record<string, unknown>[]>('purchases:listStockEntryCandidates'),
    getStockEntryLines: (batchId: number) => invoke<Record<string, unknown>[]>('purchases:getStockEntryLines', batchId),
    print: (id: number) => invoke<{ html: string; title: string }>('purchases:print', id),
    exportExcel: (id: number) => invoke<{ exported: boolean; filePath?: string }>('purchases:exportExcel', id),
  },
  stockEntry: {
    complete: (input: {
      supplier_id?: number | null;
      document_no?: string;
      entry_date: string;
      notes?: string;
      items: Array<{
        product_id: number;
        barcode?: string;
        quantity: number;
        purchase_price: number;
        sale_price: number;
        shelf_location?: string;
        update_prices?: boolean;
      }>;
    }) =>
      invoke<{
        batchId: number;
        batchNo: string;
        totalItems: number;
        totalQuantity: number;
        totalCost: number;
        productIds: number[];
      }>('stockEntry:complete', input),
    listBatches: (filters?: { date_from?: string; date_to?: string; supplier_id?: number; search?: string }) =>
      invoke<unknown[]>('stockEntry:listBatches', filters),
    getBatch: (batchId: number) => invoke<Record<string, unknown> | null>('stockEntry:getBatch', batchId),
    print: (batchId: number) => invoke<{ html: string; title: string }>('stockEntry:print', batchId),
    exportExcel: (batchId: number) => invoke<{ exported: boolean; filePath?: string }>('stockEntry:exportExcel', batchId),
  },
  inventory: {
    createCount: (input: import('@/types/inventoryCount').CreateCountInput) =>
      invoke<import('@/types/inventoryCount').CountDetail>('inventory:createCount', input),
    getActiveCount: () => invoke<import('@/types/inventoryCount').CountDetail | null>('inventory:getActiveCount'),
    getCountById: (countId: number) =>
      invoke<import('@/types/inventoryCount').CountDetail>('inventory:getCountById', countId),
    listCounts: (filters?: { date_from?: string; date_to?: string; status?: string; search?: string }) =>
      invoke<import('@/types/inventoryCount').CountListRow[]>('inventory:listCounts', filters),
    scanCode: (countId: number, rawCode: string) =>
      invoke<import('@/types/inventoryCount').ScanCodeResult>('inventory:scanCode', countId, rawCode),
    updateItemQuantity: (countId: number, input: { item_id: number; counted_quantity: number; note?: string }) =>
      invoke<{ item: import('@/types/inventoryCount').CountItemRow; summary: import('@/types/inventoryCount').CountSummary }>(
        'inventory:updateItemQuantity',
        countId,
        input
      ),
    saveDraft: (countId: number) => invoke<{ saved: boolean }>('inventory:saveDraft', countId),
    completeCount: (countId: number) =>
      invoke<import('@/types/inventoryCount').CountDetail>('inventory:completeCount', countId),
    applyAdjustments: (countId: number) =>
      invoke<{ adjustedItems: number; countNo: string }>('inventory:applyAdjustments', countId),
    cancelCount: (countId: number) => invoke<{ cancelled: boolean }>('inventory:cancelCount', countId),
    addUnknownScan: (countId: number, rawCode: string, note?: string) =>
      invoke<{ unknown: import('@/types/inventoryCount').UnknownScanRow; detail: import('@/types/inventoryCount').CountDetail }>(
        'inventory:addUnknownScan',
        countId,
        rawCode,
        note
      ),
    resolveUnknownScan: (
      countId: number,
      input: { unknown_id: number; action: 'link' | 'remove'; product_id?: number }
    ) => invoke<import('@/types/inventoryCount').CountDetail | { removed: boolean }>(
      'inventory:resolveUnknownScan',
      countId,
      input
    ),
    printReport: (countId: number) => invoke<{ html: string; title: string }>('inventory:printReport', countId),
    exportExcel: (countId: number) => invoke<{ exported: boolean; filePath?: string }>('inventory:exportExcel', countId),
  },
  company: {
    get: () => invoke<unknown | null>('company:get'),
    update: (data: Record<string, unknown>) => invoke<{ saved: boolean }>('company:update', data),
  },
  settings: {
    getAll: () => invoke<Record<string, string>>('settings:getAll'),
    getCompany: () => invoke<Record<string, unknown> | null>('settings:getCompany'),
    updateCompany: (data: Record<string, unknown>) => invoke<{ saved: boolean }>('settings:updateCompany', data),
    selectLogo: () => invoke<{ path: string | null }>('settings:selectLogo'),
    getLabelSettings: () => invoke<import('@/types/importExport').LabelSettings>('settings:getLabelSettings'),
    updateLabelSettings: (settings: Partial<import('@/types/importExport').LabelSettings>) =>
      invoke<{ saved: boolean }>('settings:updateLabelSettings', settings),
  },
  returns: {
    list: (filters?: import('@/types/returns').ReturnListFilters) =>
      invoke<import('@/types/returns').ReturnListItem[]>('returns:list', filters),
    getById: (id: number) => invoke<import('@/types/returns').ReturnDetail | null>('returns:getById', id),
    create: (input: import('@/types/returns').CreateReturnInput) =>
      invoke<{ returnId: number; returnNo: string }>('returns:create', input),
    listBySale: (saleId: number) =>
      invoke<import('@/types/returns').SaleReturnHistory[]>('returns:listBySale', saleId),
    searchSale: (query: string) =>
      invoke<import('@/types/returns').SaleSearchResult[]>('returns:searchSale', query),
  },
  print: {
    saleReceipt: (saleId: number) => invoke<import('@/types/returns').PrintDocument>('print:saleReceipt', saleId),
    paymentReceipt: (paymentId: number) =>
      invoke<import('@/types/returns').PrintDocument>('print:paymentReceipt', paymentId),
    returnReceipt: (returnId: number) =>
      invoke<import('@/types/returns').PrintDocument>('print:returnReceipt', returnId),
  },
  labels: {
    preview: (input: {
      items: import('@/types/importExport').LabelItemInput[];
      template?: import('@/types/importExport').LabelTemplate;
      allowNoBarcode?: boolean;
    }) => invoke<import('@/types/importExport').PrintDocument>('labels:preview', input),
    print: (input: {
      items: import('@/types/importExport').LabelItemInput[];
      template?: import('@/types/importExport').LabelTemplate;
      allowNoBarcode?: boolean;
    }) => invoke<import('@/types/importExport').PrintDocument>('labels:print', input),
  },
  medula: {
    listReadyRecords: (filters?: import('@/types/medula').MedulaListFilters) =>
      invoke<import('@/types/medula').MedulaRecordListItem[]>('medula:listReadyRecords', filters),
    getRecordDetail: (saleId: number) => invoke<Record<string, unknown> | null>('medula:getRecordDetail', saleId),
    validateRecord: (saleId: number) =>
      invoke<import('@/types/medula').MedulaValidationResult>('medula:validateRecord', saleId),
    exportExcel: (saleIds: number[], force?: boolean) =>
      invoke<{ exported: boolean; filePath?: string; exportId?: number }>('medula:exportExcel', { saleIds, force }),
    exportCsv: (saleIds: number[], force?: boolean) =>
      invoke<{ exported: boolean; filePath?: string }>('medula:exportCsv', { saleIds, force }),
    exportTxt: (saleIds: number[], force?: boolean) =>
      invoke<{ exported: boolean; filePath?: string }>('medula:exportTxt', { saleIds, force }),
    markExported: (saleIds: number[]) => invoke<{ updated: number }>('medula:markExported', saleIds),
    markUploaded: (saleIds: number[]) => invoke<{ updated: number }>('medula:markUploaded', saleIds),
    listExports: () => invoke<unknown[]>('medula:listExports'),
  },
  uts: {
    listRecords: (filters?: import('@/types/medula').UtsListFilters) =>
      invoke<import('@/types/medula').UtsRecord[]>('uts:listRecords', filters),
    updateStatus: (productId: number, status: import('@/types/medula').UtsStatus, note?: string) =>
      invoke<{ id: number }>('uts:updateStatus', { productId, status, note }),
    exportExcel: (filters?: import('@/types/medula').UtsListFilters) =>
      invoke<{ exported: boolean; filePath?: string; recordCount?: number }>('uts:exportExcel', filters),
  },
  titubb: {
    listPending: (filters?: import('@/types/titubb').TitubbListFilters) =>
      invoke<import('@/types/titubb').TitubbPendingRow[]>('titubb:listPending', filters),
    validateRows: (rowKeys: string[]) =>
      invoke<import('@/types/titubb').TitubbValidateResult>('titubb:validateRows', rowKeys),
    exportExcel: (input: { row_keys: string[]; allow_incomplete?: boolean; notes?: string }) =>
      invoke<{ exported: boolean; exportId?: number; exportNo?: string; recordCount?: number; filePath?: string; warnings?: string[] }>(
        'titubb:exportExcel',
        input
      ),
    listExports: () => invoke<Record<string, unknown>[]>('titubb:listExports'),
    getExportDetail: (exportId: number) => invoke<Record<string, unknown> | null>('titubb:getExportDetail', exportId),
    markUploaded: (exportId: number) => invoke<{ updated: number }>('titubb:markUploaded', exportId),
    markIgnored: (input: { row_keys: string[]; notes?: string }) => invoke<{ ignored: number }>('titubb:markIgnored', input),
    countPending: () => invoke<{ count: number }>('titubb:countPending'),
  },
  reports: {
    getDayEnd: (filter?: import('@/types/reports').DayEndFilter) =>
      invoke<Record<string, unknown>>('reports:getDayEnd', filter),
    getSalesReport: (filters?: import('@/types/reports').SalesReportFilter) =>
      invoke<Record<string, unknown>>('reports:getSalesReport', filters),
    getCashReport: (filters?: import('@/types/reports').CashReportFilter) =>
      invoke<Record<string, unknown>>('reports:getCashReport', filters),
    getStockReport: (filters?: import('@/types/reports').StockReportFilter) =>
      invoke<Record<string, unknown>>('reports:getStockReport', filters),
    getCustomerAccountReport: (filters?: import('@/types/reports').CustomerAccountReportFilter) =>
      invoke<Record<string, unknown>>('reports:getCustomerAccountReport', filters),
    getPrescriptionMedulaReport: (filters?: import('@/types/reports').PrescriptionMedulaReportFilter) =>
      invoke<Record<string, unknown>>('reports:getPrescriptionMedulaReport', filters),
    getReturnCancelReport: (filters?: import('@/types/reports').ReturnCancelReportFilter) =>
      invoke<Record<string, unknown>>('reports:getReturnCancelReport', filters),
    getPurchaseReport: (filters?: Record<string, unknown>) =>
      invoke<Record<string, unknown>>('reports:getPurchaseReport', filters),
    getSupplierAccountReport: (filters?: Record<string, unknown>) =>
      invoke<Record<string, unknown>>('reports:getSupplierAccountReport', filters),
    exportExcel: (payload: { fileName: string; rows: Record<string, unknown>[]; sheetName?: string }) =>
      invoke<{ exported: boolean; filePath?: string }>('reports:exportExcel', payload),
    print: (payload: import('@/types/reports').PrintReportPayload) =>
      invoke<{ html: string; title: string }>('reports:print', payload),
  },
};

export { IpcError };
