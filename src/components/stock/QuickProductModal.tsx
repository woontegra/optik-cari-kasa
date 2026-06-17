import { useState } from 'react';
import { ipc } from '@/services/ipc';
import { PRODUCT_TYPES } from '@/types/electron';
import type { ProductType } from '@/types/electron';
import type { ParsedBarcode } from '@/types/barcode';
import '@/components/products/ProductForm.css';

export interface QuickProductResult {
  productId: number;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  shelfLocation: string;
  barcode: string;
  serialNo?: string;
  lotNo?: string;
  expiryDate?: string;
}

interface QuickProductModalProps {
  barcode: string;
  initialParsed?: ParsedBarcode;
  onSave: (result: QuickProductResult) => void;
  onCancel: () => void;
}

export default function QuickProductModal({ barcode, initialParsed, onSave, onCancel }: QuickProductModalProps) {
  const [name, setName] = useState('');
  const [productType, setProductType] = useState<ProductType>('Çerçeve');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [shelfLocation, setShelfLocation] = useState('');
  const [barcodeField, setBarcodeField] = useState(barcode);
  const [serialNo, setSerialNo] = useState(initialParsed?.serialNo || '');
  const [lotNo, setLotNo] = useState(initialParsed?.lotNo || '');
  const [expiryDate, setExpiryDate] = useState(initialParsed?.expiryDate || '');
  const [ubbCode, setUbbCode] = useState(initialParsed?.ubbCode || '');
  const [utsProductNo, setUtsProductNo] = useState(initialParsed?.utsProductNo || '');
  const [utsBarcode, setUtsBarcode] = useState(initialParsed?.gtin || initialParsed?.barcode || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Ürün adı zorunludur.');
      return;
    }
    if (quantity <= 0) {
      setError('Giriş adedi en az 1 olmalıdır.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await ipc.products.create({
        barcode: barcodeField,
        name: name.trim(),
        product_type: productType,
        brand: brand || undefined,
        model: model || undefined,
        category: category || undefined,
        purchase_price: purchasePrice,
        sale_price: salePrice,
        stock_quantity: 0,
        shelf_location: shelfLocation || undefined,
        ubb_code: ubbCode || undefined,
        uts_product_no: utsProductNo || undefined,
        uts_barcode: utsBarcode || undefined,
        serial_no: serialNo || undefined,
        lot_no: lotNo || undefined,
        uts_expiry_date: expiryDate || undefined,
      });
      onSave({
        productId: result.id,
        quantity,
        purchasePrice,
        salePrice,
        shelfLocation,
        barcode: barcodeField,
        serialNo: serialNo || undefined,
        lotNo: lotNo || undefined,
        expiryDate: expiryDate || undefined,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 560, maxHeight: '92vh' }}>
        <div className="product-form-header">
          <span>Hızlı Ürün Oluştur</span>
          <button type="button" className="btn-close" onClick={onCancel}>×</button>
        </div>
        <div className="product-form-body">
          {error && <div className="alert alert-error product-form-alert">{error}</div>}
          {initialParsed?.type === 'GS1_DATAMATRIX' && (
            <div className="alert alert-info" style={{ marginBottom: 8, fontSize: 12 }}>
              Karekod çözümlendi — alanlar otomatik dolduruldu.
            </div>
          )}
          <div className="form-group">
            <label>Barkod / GTIN</label>
            <input className="form-input" value={barcodeField} onChange={(e) => setBarcodeField(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ürün Adı *</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Seri No</label>
              <input className="form-input" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Lot / Parti No</label>
              <input className="form-input" value={lotNo} onChange={(e) => setLotNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Son Kullanma</label>
              <input type="date" className="form-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ürün Tipi</label>
              <select className="form-select" value={productType} onChange={(e) => setProductType(e.target.value as ProductType)}>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Giriş Adedi</label>
              <input type="number" min={1} className="form-input" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Marka</label>
              <input className="form-input" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input className="form-input" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Kategori</label>
              <input className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Raf / Konum</label>
              <input className="form-input" value={shelfLocation} onChange={(e) => setShelfLocation(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Alış Fiyatı</label>
              <input type="number" min={0} step={0.01} className="form-input" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Satış Fiyatı</label>
              <input type="number" min={0} step={0.01} className="form-input" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>UBB Kodu</label>
              <input className="form-input" value={ubbCode} onChange={(e) => setUbbCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ÜTS Ürün No</label>
              <input className="form-input" value={utsProductNo} onChange={(e) => setUtsProductNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ÜTS Barkod / GTIN</label>
              <input className="form-input" value={utsBarcode} onChange={(e) => setUtsBarcode(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="product-form-footer">
          <button type="button" className="btn" onClick={onCancel} disabled={loading}>Vazgeç</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kaydet ve Listeye Ekle'}
          </button>
        </div>
      </div>
    </div>
  );
}
