import { useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { openPrintPreview } from '@/utils/print';
import type { Product } from '@/types/electron';
import type { LabelItemInput, LabelSettings, LabelTemplate } from '@/types/importExport';
import { LABEL_TEMPLATE_LABELS } from '@/types/importExport';
import '@/components/products/ProductForm.css';

interface LabelPrintModalProps {
  products: Product[];
  onClose: () => void;
}

export default function LabelPrintModal({ products, onClose }: LabelPrintModalProps) {
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [template, setTemplate] = useState<LabelTemplate>('standard');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [allowNoBarcode, setAllowNoBarcode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ipc.settings.getLabelSettings().then((s) => {
      setSettings(s);
      setTemplate(s.defaultTemplate);
    }).catch(console.error);

    const initial: Record<number, number> = {};
    for (const p of products) initial[p.id] = 1;
    setQuantities(initial);
  }, [products]);

  const items: LabelItemInput[] = products.map((p) => ({
    productId: p.id,
    quantity: quantities[p.id] || 1,
  }));

  const productsWithoutBarcode = products.filter((p) => !p.barcode?.trim());

  const handlePreview = async () => {
    setError('');
    setLoading(true);
    try {
      const doc = await ipc.labels.preview({ items, template, allowNoBarcode });
      if (settings?.previewBeforePrint !== false) {
        openPrintPreview(doc);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setError('');
    setLoading(true);
    try {
      const doc = await ipc.labels.print({ items, template, allowNoBarcode });
      openPrintPreview(doc);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 640, maxHeight: '90vh' }}>
        <div className="product-form-header">
          <span>Etiket Bas — {products.length} ürün</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="product-form-body">
          {error && <div className="alert alert-error product-form-alert">{error}</div>}
          {loading && <div className="loading-text">Hazırlanıyor...</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Etiket Şablonu</label>
              <select className="form-select" value={template} onChange={(e) => setTemplate(e.target.value as LabelTemplate)}>
                {(Object.keys(LABEL_TEMPLATE_LABELS) as LabelTemplate[]).map((t) => (
                  <option key={t} value={t}>{LABEL_TEMPLATE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {productsWithoutBarcode.length > 0 && (
            <div className="alert" style={{ fontSize: 12, marginBottom: 8, background: '#fff8e6', border: '1px solid #e6c200' }}>
              {productsWithoutBarcode.length} üründe barkod yok.
              <label style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={allowNoBarcode} onChange={(e) => setAllowNoBarcode(e.target.checked)} />
                {' '}Barkodsuz etiket bas
              </label>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr><th>Ürün</th><th>Barkod</th><th className="text-center">Etiket Adedi</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.barcode || <span className="amount-negative">—</span>}</td>
                  <td className="text-center">
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 60 }}
                      min={1}
                      max={999}
                      value={quantities[p.id] || 1}
                      onChange={(e) => setQuantities({ ...quantities, [p.id]: parseInt(e.target.value, 10) || 1 })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="product-form-footer">
          <button className="btn" onClick={handlePreview} disabled={loading}>Ön İzleme</button>
          <button className="btn btn-primary" onClick={handlePrint} disabled={loading}>Yazdır</button>
          <button className="btn" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
