import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product, ProductInput, ProductType } from '@/types/electron';
import { GENDER_OPTIONS, PRODUCT_TYPES, UTS_STATUSES } from '@/types/electron';
import { ipc } from '@/services/ipc';
import type { ParsedBarcode } from '@/types/barcode';
import { sanitizeBarcode } from '@/utils/barcode';
import { getGroupFieldProfile } from '@/types/opticalLookup';
import TransposeTool from '@/components/products/TransposeTool';
import './ProductForm.css';

type FormTab = 'general' | 'optical' | 'stock' | 'barcode' | 'uts' | 'notes';

const emptyForm = (): ProductInput => ({
  barcode: '',
  stock_code: '',
  name: '',
  product_type: 'Çerçeve',
  brand: '',
  model: '',
  category: '',
  purchase_price: 0,
  sale_price: 0,
  vat_rate: 20,
  stock_quantity: 0,
  min_stock: 0,
  shelf_location: '',
  description: '',
  status: 'Aktif',
  extra_fields: {},
});

interface ProductFormProps {
  product?: Product | null;
  mode: 'create' | 'edit' | 'view';
  onSave: (input: ProductInput) => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onCancel: () => void;
}

export default function ProductForm({
  product,
  mode,
  onSave,
  onDeactivate,
  onCancel,
}: ProductFormProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductInput>(emptyForm());
  const [tab, setTab] = useState<FormTab>('general');
  const [groups, setGroups] = useState<Record<string, unknown>[]>([]);
  const [subgroups, setSubgroups] = useState<Record<string, unknown>[]>([]);
  const [brands, setBrands] = useState<Record<string, unknown>[]>([]);
  const [models, setModels] = useState<Record<string, unknown>[]>([]);
  const [colors, setColors] = useState<Record<string, unknown>[]>([]);
  const [frameTypes, setFrameTypes] = useState<Record<string, unknown>[]>([]);
  const [frameMaterials, setFrameMaterials] = useState<Record<string, unknown>[]>([]);
  const [lensTypes, setLensTypes] = useState<Record<string, unknown>[]>([]);
  const [lensMaterials, setLensMaterials] = useState<Record<string, unknown>[]>([]);
  const [lensCoatings, setLensCoatings] = useState<Record<string, unknown>[]>([]);
  const [contactLensTypes, setContactLensTypes] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [parsedScan, setParsedScan] = useState<ParsedBarcode | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const readOnly = mode === 'view';

  useEffect(() => {
    ipc.opticalLookups.listByType('PRODUCT_GROUP').then(setGroups).catch(() => undefined);
    ipc.opticalLookups.listByType('BRAND').then(setBrands).catch(() => undefined);
    ipc.opticalLookups.listByType('COLOR').then(setColors).catch(() => undefined);
    ipc.opticalLookups.listByType('FRAME_TYPE').then(setFrameTypes).catch(() => undefined);
    ipc.opticalLookups.listByType('FRAME_MATERIAL').then(setFrameMaterials).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_TYPE').then(setLensTypes).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_MATERIAL').then(setLensMaterials).catch(() => undefined);
    ipc.opticalLookups.listByType('LENS_COATING').then(setLensCoatings).catch(() => undefined);
    ipc.opticalLookups.listByType('CONTACT_LENS_TYPE').then(setContactLensTypes).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (form.group_id) {
      ipc.opticalLookups.listChildren(form.group_id).then(setSubgroups).catch(() => setSubgroups([]));
    } else setSubgroups([]);
  }, [form.group_id]);

  useEffect(() => {
    if (form.brand_id) {
      ipc.opticalLookups.listChildren(form.brand_id).then(setModels).catch(() => setModels([]));
    } else setModels([]);
  }, [form.brand_id]);

  const selectedGroupName = useMemo(() => {
    if (form.group_id) {
      const g = groups.find((x) => Number(x.id) === form.group_id);
      return g ? String(g.name) : form.group_name || '';
    }
    return form.group_name || '';
  }, [form.group_id, form.group_name, groups]);

  const fieldProfile = useMemo(() => getGroupFieldProfile(selectedGroupName || form.product_type), [selectedGroupName, form.product_type]);

  useEffect(() => {
    if (product) {
      setForm({
        barcode: product.barcode || '',
        stock_code: product.stock_code || '',
        name: product.name,
        product_type: product.product_type,
        brand: product.brand || '',
        model: product.model || '',
        category: product.category || '',
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        vat_rate: product.vat_rate ?? 20,
        stock_quantity: product.stock_quantity,
        min_stock: product.min_stock ?? 0,
        shelf_location: product.shelf_location || '',
        description: product.description || '',
        status: product.status || 'Aktif',
        extra_fields: (product.extra_fields as Record<string, string>) || {},
        ubb_code: product.ubb_code || '',
        uts_product_no: product.uts_product_no || '',
        uts_barcode: product.uts_barcode || '',
        serial_no: product.serial_no || '',
        lot_no: product.lot_no || '',
        uts_expiry_date: product.uts_expiry_date || '',
        medical_device_class: product.medical_device_class || '',
        uts_tracking_required: !!product.uts_tracking_required,
        uts_status: product.uts_status || 'Bekliyor',
        uts_note: product.uts_note || '',
        group_id: product.group_id ?? null,
        subgroup_id: product.subgroup_id ?? null,
        brand_id: product.brand_id ?? null,
        model_id: product.model_id ?? null,
        color_id: product.color_id ?? null,
        frame_type_id: product.frame_type_id ?? null,
        frame_material_id: product.frame_material_id ?? null,
        lens_type_id: product.lens_type_id ?? null,
        lens_material_id: product.lens_material_id ?? null,
        lens_coating_id: product.lens_coating_id ?? null,
        contact_lens_type_id: product.contact_lens_type_id ?? null,
        gender: product.gender || '',
        frame_color: product.frame_color || '',
        lens_color: product.lens_color || '',
        frame_shape: product.frame_shape || '',
        eye_size: product.eye_size || '',
        bridge_size: product.bridge_size || '',
        temple_length: product.temple_length || '',
        sph: product.sph || '',
        cyl: product.cyl || '',
        axis: product.axis || '',
        addition: product.addition || '',
        diameter: product.diameter || '',
        base_curve: product.base_curve || '',
        lens_index: product.lens_index || '',
        usage_period: product.usage_period || '',
        package_quantity: product.package_quantity || '',
        season: product.season || '',
        collection_name: product.collection_name || '',
        accessory_type: product.accessory_type || '',
        material: product.material || '',
        compatible_product: product.compatible_product || '',
        label_name: product.label_name || '',
        last_purchase_price: product.last_purchase_price ?? null,
        average_cost: product.average_cost ?? null,
        is_polarized: !!product.is_polarized,
        has_uv_protection: !!product.has_uv_protection,
        has_blue_light_filter: !!product.has_blue_light_filter,
        is_photochromic: !!product.is_photochromic,
        is_progressive: !!product.is_progressive,
        group_name: product.group_name,
        subgroup_name: product.subgroup_name,
      });
    } else {
      setForm(emptyForm());
    }
    setTab('general');
    setError('');
  }, [product, mode]);

  const setField = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setExtra = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      extra_fields: { ...(prev.extra_fields as Record<string, string>), [key]: value },
    }));
  };

  const extra = (form.extra_fields || {}) as Record<string, string>;

  const validateClient = (): string | null => {
    if (!form.name.trim()) return 'Ürün adı zorunludur.';
    if (!form.product_type) return 'Ürün tipi zorunludur.';
    if (form.purchase_price < 0) return 'Alış fiyatı negatif olamaz.';
    if (form.sale_price < 0) return 'Satış fiyatı negatif olamaz.';
    if (form.stock_quantity < 0) return 'Stok miktarı negatif olamaz.';
    return null;
  };

  const handleSave = async () => {
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const lookupSelect = (
    label: string,
    value: number | null | undefined,
    options: Record<string, unknown>[],
    onChange: (id: number | null) => void
  ) => (
    <div className="form-group">
      <label>{label}</label>
      <select
        className="form-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={readOnly}
      >
        <option value="">Seçiniz</option>
        {options.map((o) => <option key={String(o.id)} value={String(o.id)}>{String(o.name)}</option>)}
      </select>
    </div>
  );

  const renderOpticalFields = () => {
    if (fieldProfile === 'FRAME') {
      return (
        <>
          <div className="form-row">
            {lookupSelect('Çerçeve Tipi', form.frame_type_id, frameTypes, (id) => setField('frame_type_id', id))}
            {lookupSelect('Çerçeve Materyali', form.frame_material_id, frameMaterials, (id) => setField('frame_material_id', id))}
            {lookupSelect('Renk', form.color_id, colors, (id) => setField('color_id', id))}
            <div className="form-group"><label>Çerçeve Rengi</label><input className="form-input" value={form.frame_color || ''} onChange={(e) => setField('frame_color', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Cam Rengi</label><input className="form-input" value={form.lens_color || ''} onChange={(e) => setField('lens_color', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Ekartman</label><input className="form-input" value={form.eye_size || extra.size || ''} onChange={(e) => setField('eye_size', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Köprü</label><input className="form-input" value={form.bridge_size || extra.bridge_size || ''} onChange={(e) => setField('bridge_size', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Sap Uzunluğu</label><input className="form-input" value={form.temple_length || extra.temple_length || ''} onChange={(e) => setField('temple_length', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Çerçeve Şekli</label><input className="form-input" value={form.frame_shape || ''} onChange={(e) => setField('frame_shape', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group">
              <label>Cinsiyet</label>
              <select className="form-select" value={form.gender || extra.gender || ''} onChange={(e) => setField('gender', e.target.value)} disabled={readOnly}>
                <option value="">Seçiniz</option>
                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Koleksiyon / Sezon</label><input className="form-input" value={form.collection_name || ''} onChange={(e) => setField('collection_name', e.target.value)} readOnly={readOnly} /></div>
            <label className="checkbox-label"><input type="checkbox" checked={!!form.is_polarized} onChange={(e) => setField('is_polarized', e.target.checked)} disabled={readOnly} /> Polarize</label>
            <label className="checkbox-label"><input type="checkbox" checked={!!form.has_uv_protection} onChange={(e) => setField('has_uv_protection', e.target.checked)} disabled={readOnly} /> UV Koruma</label>
          </div>
        </>
      );
    }
    if (fieldProfile === 'GLASS') {
      return (
        <>
          <div className="form-row">
            {lookupSelect('Cam Tipi', form.lens_type_id, lensTypes, (id) => setField('lens_type_id', id))}
            {lookupSelect('Cam Materyali', form.lens_material_id, lensMaterials, (id) => setField('lens_material_id', id))}
            {lookupSelect('Kaplama', form.lens_coating_id, lensCoatings, (id) => setField('lens_coating_id', id))}
            <div className="form-group"><label>Cam İndeksi</label><input className="form-input" value={form.lens_index || extra.index || ''} onChange={(e) => setField('lens_index', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Cam Rengi</label><input className="form-input" value={form.lens_color || ''} onChange={(e) => setField('lens_color', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>SPH</label><input className="form-input" value={form.sph || extra.sph || ''} onChange={(e) => setField('sph', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>CYL</label><input className="form-input" value={form.cyl || extra.cyl || ''} onChange={(e) => setField('cyl', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>AXIS</label><input className="form-input" value={form.axis || extra.ax || ''} onChange={(e) => setField('axis', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>ADD</label><input className="form-input" value={form.addition || extra.add || ''} onChange={(e) => setField('addition', e.target.value)} readOnly={readOnly} /></div>
            <div className="form-group"><label>Çap</label><input className="form-input" value={form.diameter || extra.diameter || ''} onChange={(e) => setField('diameter', e.target.value)} readOnly={readOnly} /></div>
            <label className="checkbox-label"><input type="checkbox" checked={!!form.is_photochromic} onChange={(e) => setField('is_photochromic', e.target.checked)} disabled={readOnly} /> Fotokromik</label>
            <label className="checkbox-label"><input type="checkbox" checked={!!form.has_blue_light_filter} onChange={(e) => setField('has_blue_light_filter', e.target.checked)} disabled={readOnly} /> Mavi Işık Filtreli</label>
            <label className="checkbox-label"><input type="checkbox" checked={!!form.is_progressive} onChange={(e) => setField('is_progressive', e.target.checked)} disabled={readOnly} /> Progresif</label>
          </div>
          {!readOnly && (
            <TransposeTool
              initial={{ sph: form.sph || extra.sph, cyl: form.cyl || extra.cyl, axis: form.axis || extra.ax }}
              onApply={(r) => { setField('sph', r.sph); setField('cyl', r.cyl); setField('axis', r.axis); }}
            />
          )}
        </>
      );
    }
    if (fieldProfile === 'CONTACT') {
      return (
        <div className="form-row">
          {lookupSelect('Lens Tipi', form.contact_lens_type_id, contactLensTypes, (id) => setField('contact_lens_type_id', id))}
          {lookupSelect('Renk', form.color_id, colors, (id) => setField('color_id', id))}
          <div className="form-group"><label>Kullanım Süresi</label><input className="form-input" value={form.usage_period || ''} onChange={(e) => setField('usage_period', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>SPH</label><input className="form-input" value={form.sph || extra.sph || ''} onChange={(e) => setField('sph', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>CYL</label><input className="form-input" value={form.cyl || extra.cyl || ''} onChange={(e) => setField('cyl', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>AXIS</label><input className="form-input" value={form.axis || extra.ax || ''} onChange={(e) => setField('axis', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>ADD</label><input className="form-input" value={form.addition || extra.add || ''} onChange={(e) => setField('addition', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>Base Curve</label><input className="form-input" value={form.base_curve || extra.bc || ''} onChange={(e) => setField('base_curve', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>Çap (DIA)</label><input className="form-input" value={form.diameter || extra.dia || ''} onChange={(e) => setField('diameter', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>Paket İçeriği</label><input className="form-input" value={form.package_quantity || ''} onChange={(e) => setField('package_quantity', e.target.value)} readOnly={readOnly} /></div>
        </div>
      );
    }
    if (fieldProfile === 'ACCESSORY') {
      return (
        <div className="form-row">
          <div className="form-group"><label>Aksesuar Türü</label><input className="form-input" value={form.accessory_type || ''} onChange={(e) => setField('accessory_type', e.target.value)} readOnly={readOnly} /></div>
          {lookupSelect('Renk', form.color_id, colors, (id) => setField('color_id', id))}
          <div className="form-group"><label>Materyal</label><input className="form-input" value={form.material || ''} onChange={(e) => setField('material', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>Uyumlu Ürün</label><input className="form-input" value={form.compatible_product || ''} onChange={(e) => setField('compatible_product', e.target.value)} readOnly={readOnly} /></div>
          <div className="form-group"><label>Paket İçeriği</label><input className="form-input" value={form.package_quantity || ''} onChange={(e) => setField('package_quantity', e.target.value)} readOnly={readOnly} /></div>
        </div>
      );
    }
    return <p className="form-hint">Ana grup seçildiğinde optik alanlar burada görünür.</p>;
  };

  const title = mode === 'create' ? 'Yeni Ürün' : mode === 'edit' ? 'Ürün Düzenle' : 'Ürün Detayı';

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel">
        <div className="product-form-header">
          <span>{title}</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>

        {error && <div className="alert alert-error product-form-alert">{error}</div>}

        <div className="product-form-tabs">
          {(['general', 'optical', 'stock', 'barcode', 'uts', 'notes'] as FormTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tab-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'general' && 'Genel Bilgiler'}
              {t === 'optical' && 'Optik Özellikler'}
              {t === 'stock' && 'Stok / Fiyat'}
              {t === 'barcode' && 'Barkod / Etiket'}
              {t === 'uts' && 'ÜTS / UBB'}
              {t === 'notes' && 'Notlar'}
            </button>
          ))}
        </div>

        <div className="product-form-body">
          {tab === 'general' && (
            <div className="form-row">
              {lookupSelect('Ana Grup', form.group_id, groups, (id) => {
                setField('group_id', id);
                const g = groups.find((x) => Number(x.id) === id);
                if (g) setField('product_type', String(g.name) as ProductType);
              })}
              {lookupSelect('Alt Grup', form.subgroup_id, subgroups, (id) => setField('subgroup_id', id))}
              <div className="form-group">
                <label>Ürün Tipi *</label>
                <select className="form-select" value={form.product_type} onChange={(e) => setField('product_type', e.target.value as ProductType)} disabled={readOnly}>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {lookupSelect('Marka', form.brand_id, brands, (id) => {
                setField('brand_id', id);
                const b = brands.find((x) => Number(x.id) === id);
                if (b) setField('brand', String(b.name));
              })}
              {lookupSelect('Model', form.model_id, models, (id) => {
                setField('model_id', id);
                const m = models.find((x) => Number(x.id) === id);
                if (m) setField('model', String(m.name));
              })}
              <div className="form-group">
                <label>Ürün Adı *</label>
                <input className="form-input" value={form.name} onChange={(e) => setField('name', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Stok Kodu</label>
                <input className="form-input" value={form.stock_code || ''} onChange={(e) => setField('stock_code', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Barkod / GTIN</label>
                <input className="form-input" value={form.barcode || ''} onChange={(e) => setField('barcode', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Durum</label>
                <select className="form-select" value={form.status || 'Aktif'} onChange={(e) => setField('status', e.target.value)} disabled={readOnly}>
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>
            </div>
          )}

          {tab === 'optical' && renderOpticalFields()}

          {tab === 'uts' && (
            <>
            <div className="form-row">
              <div className="form-group"><label>UBB Kodu</label><input className="form-input" value={form.ubb_code || ''} onChange={(e) => setField('ubb_code', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>ÜTS Ürün No</label><input className="form-input" value={form.uts_product_no || ''} onChange={(e) => setField('uts_product_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Barkod / Karekod</label><input className="form-input" value={form.uts_barcode || ''} onChange={(e) => setField('uts_barcode', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Seri No</label><input className="form-input" value={form.serial_no || ''} onChange={(e) => setField('serial_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Lot / Parti No</label><input className="form-input" value={form.lot_no || ''} onChange={(e) => setField('lot_no', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Son Kullanma Tarihi</label><input type="date" className="form-input" value={form.uts_expiry_date || ''} onChange={(e) => setField('uts_expiry_date', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group"><label>Tıbbi Cihaz Sınıfı</label><input className="form-input" value={form.medical_device_class || ''} onChange={(e) => setField('medical_device_class', e.target.value)} readOnly={readOnly} /></div>
              <div className="form-group">
                <label>ÜTS Takip Zorunlu</label>
                <select className="form-select" value={form.uts_tracking_required ? '1' : '0'} onChange={(e) => setField('uts_tracking_required', e.target.value === '1')} disabled={readOnly}>
                  <option value="0">Hayır</option>
                  <option value="1">Evet</option>
                </select>
              </div>
              <div className="form-group">
                <label>ÜTS İşlem Durumu</label>
                <select className="form-select" value={form.uts_status || 'Bekliyor'} onChange={(e) => setField('uts_status', e.target.value)} disabled={readOnly}>
                  {UTS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>ÜTS Notu</label>
                <input className="form-input" value={form.uts_note || ''} onChange={(e) => setField('uts_note', e.target.value)} readOnly={readOnly} />
              </div>
            </div>
            {!readOnly && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Karekod Test Alanı</div>
                <input
                  ref={scanRef}
                  className="form-input"
                  placeholder="DataMatrix / GS1 karekod okutun"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      const code = sanitizeBarcode(scanInput);
                      if (!code) return;
                      try {
                        const p = await ipc.barcode.parse(code);
                        setParsedScan(p);
                        setScanInput('');
                      } catch {
                        setError('Karekod çözümlenemedi.');
                      }
                    }
                  }}
                />
                {parsedScan && (
                  <div style={{ fontSize: 12, marginTop: 8 }}>
                    <div>Tip: {parsedScan.type}</div>
                    <div>GTIN: {parsedScan.gtin || '-'}</div>
                    <div>Seri: {parsedScan.serialNo || '-'}</div>
                    <div>Lot: {parsedScan.lotNo || '-'}</div>
                    <div>SKT: {parsedScan.expiryDate || '-'}</div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        if (parsedScan.barcode) setField('barcode', parsedScan.barcode);
                        if (parsedScan.gtin) setField('uts_barcode', parsedScan.gtin);
                        if (parsedScan.serialNo) setField('serial_no', parsedScan.serialNo);
                        if (parsedScan.lotNo) setField('lot_no', parsedScan.lotNo);
                        if (parsedScan.expiryDate) setField('uts_expiry_date', parsedScan.expiryDate);
                      }}
                    >
                      Bu Bilgileri Ürüne Aktar
                    </button>
                  </div>
                )}
              </div>
            )}
            </>
          )}

          {tab === 'stock' && (
            <div className="form-row">
              <div className="form-group">
                <label>Alış Fiyatı</label>
                <input type="number" min="0" step="0.01" className="form-input" value={form.purchase_price} onChange={(e) => setField('purchase_price', parseFloat(e.target.value) || 0)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Satış Fiyatı</label>
                <input type="number" min="0" step="0.01" className="form-input" value={form.sale_price} onChange={(e) => setField('sale_price', parseFloat(e.target.value) || 0)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>KDV Oranı (%)</label>
                <input type="number" min="0" className="form-input" value={form.vat_rate ?? 20} onChange={(e) => setField('vat_rate', parseFloat(e.target.value) || 0)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Stok Miktarı</label>
                <input type="number" min="0" className="form-input" value={form.stock_quantity} onChange={(e) => setField('stock_quantity', parseInt(e.target.value, 10) || 0)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Minimum Stok</label>
                <input type="number" min="0" className="form-input" value={form.min_stock ?? 0} onChange={(e) => setField('min_stock', parseInt(e.target.value, 10) || 0)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Raf / Konum</label>
                <input className="form-input" value={form.shelf_location || ''} onChange={(e) => setField('shelf_location', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Son Alış Fiyatı</label>
                <input type="number" className="form-input" value={form.last_purchase_price ?? ''} onChange={(e) => setField('last_purchase_price', e.target.value ? parseFloat(e.target.value) : null)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Ortalama Maliyet</label>
                <input type="number" className="form-input" value={form.average_cost ?? ''} onChange={(e) => setField('average_cost', e.target.value ? parseFloat(e.target.value) : null)} readOnly={readOnly} placeholder="İleride kullanılacak" />
              </div>
            </div>
          )}

          {tab === 'barcode' && (
            <div className="form-row">
              <div className="form-group">
                <label>Birincil Barkod / GTIN</label>
                <input className="form-input" value={form.barcode || ''} onChange={(e) => setField('barcode', e.target.value)} readOnly={readOnly} />
              </div>
              <div className="form-group">
                <label>Etiket Adı</label>
                <input className="form-input" value={form.label_name || ''} onChange={(e) => setField('label_name', e.target.value)} readOnly={readOnly} placeholder={form.name || 'Ürün adı kullanılır'} />
              </div>
              {!readOnly && (
                <button type="button" className="btn btn-sm" onClick={() => navigate('/ayarlar?tab=barcode')}>
                  Karekod Test Alanına Git
                </button>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="form-group">
              <label>Açıklama / Not</label>
              <textarea className="form-textarea" value={form.description || ''} onChange={(e) => setField('description', e.target.value)} readOnly={readOnly} rows={5} />
            </div>
          )}
        </div>

        <div className="product-form-footer">
          {mode !== 'view' && (
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
          {mode === 'edit' && onDeactivate && product?.status === 'Aktif' && (
            <button type="button" className="btn btn-danger" onClick={onDeactivate} disabled={saving}>
              Pasife Al
            </button>
          )}
          <button type="button" className="btn" onClick={onCancel}>
            {mode === 'view' ? 'Kapat' : 'Vazgeç'}
          </button>
        </div>
      </div>
    </div>
  );
}
