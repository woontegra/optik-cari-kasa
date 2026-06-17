import { useCallback, useEffect, useMemo, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import type { Product, ProductInput } from '@/types/electron';
import { PRODUCT_TYPES } from '@/types/electron';
import ProductForm from '@/components/products/ProductForm';
import ProductImportWizard from '@/components/products/ProductImportWizard';
import LabelPrintModal from '@/components/products/LabelPrintModal';
import PageTitleBar from '@/components/layout/PageTitleBar';

type FormMode = 'create' | 'edit' | 'view' | null;
type LookupRow = { id: number; name: string; parent_id?: number | null };

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return <div className="toast-success">{message}</div>;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState<number | ''>('');
  const [subgroupFilter, setSubgroupFilter] = useState<number | ''>('');
  const [brandFilter, setBrandFilter] = useState<number | ''>('');
  const [modelFilter, setModelFilter] = useState<number | ''>('');
  const [colorFilter, setColorFilter] = useState<number | ''>('');
  const [shelfFilter, setShelfFilter] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [noBarcode, setNoBarcode] = useState(false);
  const [utsOnly, setUtsOnly] = useState(false);
  const [includePassive, setIncludePassive] = useState(false);
  const [detailView, setDetailView] = useState(false);
  const [lookupGroups, setLookupGroups] = useState<LookupRow[]>([]);
  const [lookupSubgroups, setLookupSubgroups] = useState<LookupRow[]>([]);
  const [lookupBrands, setLookupBrands] = useState<LookupRow[]>([]);
  const [lookupModels, setLookupModels] = useState<LookupRow[]>([]);
  const [lookupColors, setLookupColors] = useState<LookupRow[]>([]);
  const [toast, setToast] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    ipc.opticalLookups.listByType('PRODUCT_GROUP').then((rows) => setLookupGroups(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('BRAND').then((rows) => setLookupBrands(rows as LookupRow[])).catch(() => undefined);
    ipc.opticalLookups.listByType('COLOR').then((rows) => setLookupColors(rows as LookupRow[])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (groupFilter === '') {
      setLookupSubgroups([]);
      setSubgroupFilter('');
      return;
    }
    ipc.opticalLookups
      .listChildren(groupFilter)
      .then((rows) => setLookupSubgroups((rows as LookupRow[]).filter((row) => row.parent_id === groupFilter)))
      .catch(() => setLookupSubgroups([]));
    setSubgroupFilter('');
  }, [groupFilter]);

  useEffect(() => {
    if (brandFilter === '') {
      setLookupModels([]);
      setModelFilter('');
      return;
    }
    ipc.opticalLookups
      .listChildren(brandFilter)
      .then((rows) => setLookupModels((rows as LookupRow[]).filter((row) => row.parent_id === brandFilter)))
      .catch(() => setLookupModels([]));
    setModelFilter('');
  }, [brandFilter]);

  const visibleSubgroups = useMemo(() => (groupFilter === '' ? [] : lookupSubgroups), [groupFilter, lookupSubgroups]);
  const visibleModels = useMemo(() => (brandFilter === '' ? [] : lookupModels), [brandFilter, lookupModels]);

  const loadProducts = useCallback(() => {
    setLoading(true);
    ipc.products
      .list({
        search: search || undefined,
        product_type: typeFilter || undefined,
        status: includePassive ? undefined : 'Aktif',
        group_id: groupFilter === '' ? undefined : groupFilter,
        subgroup_id: subgroupFilter === '' ? undefined : subgroupFilter,
        brand_id: brandFilter === '' ? undefined : brandFilter,
        model_id: modelFilter === '' ? undefined : modelFilter,
        color_id: colorFilter === '' ? undefined : colorFilter,
        shelf_location: shelfFilter || undefined,
        critical_only: criticalOnly || undefined,
        no_barcode: noBarcode || undefined,
        uts_tracking_required: utsOnly || undefined,
      })
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [
    search,
    typeFilter,
    includePassive,
    groupFilter,
    subgroupFilter,
    brandFilter,
    modelFilter,
    colorFilter,
    shelfFilter,
    criticalOnly,
    noBarcode,
    utsOnly,
  ]);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 200);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setSelectedProduct(null);
    setFormMode('create');
  };

  const openEdit = async () => {
    if (!selectedId) return;
    const product = await ipc.products.getById(selectedId);
    if (product) {
      setSelectedProduct(product);
      setFormMode('edit');
    }
  };

  const openView = async () => {
    if (!selectedId) return;
    const product = await ipc.products.getById(selectedId);
    if (product) {
      setSelectedProduct(product);
      setFormMode('view');
    }
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedProduct(null);
  };

  const handleSave = async (input: ProductInput) => {
    if (formMode === 'create') {
      await ipc.products.create(input);
      setToast('Ürün başarıyla eklendi.');
    } else if (formMode === 'edit' && selectedId) {
      await ipc.products.update(selectedId, input);
      setToast('Ürün başarıyla güncellendi.');
    }
    closeForm();
    loadProducts();
  };

  const handleDeactivate = async () => {
    if (!selectedId) return;
    if (!confirm('Ürünü pasife almak istediğinize emin misiniz?')) return;
    try {
      await ipc.products.deactivate(selectedId);
      setToast('Ürün pasife alındı.');
      closeForm();
      setSelectedIds(new Set());
      loadProducts();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await ipc.products.exportToExcel();
      if (result.exported) setToast(`Dosya kaydedildi: ${result.filePath}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      const result = await ipc.products.downloadImportTemplate();
      if (result.saved) setToast('Şablon indirildi.');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const labelProducts =
    selectedIds.size > 0
      ? products.filter((p) => selectedIds.has(p.id))
      : selectedId
        ? products.filter((p) => p.id === selectedId)
        : [];

  const openLabels = () => {
    if (labelProducts.length === 0) {
      alert('Etiket basmak için en az bir ürün seçin.');
      return;
    }
    setShowLabels(true);
  };

  const isCritical = (p: Product) => p.status === 'Aktif' && p.stock_quantity <= (p.min_stock ?? 0);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setGroupFilter('');
    setSubgroupFilter('');
    setBrandFilter('');
    setModelFilter('');
    setColorFilter('');
    setShelfFilter('');
    setCriticalOnly(false);
    setNoBarcode(false);
    setUtsOnly(false);
    setIncludePassive(false);
  };

  const standardColSpan = 12;
  const detailColSpan = 25;

  return (
    <div className="page-content">
      <PageTitleBar title="Stok Kartları" />

      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={openCreate}>Yeni Ürün</button>
          <button className="btn" disabled={!selectedId} onClick={openEdit}>Düzenle</button>
          <button className="btn" disabled={!selectedId} onClick={openView}>Detay</button>
          <button className="btn btn-danger" disabled={!selectedId} onClick={handleDeactivate}>Pasife Al</button>
          <div className="toolbar-spacer" />
          <button className="btn" onClick={handleTemplate}>Şablon İndir</button>
          <button className="btn" onClick={() => setShowImport(true)}>Excel&apos;den Aktar</button>
          <button className="btn" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Aktarılıyor...' : 'Excel\'e Aktar'}
          </button>
          <button className="btn" disabled={labelProducts.length === 0} onClick={openLabels}>
            Etiket Bas{selectedIds.size > 1 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input search-input"
            placeholder="Ara: ürün adı, barkod, marka, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Ürün Tipi</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="form-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Ana Grup</option>
            {lookupGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            className="form-select"
            value={subgroupFilter}
            onChange={(e) => setSubgroupFilter(e.target.value ? Number(e.target.value) : '')}
            disabled={groupFilter === ''}
          >
            <option value="">Alt Grup</option>
            {visibleSubgroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Marka</option>
            {lookupBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            className="form-select"
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value ? Number(e.target.value) : '')}
            disabled={brandFilter === ''}
          >
            <option value="">Model</option>
            {visibleModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="form-select" value={colorFilter} onChange={(e) => setColorFilter(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Renk</option>
            {lookupColors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            className="form-input"
            style={{ maxWidth: 140 }}
            placeholder="Raf / konum"
            value={shelfFilter}
            onChange={(e) => setShelfFilter(e.target.value)}
          />
          <label className="checkbox-label"><input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} /> Kritik stok</label>
          <label className="checkbox-label"><input type="checkbox" checked={noBarcode} onChange={(e) => setNoBarcode(e.target.checked)} /> Barkodsuz</label>
          <label className="checkbox-label"><input type="checkbox" checked={utsOnly} onChange={(e) => setUtsOnly(e.target.checked)} /> ÜTS zorunlu</label>
          <label className="checkbox-label"><input type="checkbox" checked={includePassive} onChange={(e) => setIncludePassive(e.target.checked)} /> Pasif dahil</label>
          <button type="button" className="btn btn-sm" onClick={() => setDetailView(!detailView)}>
            {detailView ? 'Standart' : 'Detaylı'} Görünüm
          </button>
          <button type="button" className="btn btn-sm" onClick={resetFilters}>Filtre Temizle</button>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Barkod</th>
                  <th>Ürün Adı</th>
                  <th>Ana Grup</th>
                  <th>Marka</th>
                  <th>Model</th>
                  <th>Renk</th>
                  <th className="text-center">Stok</th>
                  <th className="text-right">Alış</th>
                  <th className="text-right">Satış</th>
                  {detailView && <th>Alt Grup</th>}
                  {detailView && <th>Ekartman</th>}
                  {detailView && <th>Köprü</th>}
                  {detailView && <th>Sap Uzunluğu</th>}
                  {detailView && <th>SPH</th>}
                  {detailView && <th>CYL</th>}
                  {detailView && <th>AXIS</th>}
                  {detailView && <th>ADD</th>}
                  {detailView && <th>Çap</th>}
                  {detailView && <th>Base Curve</th>}
                  {detailView && <th>Cam Tipi</th>}
                  {detailView && <th>Lens Tipi</th>}
                  {detailView && <th>UBB / ÜTS</th>}
                  {detailView && <th>Lot No</th>}
                  {detailView && <th>SKT</th>}
                  <th>Raf / Konum</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={detailView ? detailColSpan : standardColSpan} className="empty-text">Ürün bulunamadı</td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.id}
                      className={`${selectedIds.has(p.id) ? 'selected' : ''}${isCritical(p) ? ' critical-stock' : ''}`}
                      onClick={() => setSelectedIds(new Set([p.id]))}
                      onDoubleClick={async () => {
                        const product = await ipc.products.getById(p.id);
                        if (product) {
                          setSelectedIds(new Set([p.id]));
                          setSelectedProduct(product);
                          setFormMode('view');
                        }
                      }}
                    >
                      <td onClick={(e) => toggleSelect(p.id, e)}>
                        <input type="checkbox" checked={selectedIds.has(p.id)} readOnly />
                      </td>
                      <td>{p.barcode || '-'}</td>
                      <td>{p.name}</td>
                      <td>{p.group_name || p.product_type}</td>
                      <td>{p.brand_lookup_name || p.brand || '-'}</td>
                      <td>{p.model_lookup_name || p.model || '-'}</td>
                      <td>{p.color_name || p.frame_color || p.lens_color || '-'}</td>
                      <td className="text-center">{p.stock_quantity}</td>
                      <td className="text-right">{formatCurrency(p.purchase_price)}</td>
                      <td className="text-right">{formatCurrency(p.sale_price)}</td>
                      {detailView && <td>{p.subgroup_name || '-'}</td>}
                      {detailView && <td>{p.eye_size || '-'}</td>}
                      {detailView && <td>{p.bridge_size || '-'}</td>}
                      {detailView && <td>{p.temple_length || '-'}</td>}
                      {detailView && <td>{p.sph || '-'}</td>}
                      {detailView && <td>{p.cyl || '-'}</td>}
                      {detailView && <td>{p.axis || '-'}</td>}
                      {detailView && <td>{p.addition || '-'}</td>}
                      {detailView && <td>{p.diameter || '-'}</td>}
                      {detailView && <td>{p.base_curve || '-'}</td>}
                      {detailView && <td>{p.lens_type_name || '-'}</td>}
                      {detailView && <td>{p.contact_lens_type_name || p.lens_type_name || '-'}</td>}
                      {detailView && <td>{p.ubb_code || p.uts_product_no || '-'}</td>}
                      {detailView && <td>{p.lot_no || '-'}</td>}
                      {detailView && <td>{p.uts_expiry_date || '-'}</td>}
                      <td>{p.shelf_location || '-'}</td>
                      <td>{p.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {formMode && (
        <ProductForm
          product={selectedProduct}
          mode={formMode}
          onSave={handleSave}
          onDeactivate={formMode === 'edit' ? handleDeactivate : undefined}
          onCancel={closeForm}
        />
      )}

      {showImport && (
        <ProductImportWizard
          onClose={() => setShowImport(false)}
          onComplete={loadProducts}
        />
      )}

      {showLabels && labelProducts.length > 0 && (
        <LabelPrintModal
          products={labelProducts}
          onClose={() => setShowLabels(false)}
        />
      )}
    </div>
  );
}


