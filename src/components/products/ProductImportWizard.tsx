import { useState } from 'react';
import { ipc } from '@/services/ipc';
import type {
  ColumnMapping,
  DuplicateBarcodeAction,
  ImportPreviewResult,
  ImportResult,
  ParsedImportFile,
} from '@/types/importExport';
import { IMPORT_FIELD_OPTIONS } from '@/types/importExport';
import '@/components/products/ProductForm.css';

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ProductImportWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function ProductImportWizard({ onClose, onComplete }: ProductImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateBarcodeAction>('update');
  const [result, setResult] = useState<ImportResult | null>(null);

  const selectFile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ipc.products.selectImportFile();
      if (!data) {
        setLoading(false);
        return;
      }
      setParsed(data);
      setMapping(data.suggestedMapping);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    if (!parsed) return;
    setLoading(true);
    setError('');
    try {
      const p = await ipc.products.previewImport({ rows: parsed.rows, mapping });
      setPreview(p);
      setStep(3);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setLoading(true);
    setError('');
    try {
      const r = await ipc.products.importFromExcel({
        rows: parsed.rows,
        mapping,
        duplicateAction,
      });
      setResult(r);
      setStep(5);
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const validCount = preview?.rows.filter((r) => r.isValid).length ?? 0;
  const invalidCount = preview ? preview.rows.length - validCount : 0;
  const hasDbDuplicates = preview?.rows.some((r) => r.existingProductId) ?? false;

  return (
    <div className="product-form-overlay">
      <div className="product-form-panel" style={{ width: 920, maxHeight: '90vh' }}>
        <div className="product-form-header">
          <span>Excel&apos;den Ürün Aktarımı — Adım {step}/5</span>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="product-form-body">
          {error && <div className="alert alert-error product-form-alert">{error}</div>}
          {loading && <div className="loading-text">İşleniyor...</div>}

          {step === 1 && !loading && (
            <div>
              <p style={{ fontSize: 12, marginBottom: 12 }}>
                .xlsx, .xls veya .csv formatında ürün listesi seçin. İlk satır başlık olarak kabul edilir.
              </p>
              <button className="btn btn-primary" onClick={selectFile}>Dosya Seç</button>
            </div>
          )}

          {step === 2 && parsed && !loading && (
            <div>
              <p style={{ fontSize: 12, marginBottom: 8 }}>
                <strong>{parsed.fileName}</strong> — {parsed.rows.length} satır
              </p>
              <table className="data-table">
                <thead>
                  <tr><th>Excel Sütunu</th><th>Eşleşen Alan</th></tr>
                </thead>
                <tbody>
                  {parsed.headers.map((h) => (
                    <tr key={h}>
                      <td>{h}</td>
                      <td>
                        <select
                          className="form-select"
                          value={mapping[h] || ''}
                          onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as ColumnMapping[string] })}
                        >
                          <option value="">— Eşleştirme —</option>
                          {IMPORT_FIELD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setStep(1)}>Geri</button>
                <button className="btn btn-primary" style={{ marginLeft: 6 }} onClick={runPreview}>Ön İzleme</button>
              </div>
            </div>
          )}

          {step === 3 && preview && !loading && (
            <div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                Geçerli: <strong>{validCount}</strong> | Hatalı: <strong className="amount-negative">{invalidCount}</strong>
                {preview.duplicateBarcodesInFile.length > 0 && (
                  <span style={{ marginLeft: 8 }}>Dosyada tekrar eden barkod: {preview.duplicateBarcodesInFile.join(', ')}</span>
                )}
              </div>

              {hasDbDuplicates && (
                <div className="panel" style={{ marginBottom: 8 }}>
                  <div className="panel-header">Barkod Çakışması</div>
                  <div className="panel-body" style={{ fontSize: 12 }}>
                    <label>
                      <input type="radio" checked={duplicateAction === 'update'} onChange={() => setDuplicateAction('update')} />
                      {' '}Mevcut ürünü güncelle
                    </label>
                    <label style={{ marginLeft: 16 }}>
                      <input type="radio" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} />
                      {' '}Satırı atla
                    </label>
                  </div>
                </div>
              )}

              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Satır</th><th>Ürün</th><th>Barkod</th><th>Tip</th><th>Durum</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.rowIndex} className={!r.isValid ? 'critical-stock' : ''}>
                        <td>{r.rowIndex}</td>
                        <td>{String(r.data.name || '-')}</td>
                        <td>{String(r.data.barcode || '-')}</td>
                        <td>{String(r.data.product_type || '-')}</td>
                        <td style={{ fontSize: 11 }}>
                          {!r.isValid && <span className="amount-negative">{r.errors.join('; ')}</span>}
                          {r.isValid && r.warnings.length > 0 && <span style={{ color: '#b8860b' }}>{r.warnings.join('; ')}</span>}
                          {r.isValid && r.warnings.length === 0 && 'OK'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setStep(2)}>Geri</button>
                <button className="btn btn-primary" style={{ marginLeft: 6 }} onClick={() => setStep(4)} disabled={validCount === 0}>
                  Aktarımı Onayla
                </button>
              </div>
            </div>
          )}

          {step === 4 && !loading && (
            <div style={{ fontSize: 12 }}>
              <p><strong>{validCount}</strong> ürün aktarılacak. Hatalı satırlar atlanacak.</p>
              <p>Barkod çakışması: <strong>{duplicateAction === 'update' ? 'Mevcut ürünü güncelle' : 'Satırı atla'}</strong></p>
              <button className="btn" onClick={() => setStep(3)}>Geri</button>
              <button className="btn btn-primary" style={{ marginLeft: 6 }} onClick={runImport}>Aktar</button>
            </div>
          )}

          {step === 5 && result && (
            <div style={{ fontSize: 12 }}>
              <p><strong>Aktarım tamamlandı</strong></p>
              <ul>
                <li>Eklenen: <strong className="amount-positive">{result.added}</strong></li>
                <li>Güncellenen: <strong>{result.updated}</strong></li>
                <li>Atlanan: <strong>{result.skipped}</strong></li>
              </ul>
              {result.errors.length > 0 && (
                <div className="panel" style={{ marginTop: 8 }}>
                  <div className="panel-header">Hatalı Satırlar</div>
                  <table className="data-table">
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i}><td>{e.rowIndex}</td><td className="amount-negative">{e.message}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 10 }}>Kapat</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
