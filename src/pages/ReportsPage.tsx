import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import SaleDetail from '@/components/sales/SaleDetail';
import CustomerDetail from '@/components/customers/CustomerDetail';
import {
  REPORT_TAB_LABELS,
  STOCK_REPORT_TYPES,
  defaultRange30,
  reportFileName,
  todayIso,
  type ReportTab,
  type StockReportType,
} from '@/types/reports';
import { PRODUCT_TYPES, CASH_PAYMENT_TYPES } from '@/types/electron';
import { PAYMENT_STATUSES, SALE_STATUSES } from '@/types/sales';
import { MEDULA_STATUSES, PRESCRIPTION_TYPES } from '@/types/medula';
import PageTitleBar from '@/components/layout/PageTitleBar';

const TABS: ReportTab[] = [
  'dayEnd',
  'sales',
  'cash',
  'stock',
  'purchase',
  'supplierAccount',
  'customerAccount',
  'prescriptionMedula',
  'returnCancel',
  'utsOperations',
  'edonusum',
];

type LookupRow = { id: number; name: string; parent_id?: number | null };

function SummaryRow({ items }: { items: Array<{ label: string; value: string; negative?: boolean }> }) {
  return (
    <div className="stat-grid-6" style={{ marginBottom: 8 }}>
      {items.map((item) => (
        <div className="stat-box" key={item.label}>
          <div className="stat-label">{item.label}</div>
          <div className={`stat-value${item.negative ? ' amount-negative' : ''}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ActionBar({
  onLoad,
  onExport,
  onPrint,
  loading,
}: {
  onLoad: () => void;
  onExport: () => void;
  onPrint: () => void;
  loading: boolean;
}) {
  return (
    <div className="form-actions" style={{ marginBottom: 8 }}>
      <button className="btn btn-primary" onClick={onLoad} disabled={loading}>
        {loading ? 'Yükleniyor...' : 'Listele'}
      </button>
      <button className="btn" onClick={onExport} disabled={loading}>
        Excel&apos;e Aktar
      </button>
      <button className="btn" onClick={onPrint} disabled={loading}>
        Yazdır
      </button>
    </div>
  );
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as ReportTab) || 'dayEnd';
  const [tab, setTab] = useState<ReportTab>(TABS.includes(initialTab) ? initialTab : 'dayEnd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [saleDetailId, setSaleDetailId] = useState<number | null>(null);
  const [customerDetailId, setCustomerDetailId] = useState<number | null>(null);

  const range = defaultRange30();
  const [dayDate, setDayDate] = useState(todayIso());
  const [dateFrom, setDateFrom] = useState(range.date_from);
  const [dateTo, setDateTo] = useState(range.date_to);

  const [customerSearch, setCustomerSearch] = useState('');
  const [productType, setProductType] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [saleStatus, setSaleStatus] = useState('');
  const [movementType, setMovementType] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  const [stockReportType, setStockReportType] = useState<StockReportType>(
    (searchParams.get('stockType') as StockReportType) || 'current'
  );
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [shelfLocation, setShelfLocation] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(searchParams.get('critical') === '1');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [subgroupId, setSubgroupId] = useState<number | ''>('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [modelId, setModelId] = useState<number | ''>('');
  const [colorId, setColorId] = useState<number | ''>('');
  const [lensTypeId, setLensTypeId] = useState<number | ''>('');
  const [lensMaterialId, setLensMaterialId] = useState<number | ''>('');
  const [lensCoatingId, setLensCoatingId] = useState<number | ''>('');
  const [lotNo, setLotNo] = useState('');
  const [expiryDaysMax, setExpiryDaysMax] = useState('');
  const [sphFrom, setSphFrom] = useState('');
  const [sphTo, setSphTo] = useState('');
  const [cylFrom, setCylFrom] = useState('');
  const [cylTo, setCylTo] = useState('');
  const [axisFrom, setAxisFrom] = useState('');
  const [axisTo, setAxisTo] = useState('');
  const [addFrom, setAddFrom] = useState('');
  const [addTo, setAddTo] = useState('');
  const [diameter, setDiameter] = useState('');
  const [baseCurve, setBaseCurve] = useState('');
  const [groupLookups, setGroupLookups] = useState<LookupRow[]>([]);
  const [subgroupLookups, setSubgroupLookups] = useState<LookupRow[]>([]);
  const [brandLookups, setBrandLookups] = useState<LookupRow[]>([]);
  const [modelLookups, setModelLookups] = useState<LookupRow[]>([]);
  const [colorLookups, setColorLookups] = useState<LookupRow[]>([]);
  const [lensTypeLookups, setLensTypeLookups] = useState<LookupRow[]>([]);
  const [lensMaterialLookups, setLensMaterialLookups] = useState<LookupRow[]>([]);
  const [lensCoatingLookups, setLensCoatingLookups] = useState<LookupRow[]>([]);
  const [balanceStatus, setBalanceStatus] = useState<'debt' | 'credit' | 'zero' | 'all'>(
    searchParams.get('balance') === 'debt' ? 'debt' : 'all'
  );
  const [rxType, setRxType] = useState('');
  const [medulaStatus, setMedulaStatus] = useState(searchParams.get('medulaStatus') || '');
  const [rxMissing, setRxMissing] = useState('');
  const [operationType, setOperationType] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [edonusumStatus, setEdonusumStatus] = useState('');
  const [edonusumDocType, setEdonusumDocType] = useState('');
  const [edonusumSourceType, setEdonusumSourceType] = useState('');

  const switchTab = (t: ReportTab) => {
    setTab(t);
    setData(null);
    setSearchParams({ tab: t });
  };

  useEffect(() => {
    ipc.opticalLookups.listByType('PRODUCT_GROUP').then((rows) => setGroupLookups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('BRAND').then((rows) => setBrandLookups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('COLOR').then((rows) => setColorLookups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_TYPE').then((rows) => setLensTypeLookups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_MATERIAL').then((rows) => setLensMaterialLookups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_COATING').then((rows) => setLensCoatingLookups(rows as LookupRow[])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (groupId === '') {
      setSubgroupLookups([]);
      setSubgroupId('');
      return;
    }
    ipc.opticalLookups
      .listChildren(groupId)
      .then((rows) => setSubgroupLookups((rows as LookupRow[]).filter((row) => row.parent_id === groupId)))
      .catch(() => setSubgroupLookups([]));
    setSubgroupId('');
  }, [groupId]);

  useEffect(() => {
    if (brandId === '') {
      setModelLookups([]);
      setModelId('');
      return;
    }
    ipc.opticalLookups
      .listChildren(brandId)
      .then((rows) => setModelLookups((rows as LookupRow[]).filter((row) => row.parent_id === brandId)))
      .catch(() => setModelLookups([]));
    setModelId('');
  }, [brandId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let result: Record<string, unknown>;
      switch (tab) {
        case 'dayEnd':
          result = await ipc.reports.getDayEnd({ date: dayDate });
          break;
        case 'sales':
          result = await ipc.reports.getSalesReport({
            date_from: dateFrom,
            date_to: dateTo,
            customer_search: customerSearch || undefined,
            product_type: productType || undefined,
            product_search: productSearch || undefined,
            payment_type: paymentType || undefined,
            payment_status: paymentStatus || undefined,
            status: saleStatus || undefined,
          });
          break;
        case 'cash':
          result = await ipc.reports.getCashReport({
            date_from: dateFrom,
            date_to: dateTo,
            payment_type: paymentType || undefined,
            movement_type: movementType || undefined,
            customer_search: customerSearch || undefined,
            description: cashDesc || undefined,
          });
          break;
        case 'stock':
          result = await ipc.reports.getStockReport({
            report_type: stockReportType,
            product_type: productType || undefined,
            brand: brand || undefined,
            category: category || undefined,
            critical_only: criticalOnly || stockReportType === 'critical',
            status: stockStatus || undefined,
            shelf_location: shelfLocation || undefined,
            search: stockSearch || undefined,
            date_from: dateFrom,
            date_to: dateTo,
            group_id: groupId === '' ? undefined : groupId,
            subgroup_id: subgroupId === '' ? undefined : subgroupId,
            brand_id: brandId === '' ? undefined : brandId,
            model_id: modelId === '' ? undefined : modelId,
            color_id: colorId === '' ? undefined : colorId,
            lens_type_id: lensTypeId === '' ? undefined : lensTypeId,
            lens_material_id: lensMaterialId === '' ? undefined : lensMaterialId,
            lens_coating_id: lensCoatingId === '' ? undefined : lensCoatingId,
            lot_no: lotNo || undefined,
            expiry_days_max: expiryDaysMax ? Number(expiryDaysMax) : undefined,
            sph_from: sphFrom || undefined,
            sph_to: sphTo || undefined,
            cyl_from: cylFrom || undefined,
            cyl_to: cylTo || undefined,
            axis_from: axisFrom || undefined,
            axis_to: axisTo || undefined,
            add_from: addFrom || undefined,
            add_to: addTo || undefined,
            diameter: diameter || undefined,
            base_curve: baseCurve || undefined,
          });
          break;
        case 'customerAccount':
          result = await ipc.reports.getCustomerAccountReport({
            date_from: dateFrom,
            date_to: dateTo,
            customer_search: customerSearch || undefined,
            balance_status: balanceStatus,
          });
          break;
        case 'prescriptionMedula':
          result = await ipc.reports.getPrescriptionMedulaReport({
            date_from: dateFrom,
            date_to: dateTo,
            prescription_type: rxType || undefined,
            medula_status: medulaStatus || undefined,
            customer_search: customerSearch || undefined,
            has_missing_fields: rxMissing === 'yes' ? true : rxMissing === 'no' ? false : undefined,
          });
          break;
        case 'returnCancel':
          result = await ipc.reports.getReturnCancelReport({
            date_from: dateFrom,
            date_to: dateTo,
            operation_type: operationType || undefined,
            customer_search: customerSearch || undefined,
            product_search: productSearch || undefined,
            reason: returnReason || undefined,
          });
          break;
        case 'purchase':
          result = await ipc.reports.getPurchaseReport({
            date_from: dateFrom,
            date_to: dateTo,
            document_type: productType || undefined,
            payment_status: paymentStatus || undefined,
          });
          break;
        case 'supplierAccount':
          result = await ipc.reports.getSupplierAccountReport({
            search: customerSearch || undefined,
          });
          break;
        case 'utsOperations':
          result = await ipc.utsOperations.getReport({
            date_from: dateFrom,
            date_to: dateTo,
          });
          break;
        case 'edonusum':
          result = await ipc.reports.getEdonusumReport({
            date_from: dateFrom,
            date_to: dateTo,
            status: edonusumStatus || undefined,
            document_type: edonusumDocType || undefined,
            source_type: edonusumSourceType || undefined,
            customer_search: customerSearch || undefined,
          });
          break;
        default:
          result = {};
      }
      setData(result);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    dayDate,
    dateFrom,
    dateTo,
    customerSearch,
    productType,
    productSearch,
    paymentType,
    paymentStatus,
    saleStatus,
    movementType,
    cashDesc,
    stockReportType,
    brand,
    category,
    stockStatus,
    shelfLocation,
    stockSearch,
    criticalOnly,
    groupId,
    subgroupId,
    brandId,
    modelId,
    colorId,
    lensTypeId,
    lensMaterialId,
    lensCoatingId,
    lotNo,
    expiryDaysMax,
    sphFrom,
    sphTo,
    cylFrom,
    cylTo,
    axisFrom,
    axisTo,
    addFrom,
    addTo,
    diameter,
    baseCurve,
    balanceStatus,
    rxType,
    medulaStatus,
    rxMissing,
    operationType,
    returnReason,
    edonusumStatus,
    edonusumDocType,
    edonusumSourceType,
  ]);

  useEffect(() => {
    load();
  }, [tab]);

  const buildStockExportRows = () => {
    const rows = (data?.rows as Record<string, unknown>[]) || [];
    if (stockReportType === 'opticalDistribution' || stockReportType === 'brandStock') {
      return rows.map((r) => ({
        'Ana grup': String(r.group_name || '-'),
        'Alt grup': String(r.subgroup_name || '-'),
        Marka: String(r.brand_name || '-'),
        Model: String(r.model_name || '-'),
        'Ürün sayısı': Number(r.product_count || 0),
        'Toplam stok': Number(r.total_qty || 0),
        'Stok değeri': formatCurrency(Number(r.stock_sale_value || 0)),
      }));
    }
    if (stockReportType === 'lensExpiry') {
      return rows.map((r) => ({
        'Ürün adı': String(r.name || '-'),
        Barkod: String(r.barcode || '-'),
        Marka: String(r.brand_name || '-'),
        Model: String(r.model_name || '-'),
        'Lot no': String(r.lot_no || '-'),
        SKT: String(r.uts_expiry_date || '-'),
        'Kalan gün': Number(r.remaining_days || 0),
        Stok: Number(r.stock_quantity || 0),
        'Raf / konum': String(r.shelf_location || '-'),
      }));
    }
    if (stockReportType === 'opticalValues') {
      return rows.map((r) => ({
        'Ürün adı': String(r.name || '-'),
        SPH: String(r.sph || '-'),
        CYL: String(r.cyl || '-'),
        AXIS: String(r.axis || '-'),
        ADD: String(r.addition || '-'),
        'Çap': String(r.diameter || '-'),
        'Base Curve': String(r.base_curve || '-'),
        'Cam tipi': String(r.lens_type_name || '-'),
        'Cam materyali': String(r.lens_material_name || '-'),
        Kaplama: String(r.lens_coating_name || '-'),
        Stok: Number(r.stock_quantity || 0),
        'Raf / konum': String(r.shelf_location || '-'),
      }));
    }
    return rows.map((r) => ({
      Barkod: String(r.barcode || '-'),
      'Ürün adı': String(r.name || r.product_name || '-'),
      'Ürün tipi': String(r.product_type || '-'),
      'Ana grup': String(r.group_name || '-'),
      Marka: String(r.brand_name || r.brand || '-'),
      Model: String(r.model_name || r.model || '-'),
      Stok: Number(r.stock_quantity || 0),
      'Kritik stok': Number(r.min_stock || 0),
      'Alış fiyatı': formatCurrency(Number(r.purchase_price || 0)),
      'Satış fiyatı': formatCurrency(Number(r.sale_price || 0)),
      'Raf / konum': String(r.shelf_location || '-'),
    }));
  };

  const stockReportFileName = () => {
    switch (stockReportType) {
      case 'opticalDistribution':
        return reportFileName('optik-urun-dagilimi');
      case 'lensExpiry':
        return reportFileName('lens-skt-yaklasan');
      case 'opticalValues':
        return reportFileName('cam-degerlerine-gore-stok');
      case 'brandStock':
        return reportFileName('marka-bazli-stok');
      default:
        return reportFileName('stok-raporu');
    }
  };

  const buildPrintPayload = () => {
    const title = REPORT_TAB_LABELS[tab];
    const dateRange =
      tab === 'dayEnd'
        ? formatDate(dayDate)
        : `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;

    let summary: Array<{ label: string; value: string }> = [];
    let columns: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (tab === 'dayEnd' && data?.summary) {
      const s = data.summary as Record<string, number>;
      summary = [
        { label: 'Toplam Satış', value: formatCurrency(s.totalSales) },
        { label: 'Toplam Tahsilat', value: formatCurrency(s.totalCollection) },
        { label: 'Nakit', value: formatCurrency(s.cashCollection) },
        { label: 'Kredi Kartı', value: formatCurrency(s.cardCollection) },
        { label: 'Havale/EFT', value: formatCurrency(s.transferCollection) },
        { label: 'Açık Hesap', value: formatCurrency(s.openAccountSales) },
        { label: 'Gider', value: formatCurrency(s.expenseTotal) },
        { label: 'Net Kasa', value: formatCurrency(s.netCash) },
        { label: 'İade', value: formatCurrency(s.returnTotal) },
        { label: 'İptal Sayısı', value: String(s.cancelledCount) },
        { label: 'Satış Adedi', value: String(s.saleCount) },
        { label: 'Ürün Adedi', value: String(s.productQuantity) },
      ];
      columns = ['sale_no', 'customer_name', 'net_amount', 'payment_status', 'sale_date'];
      rows = ((data.tables as Record<string, unknown>)?.sales as Record<string, unknown>[]) || [];
      rows = rows.map((r) => ({
        sale_no: r.sale_no,
        customer_name: r.customer_name || 'Perakende',
        net_amount: formatCurrency(Number(r.net_amount)),
        payment_status: r.payment_status,
        sale_date: formatDateTime(String(r.sale_date)),
      }));
    } else if (data?.summary) {
      const s = data.summary as Record<string, number>;
      if (tab === 'sales') {
        summary = [
          { label: 'Toplam Satış', value: formatCurrency(s.totalSales) },
          { label: 'Toplam Tahsilat', value: formatCurrency(s.totalCollection) },
          { label: 'Açık Hesap', value: formatCurrency(s.openAccountRemaining) },
          { label: 'Satış Adedi', value: String(s.saleCount) },
          { label: 'Ürün Adedi', value: String(s.productQuantity) },
          { label: 'Ortalama', value: formatCurrency(s.averageSale) },
        ];
        columns = ['sale_date', 'sale_no', 'customer_name', 'item_count', 'net_amount', 'paid_amount', 'remaining_amount', 'payment_status', 'payment_types', 'status'];
        rows = ((data.rows as Record<string, unknown>[]) || []).map((r) => ({
          sale_date: formatDateTime(String(r.sale_date)),
          sale_no: r.sale_no,
          customer_name: r.customer_name || 'Perakende',
          item_count: r.item_count,
          net_amount: formatCurrency(Number(r.net_amount)),
          paid_amount: formatCurrency(Number(r.paid_amount)),
          remaining_amount: formatCurrency(Number(r.remaining_amount)),
          payment_status: r.payment_status,
          payment_types: r.payment_types || '-',
          status: r.status,
        }));
      } else if (tab === 'cash') {
        summary = [
          { label: 'Toplam Giriş', value: formatCurrency(s.totalIncome) },
          { label: 'Toplam Çıkış', value: formatCurrency(s.totalExpense) },
          { label: 'Net Kasa', value: formatCurrency(s.netCash) },
          { label: 'Nakit', value: formatCurrency(s.cashTotal) },
          { label: 'Kredi Kartı', value: formatCurrency(s.cardTotal) },
          { label: 'Havale/EFT', value: formatCurrency(s.transferTotal) },
        ];
        columns = ['movement_date', 'movement_type', 'payment_type', 'customer_name', 'description', 'income', 'expense', 'net'];
        rows = ((data.rows as Record<string, unknown>[]) || []).map((r) => ({
          movement_date: formatDateTime(String(r.movement_date)),
          movement_type: r.movement_type,
          payment_type: r.payment_type,
          customer_name: r.customer_name || '-',
          description: r.description || '-',
          income: formatCurrency(Number(r.income)),
          expense: formatCurrency(Number(r.expense)),
          net: formatCurrency(Number(r.net)),
        }));
      } else if (tab === 'stock') {
        summary = [
          { label: 'Ürün Sayısı', value: String(s.productCount ?? s.rowCount ?? 0) },
          { label: 'Stok Adedi', value: String(s.totalQuantity ?? '-') },
          { label: 'Kritik', value: String(s.criticalCount ?? '-') },
          { label: 'Satış Değeri', value: formatCurrency(Number(s.stockSaleValue || 0)) },
          { label: 'Alış Değeri', value: formatCurrency(Number(s.stockPurchaseValue || 0)) },
        ];
        rows = buildStockExportRows();
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      } else if (tab === 'customerAccount') {
        summary = [
          { label: 'Müşteri', value: String(s.customerCount) },
          { label: 'Toplam Borç', value: formatCurrency(s.totalDebt) },
          { label: 'Toplam Alacak', value: formatCurrency(s.totalCredit) },
        ];
        columns = ['full_name', 'phone', 'tc_no', 'total_sales', 'total_paid', 'balance', 'last_transaction'];
        rows = ((data.rows as Record<string, unknown>[]) || []).map((r) => ({
          full_name: r.full_name,
          phone: r.phone || '-',
          tc_no: r.tc_no || '-',
          total_sales: formatCurrency(Number(r.total_sales)),
          total_paid: formatCurrency(Number(r.total_paid)),
          balance: formatCurrency(Number(r.balance)),
          last_transaction: formatDateTime(String(r.last_transaction)),
        }));
      } else if (tab === 'prescriptionMedula') {
        summary = [
          { label: 'Toplam', value: String(s.total) },
          { label: 'SGK', value: String(s.sgkCount) },
          { label: 'Özel', value: String(s.privateCount) },
          { label: 'Bekleyen', value: String(s.pending) },
          { label: 'Dışa Aktarılan', value: String(s.exported) },
          { label: 'Manuel', value: String(s.uploaded) },
          { label: 'Hatalı', value: String(s.error) },
        ];
        columns = ['prescription_date', 'customer_name', 'customer_tc', 'prescription_no', 'prescription_type', 'medula_status', 'sale_no', 'medula_note'];
        rows = (data.rows as Record<string, unknown>[]) || [];
      } else if (tab === 'returnCancel') {
        summary = [
          { label: 'İade Tutarı', value: formatCurrency(s.returnTotal) },
          { label: 'İade Adedi', value: String(s.returnCount) },
          { label: 'İptal Sayısı', value: String(s.cancelCount) },
          { label: 'İptal Tutarı', value: formatCurrency(s.cancelTotal) },
        ];
        columns = ['event_date', 'operation_type', 'sale_no', 'customer_name', 'product_name', 'quantity', 'amount', 'reason', 'notes'];
        rows = ((data.rows as Record<string, unknown>[]) || []).map((r) => ({
          event_date: formatDateTime(String(r.event_date)),
          operation_type: r.operation_type,
          sale_no: r.sale_no,
          customer_name: r.customer_name || '-',
          product_name: r.product_name || '-',
          quantity: r.quantity,
          amount: formatCurrency(Number(r.amount)),
          reason: r.reason || '-',
          notes: r.notes || '-',
        }));
      } else if (tab === 'edonusum') {
        summary = [
          { label: 'Toplam Taslak', value: String(s.total) },
          { label: 'Hazır', value: String(s.ready) },
          { label: 'Dışa Aktarılan', value: String(s.exported) },
          { label: 'Gönderildi', value: String(s.sent) },
          { label: 'İptal', value: String(s.cancelled) },
          { label: 'Toplam Tutar', value: formatCurrency(s.totalAmount) },
          { label: 'KDV Toplamı', value: formatCurrency(s.vatTotal) },
        ];
        columns = ['draft_no', 'issue_date', 'document_type', 'source_type', 'customer_name', 'supplier_name', 'total_amount', 'status'];
        rows = ((data.rows as Record<string, unknown>[]) || []).map((r) => ({
          draft_no: r.draft_no,
          issue_date: formatDate(String(r.issue_date)),
          document_type: r.document_type,
          source_type: r.source_type,
          customer_name: r.customer_name || '-',
          supplier_name: r.supplier_name || '-',
          total_amount: formatCurrency(Number(r.total_amount)),
          status: r.status,
        }));
      }
    }

    return { reportType: tab, title, dateRange, summary, columns, rows };
  };

  const handleExport = async () => {
    const fileMap: Record<ReportTab, string> = {
      dayEnd: reportFileName('gun-sonu-raporu'),
      sales: reportFileName('satis-raporu'),
      cash: reportFileName('kasa-raporu'),
      stock: stockReportFileName(),
      customerAccount: reportFileName('musteri-cari-raporu'),
      prescriptionMedula: reportFileName('recete-medula-raporu'),
      returnCancel: reportFileName('iade-iptal-raporu'),
      purchase: reportFileName('alis-raporu'),
      supplierAccount: reportFileName('tedarikci-cari-raporu'),
      utsOperations: reportFileName('uts-operasyon-raporu'),
      edonusum: reportFileName('e-donusum-raporu'),
    };
    const payload = buildPrintPayload();
    if (!payload.rows.length) {
      setError('Dışa aktarılacak veri yok.');
      return;
    }
    try {
      const res = await ipc.reports.exportExcel({
        fileName: fileMap[tab],
        rows: payload.rows,
        sheetName: REPORT_TAB_LABELS[tab],
      });
      if (res.exported) setToast('Excel dosyası kaydedildi.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePrint = async () => {
    const payload = buildPrintPayload();
    if (!payload.rows.length && tab !== 'dayEnd') {
      setError('Yazdırılacak veri yok.');
      return;
    }
    try {
      const doc = await ipc.reports.print(payload);
      openPrintPreview(doc);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const daySummary = (data?.summary || {}) as Record<string, number>;
  const salesSummary = (data?.summary || {}) as Record<string, number>;
  const cashSummary = (data?.summary || {}) as Record<string, number>;
  const stockSummary = (data?.summary || {}) as Record<string, number>;
  const cariSummary = (data?.summary || {}) as Record<string, number>;
  const rxSummary = (data?.summary || {}) as Record<string, number>;
  const rcSummary = (data?.summary || {}) as Record<string, number>;

  return (
    <div className="page-content">
      <PageTitleBar title="Raporlar" />

      <div className="tab-bar" style={{ marginBottom: 8 }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => switchTab(t)}
          >
            {REPORT_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div className="form-error" style={{ marginBottom: 8 }}>{error}</div>}
      {toast && (
        <div className="toast-success" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 8, padding: 8 }}>
        {tab === 'dayEnd' && (
          <div className="filter-row">
            <label>Tarih</label>
            <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
          </div>
        )}
        {tab !== 'dayEnd' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <label>Başlangıç</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <label>Bitiş</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        )}

        {tab === 'sales' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <input placeholder="Müşteri" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">Ürün tipi</option>
              {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Ürün / barkod" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">Ödeme türü</option>
              {CASH_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Ödeme durumu</option>
              {PAYMENT_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)}>
              <option value="">Satış durumu</option>
              {SALE_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {tab === 'cash' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">Ödeme türü</option>
              {CASH_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
              <option value="">Hareket türü</option>
              <option value="Giriş">Giriş</option>
              <option value="Çıkış">Çıkış</option>
              <option value="Tahsilat">Tahsilat</option>
              <option value="Satış">Satış</option>
              <option value="İade">İade</option>
            </select>
            <input placeholder="Müşteri" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <input placeholder="Açıklama" value={cashDesc} onChange={(e) => setCashDesc(e.target.value)} />
          </div>
        )}

        {tab === 'stock' && (
          <>
            <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <select value={stockReportType} onChange={(e) => setStockReportType(e.target.value as StockReportType)}>
                {STOCK_REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={productType} onChange={(e) => setProductType(e.target.value)}>
                <option value="">Ürün tipi</option>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Ana grup</option>
                {groupLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              {(stockReportType === 'opticalDistribution' || stockReportType === 'brandStock') && (
                <select value={subgroupId} onChange={(e) => setSubgroupId(e.target.value ? Number(e.target.value) : '')} disabled={groupId === ''}>
                  <option value="">Alt grup</option>
                  {subgroupLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              )}
              <select value={brandId} onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Marka</option>
                {brandLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              {(stockReportType === 'opticalDistribution' || stockReportType === 'brandStock') && (
                <select value={modelId} onChange={(e) => setModelId(e.target.value ? Number(e.target.value) : '')} disabled={brandId === ''}>
                  <option value="">Model</option>
                  {modelLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              )}
              {stockReportType === 'opticalDistribution' && (
                <select value={colorId} onChange={(e) => setColorId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Renk</option>
                  {colorLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              )}
              {(stockReportType === 'current' || stockReportType === 'critical' || stockReportType === 'brandStock') && (
                <>
                  <input placeholder="Raf / konum" value={shelfLocation} onChange={(e) => setShelfLocation(e.target.value)} />
                  <input placeholder="Barkod / ürün" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} />
                  <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
                    <option value="">Durum</option>
                    <option value="Aktif">Aktif</option>
                    <option value="Pasif">Pasif</option>
                  </select>
                </>
              )}
              {(stockReportType === 'current' || stockReportType === 'critical') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
                  Kritik stok
                </label>
              )}
            </div>

            {stockReportType === 'lensExpiry' && (
              <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                <select value={lensTypeId} onChange={(e) => setLensTypeId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Lens tipi</option>
                  {lensTypeLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <input placeholder="SKT kalan gün" value={expiryDaysMax} onChange={(e) => setExpiryDaysMax(e.target.value)} />
                <input placeholder="Lot no" value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
              </div>
            )}

            {stockReportType === 'opticalValues' && (
              <>
                <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <input placeholder="SPH min" value={sphFrom} onChange={(e) => setSphFrom(e.target.value)} />
                  <input placeholder="SPH max" value={sphTo} onChange={(e) => setSphTo(e.target.value)} />
                  <input placeholder="CYL min" value={cylFrom} onChange={(e) => setCylFrom(e.target.value)} />
                  <input placeholder="CYL max" value={cylTo} onChange={(e) => setCylTo(e.target.value)} />
                  <input placeholder="AXIS min" value={axisFrom} onChange={(e) => setAxisFrom(e.target.value)} />
                  <input placeholder="AXIS max" value={axisTo} onChange={(e) => setAxisTo(e.target.value)} />
                  <input placeholder="ADD min" value={addFrom} onChange={(e) => setAddFrom(e.target.value)} />
                  <input placeholder="ADD max" value={addTo} onChange={(e) => setAddTo(e.target.value)} />
                </div>
                <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  <input placeholder="Çap" value={diameter} onChange={(e) => setDiameter(e.target.value)} />
                  <input placeholder="Base Curve" value={baseCurve} onChange={(e) => setBaseCurve(e.target.value)} />
                  <select value={lensTypeId} onChange={(e) => setLensTypeId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Cam tipi</option>
                    {lensTypeLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                  <select value={lensMaterialId} onChange={(e) => setLensMaterialId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Cam materyali</option>
                    {lensMaterialLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                  <select value={lensCoatingId} onChange={(e) => setLensCoatingId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Kaplama</option>
                    {lensCoatingLookups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'customerAccount' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <input placeholder="Müşteri / tel / T.C." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <select value={balanceStatus} onChange={(e) => setBalanceStatus(e.target.value as typeof balanceStatus)}>
              <option value="all">Tümü</option>
              <option value="debt">Borçlu</option>
              <option value="credit">Alacaklı</option>
              <option value="zero">Sıfır bakiye</option>
            </select>
          </div>
        )}

        {tab === 'prescriptionMedula' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <select value={rxType} onChange={(e) => setRxType(e.target.value)}>
              <option value="">Reçete tipi</option>
              {PRESCRIPTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={medulaStatus} onChange={(e) => setMedulaStatus(e.target.value)}>
              <option value="">Medula durumu</option>
              {MEDULA_STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Müşteri" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <select value={rxMissing} onChange={(e) => setRxMissing(e.target.value)}>
              <option value="">Eksik alan</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>
        )}

        {tab === 'returnCancel' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <select value={operationType} onChange={(e) => setOperationType(e.target.value)}>
              <option value="">İşlem tipi</option>
              <option value="İade">İade</option>
              <option value="İptal">İptal</option>
            </select>
            <input placeholder="Müşteri" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <input placeholder="Ürün" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            <input placeholder="Neden" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
          </div>
        )}

        {tab === 'purchase' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">Belge türü</option>
              <option value="Alış Faturası">Alış Faturası</option>
              <option value="Alış İrsaliyesi">Alış İrsaliyesi</option>
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="">Ödeme durumu</option>
              <option value="Ödendi">Ödendi</option>
              <option value="Kısmi Ödendi">Kısmi Ödendi</option>
              <option value="Ödenmedi">Ödenmedi</option>
            </select>
          </div>
        )}

        {tab === 'supplierAccount' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <input placeholder="Tedarikçi / vergi no" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
          </div>
        )}

        {tab === 'edonusum' && (
          <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <select value={edonusumDocType} onChange={(e) => setEdonusumDocType(e.target.value)}>
              <option value="">Belge türü</option>
              <option value="E-Arşiv">E-Arşiv</option>
              <option value="E-Fatura">E-Fatura</option>
              <option value="Alış Faturası">Alış Faturası</option>
              <option value="Alış İrsaliyesi">Alış İrsaliyesi</option>
              <option value="E-İrsaliye">E-İrsaliye</option>
            </select>
            <select value={edonusumStatus} onChange={(e) => setEdonusumStatus(e.target.value)}>
              <option value="">Durum</option>
              <option value="Taslak">Taslak</option>
              <option value="Hazır">Hazır</option>
              <option value="Eksik Bilgi">Eksik Bilgi</option>
              <option value="Dışa Aktarıldı">Dışa Aktarıldı</option>
              <option value="Gönderildi İşaretlendi">Gönderildi İşaretlendi</option>
              <option value="İptal">İptal</option>
            </select>
            <select value={edonusumSourceType} onChange={(e) => setEdonusumSourceType(e.target.value)}>
              <option value="">Kaynak türü</option>
              <option value="SALE">Satış</option>
              <option value="PURCHASE">Alış</option>
              <option value="SGK_BATCH">SGK Batch</option>
              <option value="STOCK_ENTRY">Mal Kabul</option>
            </select>
            <input placeholder="Müşteri / tedarikçi" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
          </div>
        )}

        <ActionBar onLoad={load} onExport={handleExport} onPrint={handlePrint} loading={loading} />
      </div>

      {tab === 'dayEnd' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam Satış', value: formatCurrency(daySummary.totalSales) },
              { label: 'Toplam Tahsilat', value: formatCurrency(daySummary.totalCollection) },
              { label: 'Nakit', value: formatCurrency(daySummary.cashCollection) },
              { label: 'Kredi Kartı', value: formatCurrency(daySummary.cardCollection) },
              { label: 'Havale/EFT', value: formatCurrency(daySummary.transferCollection) },
              { label: 'Açık Hesap', value: formatCurrency(daySummary.openAccountSales) },
              { label: 'Gider', value: formatCurrency(daySummary.expenseTotal), negative: true },
              { label: 'Net Kasa', value: formatCurrency(daySummary.netCash) },
              { label: 'İade', value: formatCurrency(daySummary.returnTotal), negative: true },
              { label: 'İptal', value: String(daySummary.cancelledCount) },
              { label: 'Satış Adedi', value: String(daySummary.saleCount) },
              { label: 'Ürün Adedi', value: String(daySummary.productQuantity) },
            ]}
          />
          <DayEndTables data={data} onSaleClick={setSaleDetailId} />
        </>
      )}

      {tab === 'sales' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam Satış', value: formatCurrency(salesSummary.totalSales) },
              { label: 'Toplam Tahsilat', value: formatCurrency(salesSummary.totalCollection) },
              { label: 'Açık Hesap', value: formatCurrency(salesSummary.openAccountRemaining) },
              { label: 'Satış Adedi', value: String(salesSummary.saleCount) },
              { label: 'Ürün Adedi', value: String(salesSummary.productQuantity) },
              { label: 'Ortalama', value: formatCurrency(salesSummary.averageSale) },
            ]}
          />
          <ReportTable
            headers={['Tarih', 'Satış No', 'Müşteri', 'Ürün', 'Toplam', 'Ödenen', 'Kalan', 'Ödeme', 'Tür', 'Durum']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r) => (
              <tr key={String(r.id)} className="clickable-row" onClick={() => setSaleDetailId(Number(r.id))}>
                <td>{formatDateTime(String(r.sale_date))}</td>
                <td>{String(r.sale_no)}</td>
                <td>{String(r.customer_name || 'Perakende')}</td>
                <td className="text-right">{String(r.item_count)}</td>
                <td className="text-right">{formatCurrency(Number(r.net_amount))}</td>
                <td className="text-right">{formatCurrency(Number(r.paid_amount))}</td>
                <td className="text-right">{formatCurrency(Number(r.remaining_amount))}</td>
                <td>{String(r.payment_status)}</td>
                <td>{String(r.payment_types || '-')}</td>
                <td>{String(r.status)}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'cash' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam Giriş', value: formatCurrency(cashSummary.totalIncome) },
              { label: 'Toplam Çıkış', value: formatCurrency(cashSummary.totalExpense), negative: true },
              { label: 'Net Kasa', value: formatCurrency(cashSummary.netCash) },
              { label: 'Nakit', value: formatCurrency(cashSummary.cashTotal) },
              { label: 'Kredi Kartı', value: formatCurrency(cashSummary.cardTotal) },
              { label: 'Havale/EFT', value: formatCurrency(cashSummary.transferTotal) },
            ]}
          />
          <ReportTable
            headers={['Tarih', 'Hareket', 'Ödeme', 'Müşteri', 'Açıklama', 'Giriş', 'Çıkış', 'Net']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{formatDateTime(String(r.movement_date))}</td>
                <td>{String(r.movement_type)}</td>
                <td>{String(r.payment_type)}</td>
                <td>{String(r.customer_name || '-')}</td>
                <td>{String(r.description || '-')}</td>
                <td className="text-right amount-positive">{Number(r.income) > 0 ? formatCurrency(Number(r.income)) : '-'}</td>
                <td className="text-right amount-negative">{Number(r.expense) > 0 ? formatCurrency(Number(r.expense)) : '-'}</td>
                <td className="text-right">{formatCurrency(Number(r.net))}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'stock' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Ürün Sayısı', value: String(stockSummary.productCount ?? stockSummary.rowCount ?? 0) },
              { label: 'Stok Adedi', value: String(stockSummary.totalQuantity ?? '-') },
              { label: 'Kritik', value: String(stockSummary.criticalCount ?? '-') },
              { label: 'Satış Değeri', value: formatCurrency(Number(stockSummary.stockSaleValue || 0)) },
              { label: 'Alış Değeri', value: formatCurrency(Number(stockSummary.stockPurchaseValue || 0)) },
            ]}
          />
          <ReportTable
            headers={
              stockReportType === 'movements'
                ? ['Tarih', 'Ürün', 'Tip', 'Hareket', 'Adet', 'Barkod', 'Fiş No', 'Sayım No', 'Belge No', 'Tedarikçi']
                : stockReportType === 'countDifferences'
                  ? ['Sayım No', 'Tarih', 'Ürün', 'Tip', 'Beklenen', 'Sayılan', 'Fark', 'Durum', 'Raf']
                : stockReportType === 'topSelling'
                  ? ['Barkod', 'Ürün', 'Tip', 'Marka', 'Satılan', 'Tutar']
                  : stockReportType === 'opticalDistribution' || stockReportType === 'brandStock'
                    ? ['Ana Grup', 'Alt Grup', 'Marka', 'Model', 'Ürün Sayısı', 'Toplam Stok', 'Stok Değeri']
                    : stockReportType === 'lensExpiry'
                      ? ['Ürün Adı', 'Barkod', 'Marka', 'Model', 'Lot No', 'SKT', 'Kalan Gün', 'Stok', 'Raf / Konum']
                      : stockReportType === 'opticalValues'
                        ? ['Ürün Adı', 'SPH', 'CYL', 'AXIS', 'ADD', 'Çap', 'Base Curve', 'Cam Tipi', 'Cam Materyali', 'Kaplama', 'Stok', 'Raf / Konum']
                        : ['Barkod', 'Ürün', 'Tip', 'Ana Grup', 'Marka', 'Model', 'Stok', 'Kritik', 'Alış', 'Satış', 'Değer', 'Raf']
            }
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => {
              if (stockReportType === 'movements') {
                return (
                  <tr key={i}>
                    <td>{formatDateTime(String(r.created_at))}</td>
                    <td>{String(r.product_name)}</td>
                    <td>{String(r.product_type)}</td>
                    <td>{String(r.movement_type)}</td>
                    <td className="text-right">{String(r.quantity)}</td>
                    <td>{String(r.barcode || '-')}</td>
                    <td>{String(r.batch_no || '-')}</td>
                    <td>{String(r.inventory_count_no || '-')}</td>
                    <td>{String(r.document_no || '-')}</td>
                    <td>{String(r.supplier_name || '-')}</td>
                  </tr>
                );
              }
              if (stockReportType === 'countDifferences') {
                return (
                  <tr key={i}>
                    <td>{String(r.count_no)}</td>
                    <td>{String(r.count_date)}</td>
                    <td>{String(r.product_name)}</td>
                    <td>{String(r.product_type)}</td>
                    <td className="text-right">{String(r.expected_quantity)}</td>
                    <td className="text-right">{String(r.counted_quantity)}</td>
                    <td className="text-right">{String(r.difference_quantity)}</td>
                    <td>{String(r.item_status)}</td>
                    <td>{String(r.shelf_location || '-')}</td>
                  </tr>
                );
              }
              if (stockReportType === 'topSelling') {
                return (
                  <tr key={i}>
                    <td>{String(r.barcode || '-')}</td>
                    <td>{String(r.product_name)}</td>
                    <td>{String(r.product_type)}</td>
                    <td>{String(r.brand || '-')}</td>
                    <td className="text-right">{String(r.sold_qty)}</td>
                    <td className="text-right">{formatCurrency(Number(r.sold_total))}</td>
                  </tr>
                );
              }
              if (stockReportType === 'opticalDistribution' || stockReportType === 'brandStock') {
                return (
                  <tr key={i}>
                    <td>{String(r.group_name || '-')}</td>
                    <td>{String(r.subgroup_name || '-')}</td>
                    <td>{String(r.brand_name || '-')}</td>
                    <td>{String(r.model_name || '-')}</td>
                    <td className="text-right">{String(r.product_count || 0)}</td>
                    <td className="text-right">{String(r.total_qty || 0)}</td>
                    <td className="text-right">{formatCurrency(Number(r.stock_sale_value || 0))}</td>
                  </tr>
                );
              }
              if (stockReportType === 'lensExpiry') {
                return (
                  <tr key={i}>
                    <td>{String(r.name || '-')}</td>
                    <td>{String(r.barcode || '-')}</td>
                    <td>{String(r.brand_name || '-')}</td>
                    <td>{String(r.model_name || '-')}</td>
                    <td>{String(r.lot_no || '-')}</td>
                    <td>{String(r.uts_expiry_date || '-')}</td>
                    <td className="text-right">{String(r.remaining_days ?? '-')}</td>
                    <td className="text-right">{String(r.stock_quantity || 0)}</td>
                    <td>{String(r.shelf_location || '-')}</td>
                  </tr>
                );
              }
              if (stockReportType === 'opticalValues') {
                return (
                  <tr key={i}>
                    <td>{String(r.name || '-')}</td>
                    <td>{String(r.sph || '-')}</td>
                    <td>{String(r.cyl || '-')}</td>
                    <td>{String(r.axis || '-')}</td>
                    <td>{String(r.addition || '-')}</td>
                    <td>{String(r.diameter || '-')}</td>
                    <td>{String(r.base_curve || '-')}</td>
                    <td>{String(r.lens_type_name || '-')}</td>
                    <td>{String(r.lens_material_name || '-')}</td>
                    <td>{String(r.lens_coating_name || '-')}</td>
                    <td className="text-right">{String(r.stock_quantity || 0)}</td>
                    <td>{String(r.shelf_location || '-')}</td>
                  </tr>
                );
              }
              const saleVal = Number(r.stock_quantity) * Number(r.sale_price);
              return (
                <tr key={i}>
                  <td>{String(r.barcode || '-')}</td>
                  <td>{String(r.name)}</td>
                  <td>{String(r.product_type)}</td>
                  <td>{String(r.group_name || '-')}</td>
                  <td>{String(r.brand_name || r.brand || '-')}</td>
                  <td>{String(r.model_name || r.model || '-')}</td>
                  <td className="text-right">{String(r.stock_quantity)}</td>
                  <td className="text-right">{String(r.min_stock)}</td>
                  <td className="text-right">{formatCurrency(Number(r.purchase_price))}</td>
                  <td className="text-right">{formatCurrency(Number(r.sale_price))}</td>
                  <td className="text-right">{formatCurrency(saleVal)}</td>
                  <td>{String(r.shelf_location || '-')}</td>
                </tr>
              );
            }}
          />
        </>
      )}

      {tab === 'purchase' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Belge', value: String((data.summary as Record<string, unknown>)?.rowCount ?? 0) },
              { label: 'Toplam Alış', value: formatCurrency(Number((data.summary as Record<string, unknown>)?.totalAmount ?? 0)) },
              { label: 'KDV', value: formatCurrency(Number((data.summary as Record<string, unknown>)?.totalVat ?? 0)) },
              { label: 'Ödenen', value: formatCurrency(Number((data.summary as Record<string, unknown>)?.totalPaid ?? 0)) },
              { label: 'Kalan', value: formatCurrency(Number((data.summary as Record<string, unknown>)?.totalRemaining ?? 0)) },
            ]}
          />
          <ReportTable
            headers={['Belge No', 'Tarih', 'Tedarikçi', 'Tip', 'Toplam', 'Ödenen', 'Kalan', 'Durum']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{String(r.document_no)}</td>
                <td>{String(r.document_date)}</td>
                <td>{String(r.supplier_name)}</td>
                <td>{String(r.document_type)}</td>
                <td className="text-right">{formatCurrency(Number(r.total_amount))}</td>
                <td className="text-right">{formatCurrency(Number(r.paid_amount))}</td>
                <td className="text-right">{formatCurrency(Number(r.remaining_amount))}</td>
                <td>{String(r.payment_status)}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'supplierAccount' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Tedarikçi', value: String((data.summary as Record<string, unknown>)?.supplierCount ?? 0) },
              { label: 'Toplam Bakiye', value: formatCurrency(Number((data.summary as Record<string, unknown>)?.totalBalance ?? 0)) },
            ]}
          />
          <ReportTable
            headers={['Tedarikçi', 'Telefon', 'Vergi No', 'Toplam Alış', 'Toplam Ödeme', 'Bakiye', 'Son İşlem']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{String(r.name)}</td>
                <td>{String(r.phone || '-')}</td>
                <td>{String(r.tax_no || '-')}</td>
                <td className="text-right">{formatCurrency(Number(r.total_purchases))}</td>
                <td className="text-right">{formatCurrency(Number(r.total_payments))}</td>
                <td className="text-right">{formatCurrency(Number(r.balance))}</td>
                <td>{r.last_transaction_at ? formatDateTime(String(r.last_transaction_at)) : '-'}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'customerAccount' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Kayıt', value: String(cariSummary.customerCount) },
              { label: 'Toplam Borç', value: formatCurrency(cariSummary.totalDebt), negative: true },
              { label: 'Toplam Alacak', value: formatCurrency(cariSummary.totalCredit) },
            ]}
          />
          <ReportTable
            headers={['Müşteri', 'Telefon', 'T.C.', 'Toplam Satış', 'Toplam Tahsilat', 'Bakiye', 'Son İşlem']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r) => (
              <tr key={String(r.id)} className="clickable-row" onClick={() => setCustomerDetailId(Number(r.id))}>
                <td>{String(r.full_name)}</td>
                <td>{String(r.phone || '-')}</td>
                <td>{String(r.tc_no || '-')}</td>
                <td className="text-right">{formatCurrency(Number(r.total_sales))}</td>
                <td className="text-right">{formatCurrency(Number(r.total_paid))}</td>
                <td className={`text-right${Number(r.balance) > 0 ? ' amount-negative' : ''}`}>
                  {formatCurrency(Number(r.balance))}
                </td>
                <td>{formatDateTime(String(r.last_transaction))}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'prescriptionMedula' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam', value: String(rxSummary.total) },
              { label: 'SGK', value: String(rxSummary.sgkCount) },
              { label: 'Özel', value: String(rxSummary.privateCount) },
              { label: 'Bekleyen', value: String(rxSummary.pending) },
              { label: 'Dışa Aktarılan', value: String(rxSummary.exported) },
              { label: 'Manuel', value: String(rxSummary.uploaded) },
              { label: 'Hatalı', value: String(rxSummary.error) },
            ]}
          />
          <ReportTable
            headers={['Tarih', 'Müşteri', 'T.C.', 'Reçete No', 'Tip', 'Medula', 'Satış No', 'Not']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr
                key={i}
                className={r.sale_id ? 'clickable-row' : undefined}
                onClick={() => r.sale_id && setSaleDetailId(Number(r.sale_id))}
              >
                <td>{formatDate(String(r.prescription_date))}</td>
                <td>{String(r.customer_name || '-')}</td>
                <td>{String(r.customer_tc || r.patient_tc || '-')}</td>
                <td>{String(r.prescription_no)}</td>
                <td>{String(r.prescription_type)}</td>
                <td>{String(r.medula_status)}</td>
                <td>{String(r.sale_no || '-')}</td>
                <td>{String(r.medula_note || '-')}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'utsOperations' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam İşlem', value: String((data.summary as Record<string, number>)?.total ?? 0) },
              { label: 'Bekleyen', value: String((data.summary as Record<string, number>)?.pending ?? 0) },
              { label: 'Dışa Aktarılan', value: String((data.summary as Record<string, number>)?.exported ?? 0) },
              { label: 'ÜTS\'de İşlenen', value: String((data.summary as Record<string, number>)?.processed ?? 0) },
              { label: 'Hatalı', value: String((data.summary as Record<string, number>)?.error ?? 0), negative: true },
              { label: 'İşlem Dışı', value: String((data.summary as Record<string, number>)?.ignored ?? 0) },
            ]}
          />
          <ReportTable
            headers={['İşlem No', 'Tarih', 'Tür', 'Durum', 'Belge', 'Kullanıcı']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{String(r.operation_no)}</td>
                <td>{formatDateTime(String(r.operation_date))}</td>
                <td>{String(r.operation_type)}</td>
                <td>{String(r.status)}</td>
                <td>{String(r.document_no || '-')}</td>
                <td>{String(r.created_by_name || '-')}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'returnCancel' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'İade Tutarı', value: formatCurrency(rcSummary.returnTotal), negative: true },
              { label: 'İade Adedi', value: String(rcSummary.returnCount) },
              { label: 'İptal Sayısı', value: String(rcSummary.cancelCount) },
              { label: 'İptal Tutarı', value: formatCurrency(rcSummary.cancelTotal), negative: true },
            ]}
          />
          <ReportTable
            headers={['Tarih', 'Tip', 'Satış No', 'Müşteri', 'Ürün', 'Adet', 'Tutar', 'Neden', 'Not']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{formatDateTime(String(r.event_date))}</td>
                <td>{String(r.operation_type)}</td>
                <td>{String(r.sale_no)}</td>
                <td>{String(r.customer_name || '-')}</td>
                <td>{String(r.product_name || '-')}</td>
                <td className="text-right">{String(r.quantity)}</td>
                <td className="text-right">{formatCurrency(Number(r.amount))}</td>
                <td>{String(r.reason || '-')}</td>
                <td>{String(r.notes || '-')}</td>
              </tr>
            )}
          />
        </>
      )}

      {tab === 'edonusum' && data && (
        <>
          <SummaryRow
            items={[
              { label: 'Toplam Taslak', value: String((data.summary as Record<string, number>)?.total ?? 0) },
              { label: 'Hazır', value: String((data.summary as Record<string, number>)?.ready ?? 0) },
              { label: 'Dışa Aktarılan', value: String((data.summary as Record<string, number>)?.exported ?? 0) },
              { label: 'Gönderildi', value: String((data.summary as Record<string, number>)?.sent ?? 0) },
              { label: 'İptal', value: String((data.summary as Record<string, number>)?.cancelled ?? 0) },
              { label: 'Toplam Tutar', value: formatCurrency((data.summary as Record<string, number>)?.totalAmount ?? 0) },
              { label: 'KDV Toplamı', value: formatCurrency((data.summary as Record<string, number>)?.vatTotal ?? 0) },
            ]}
          />
          <ReportTable
            headers={['Taslak No', 'Tarih', 'Belge Türü', 'Kaynak', 'Müşteri', 'Tedarikçi', 'Tutar', 'Durum']}
            rows={(data.rows as Record<string, unknown>[]) || []}
            renderRow={(r, i) => (
              <tr key={i}>
                <td>{String(r.draft_no)}</td>
                <td>{formatDate(String(r.issue_date))}</td>
                <td>{String(r.document_type)}</td>
                <td>{String(r.source_type)}</td>
                <td>{String(r.customer_name || '-')}</td>
                <td>{String(r.supplier_name || '-')}</td>
                <td className="text-right">{formatCurrency(Number(r.total_amount))}</td>
                <td>{String(r.status)}</td>
              </tr>
            )}
          />
        </>
      )}

      {saleDetailId && (
        <SaleDetail saleId={saleDetailId} onClose={() => setSaleDetailId(null)} onUpdated={load} />
      )}
      {customerDetailId && (
        <CustomerDetail
          customerId={customerDetailId}
          onClose={() => setCustomerDetailId(null)}
          onEdit={() => setCustomerDetailId(null)}
        />
      )}
    </div>
  );
}

function ReportTable({
  headers,
  rows,
  renderRow,
}: {
  headers: string[];
  rows: Record<string, unknown>[];
  renderRow: (row: Record<string, unknown>, index: number) => ReactNode;
}) {
  return (
    <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="empty-text">
                  Kayıt bulunamadı
                </td>
              </tr>
            ) : (
              rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayEndTables({
  data,
  onSaleClick,
}: {
  data: Record<string, unknown>;
  onSaleClick: (id: number) => void;
}) {
  const tables = data.tables as Record<string, Record<string, unknown>[]>;

  const sections = [
    { title: 'Gün İçi Satışlar', key: 'sales', cols: ['Satış No', 'Müşteri', 'Tutar', 'Ödeme', 'Durum', 'Tarih'] },
    { title: 'Kasa Hareketleri', key: 'cashMovements', cols: ['Tarih', 'Tür', 'Ödeme', 'Müşteri', 'Açıklama', 'Tutar'] },
    { title: 'Açık Hesap Satışlar', key: 'openAccountSales', cols: ['Satış No', 'Müşteri', 'Kalan', 'Tarih'] },
    { title: 'İadeler', key: 'returns', cols: ['İade No', 'Satış', 'Müşteri', 'Tutar', 'Tarih'] },
    { title: 'İptaller', key: 'cancellations', cols: ['Satış No', 'Müşteri', 'Tutar', 'Neden', 'Tarih'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
      {sections.map((sec) => {
        const rows = tables[sec.key] || [];
        return (
          <div className="panel" key={sec.key}>
            <div className="panel-header">{sec.title} ({rows.length})</div>
            <div className="data-table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>{sec.cols.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={sec.cols.length} className="empty-text">Kayıt yok</td></tr>
                  ) : (
                    rows.map((r, i) => {
                      if (sec.key === 'sales' || sec.key === 'openAccountSales' || sec.key === 'cancellations') {
                        return (
                          <tr key={i} className="clickable-row" onClick={() => onSaleClick(Number(r.id))}>
                            <td>{String(r.sale_no)}</td>
                            <td>{String(r.customer_name || 'Perakende')}</td>
                            {sec.key === 'openAccountSales' ? (
                              <td className="text-right">{formatCurrency(Number(r.remaining_amount))}</td>
                            ) : sec.key === 'cancellations' ? (
                              <>
                                <td className="text-right">{formatCurrency(Number(r.net_amount))}</td>
                                <td>{String(r.cancel_reason || '-')}</td>
                              </>
                            ) : (
                              <>
                                <td className="text-right">{formatCurrency(Number(r.net_amount))}</td>
                                <td>{String(r.payment_status)}</td>
                                <td>{String(r.status)}</td>
                              </>
                            )}
                            <td>{formatDateTime(String(sec.key === 'cancellations' ? r.cancelled_at : r.sale_date))}</td>
                          </tr>
                        );
                      }
                      if (sec.key === 'cashMovements') {
                        return (
                          <tr key={i}>
                            <td>{formatDateTime(String(r.movement_date))}</td>
                            <td>{String(r.movement_type)}</td>
                            <td>{String(r.payment_type)}</td>
                            <td>{String(r.customer_name || '-')}</td>
                            <td>{String(r.description || '-')}</td>
                            <td className="text-right">{formatCurrency(Number(r.amount))}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={i}>
                          <td>{String(r.return_no)}</td>
                          <td>{String(r.sale_no)}</td>
                          <td>{String(r.customer_name || '-')}</td>
                          <td className="text-right">{formatCurrency(Number(r.total_amount))}</td>
                          <td>{formatDateTime(String(r.created_at))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
