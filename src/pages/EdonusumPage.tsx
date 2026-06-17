import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/types/auth';
import PageTitleBar from '@/components/layout/PageTitleBar';

const DISCLAIMER =
  'Bu modül e-fatura/e-arşiv/e-irsaliye hazırlık ve takip amaçlıdır. Resmi gönderim kullanıcı tarafından kendi e-dönüşüm sistemi üzerinden yapılır.';

type Tab =
  | 'sale'
  | 'purchase'
  | 'sgk'
  | 'drafts'
  | 'waybill'
  | 'history'
  | 'settings';

const TAB_URL: Record<string, Tab> = {
  sale: 'sale',
  purchase: 'purchase',
  sgk: 'sgk',
  drafts: 'drafts',
  waybill: 'waybill',
  history: 'history',
  settings: 'settings',
};

const DOC_TYPES = ['E-Arşiv', 'E-Fatura', 'Kağıt Fatura Notu', 'Bilgi Fişi'];
const PROVIDERS = ['Paraşüt', 'BirFatura', 'Logo', 'Uyumsoft', 'QNB', 'Diğer'];
const USAGE_MODES = ['Manuel aktarım', 'Excel aktarım', 'XML aktarım', 'API entegrasyonu ileride'];
const SCENARIOS = ['Temel', 'Ticari', 'E-Arşiv'];

export default function EdonusumPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.EINVOICE_EDIT);
  const canExport = hasPermission(PERMISSIONS.EINVOICE_EXPORT);
  const canOfficial = hasPermission(PERMISSIONS.EINVOICE_MARK_OFFICIAL);
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(TAB_URL[initial || ''] || 'sale');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [sales, setSales] = useState<Record<string, unknown>[]>([]);
  const [purchases, setPurchases] = useState<Record<string, unknown>[]>([]);
  const [sgkBatches, setSgkBatches] = useState<Record<string, unknown>[]>([]);
  const [stockEntries, setStockEntries] = useState<Record<string, unknown>[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [docType, setDocType] = useState('E-Arşiv');
  const [officialNo, setOfficialNo] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t);
    setSearchParams({ tab: t });
    setSelectedId(null);
    setError('');
  };

  const loadDrafts = useCallback(() => {
    ipc.invoiceDrafts.list(tab === 'history' ? {} : {}).then(setDrafts).catch(console.error);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    const done = () => setLoading(false);
    if (tab === 'sale') ipc.sales.list({ status: 'Tamamlandı' }).then(setSales).catch(console.error).finally(done);
    else if (tab === 'purchase') ipc.purchases.list().then(setPurchases).catch(console.error).finally(done);
    else if (tab === 'sgk') ipc.sgkInvoices.listBatches().then(setSgkBatches).catch(console.error).finally(done);
    else if (tab === 'waybill') ipc.stockEntry.listBatches().then(setStockEntries).catch(console.error).finally(done);
    else if (tab === 'settings') ipc.einvoiceSettings.get().then(setSettings).catch(console.error).finally(done);
    else {
      loadDrafts();
      done();
    }
  }, [tab, loadDrafts]);

  const createFromSale = async (saleId: number, force = false) => {
    try {
      const r = await ipc.invoiceDrafts.createFromSale({ sale_id: saleId, document_type: docType, force });
      setToast(`Fatura taslağı oluşturuldu (#${r.draftId})`);
      if (r.warning) setError(r.warning);
      switchTab('drafts');
    } catch (e) {
      const msg = (e as Error).message;
      if (!force && msg.includes('zaten fatura taslağı')) {
        if (confirm(`${msg}\n\nYine de oluşturmak istiyor musunuz?`)) await createFromSale(saleId, true);
      } else setError(msg);
    }
  };

  const createFromPurchase = async (id: number, type: string) => {
    try {
      const r = await ipc.invoiceDrafts.createFromPurchase({ purchase_document_id: id, document_type: type });
      setToast(`Alış taslağı oluşturuldu (#${r.draftId})`);
      switchTab('drafts');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createFromSgk = async (batchId: number) => {
    try {
      const r = await ipc.invoiceDrafts.createFromSgkBatch({ sgk_invoice_batch_id: batchId, document_type: 'E-Fatura' });
      setToast(`SGK fatura taslağı oluşturuldu (#${r.draftId})`);
      switchTab('drafts');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createWaybill = async (batchId: number) => {
    try {
      const r = await ipc.invoiceDrafts.createFromStockEntry({ stock_entry_batch_id: batchId });
      setToast(`İrsaliye taslağı oluşturuldu (#${r.draftId})`);
      switchTab('drafts');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveSettings = async () => {
    try {
      await ipc.einvoiceSettings.update(settings);
      setToast('Entegratör ayarları kaydedildi.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const printDraft = async (id: number) => {
    const { html } = await ipc.invoiceDrafts.printHtml(id);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  const selectedDraft = drafts.find((d) => Number(d.id) === selectedId);

  return (
    <div className="page-content">
      <PageTitleBar title="E-Dönüşüm" />
      {toast && <div className="toast-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>{DISCLAIMER}</p>

      <div className="product-form-tabs" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          ['sale', 'Satış Fatura Hazırlığı'],
          ['purchase', 'Alış Fatura / İrsaliye'],
          ['sgk', 'SGK Fatura Bağlantısı'],
          ['drafts', 'E-Arşiv / E-Fatura Taslakları'],
          ['waybill', 'E-İrsaliye Taslakları'],
          ['history', 'E-Dönüşüm Geçmişi'],
          ['settings', 'Entegratör Ayarları'],
        ].map(([k, label]) => (
          <button key={k} type="button" className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => switchTab(k as Tab)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sale' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">Satışlar</div>
            <div className="filter-bar">
              <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <table className="data-table">
              <thead><tr><th>Tarih</th><th>Satış No</th><th>Müşteri</th><th>Tutar</th><th></th></tr></thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{String(s.sale_date).slice(0, 10)}</td>
                    <td>{String(s.sale_no)}</td>
                    <td>{String(s.customer_name || '-')}</td>
                    <td className="text-right">{formatCurrency(Number(s.net_amount))}</td>
                    <td>{canEdit && <button className="btn btn-sm" onClick={() => createFromSale(Number(s.id))}>Taslak Oluştur</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'purchase' && (
        <div className="panel">
          <div className="panel-header">Alış Belgeleri</div>
          <table className="data-table">
            <thead><tr><th>Tarih</th><th>Belge No</th><th>Tedarikçi</th><th>Tür</th><th>Tutar</th><th>İşlem</th></tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={String(p.id)}>
                  <td>{String(p.document_date)}</td>
                  <td>{String(p.document_no)}</td>
                  <td>{String(p.supplier_name)}</td>
                  <td>{String(p.document_type)}</td>
                  <td className="text-right">{formatCurrency(Number(p.total_amount))}</td>
                  <td>
                    {canEdit && (
                      <>
                        <button className="btn btn-sm" onClick={() => createFromPurchase(Number(p.id), 'Alış Faturası')}>Fatura Taslağı</button>
                        <button className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => createFromPurchase(Number(p.id), 'Alış İrsaliyesi')}>İrsaliye Taslağı</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sgk' && (
        <div className="panel">
          <div className="panel-header">SGK Fatura Batch Kayıtları</div>
          <table className="data-table">
            <thead><tr><th>Batch</th><th>Dönem</th><th>Reçete</th><th>Kurum Tutarı</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {sgkBatches.map((b) => (
                <tr key={String(b.id)}>
                  <td>{String(b.batch_no)}</td>
                  <td>{String(b.date_from)} — {String(b.date_to)}</td>
                  <td>{String(b.total_prescriptions)}</td>
                  <td className="text-right">{formatCurrency(Number(b.total_institution_amount))}</td>
                  <td>{String(b.status)}</td>
                  <td>{canEdit && <button className="btn btn-sm" onClick={() => createFromSgk(Number(b.id))}>Fatura Taslağı Oluştur</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'waybill' && (
        <div className="panel">
          <div className="panel-header">Mal Kabul — İrsaliye Taslağı</div>
          <table className="data-table">
            <thead><tr><th>Tarih</th><th>Batch</th><th>Belge No</th><th>Tedarikçi</th><th></th></tr></thead>
            <tbody>
              {stockEntries.map((b) => (
                <tr key={String(b.id)}>
                  <td>{String(b.entry_date)}</td>
                  <td>{String(b.batch_no)}</td>
                  <td>{String(b.document_no || '-')}</td>
                  <td>{String(b.supplier_name || '-')}</td>
                  <td>{canEdit && <button className="btn btn-sm" onClick={() => createWaybill(Number(b.id))}>İrsaliye Taslağı</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'drafts' || tab === 'history') && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header">{tab === 'history' ? 'E-Dönüşüm Geçmişi' : 'Fatura Taslakları'}</div>
            {loading ? <div className="loading-text">Yükleniyor...</div> : (
              <table className="data-table">
                <thead>
                  <tr><th>No</th><th>Tarih</th><th>Tür</th><th>Kaynak</th><th>Cari</th><th>Tutar</th><th>Durum</th></tr>
                </thead>
                <tbody>
                  {drafts.length === 0 ? <tr><td colSpan={7} className="empty-text">Kayıt yok</td></tr> : drafts.map((d) => (
                    <tr key={String(d.id)} className={selectedId === Number(d.id) ? 'selected' : ''} onClick={() => setSelectedId(Number(d.id))}>
                      <td>{String(d.draft_no)}</td>
                      <td>{String(d.issue_date)}</td>
                      <td>{String(d.document_type)}</td>
                      <td>{String(d.source_type)}</td>
                      <td>{String(d.customer_name || d.supplier_name || '-')}</td>
                      <td className="text-right">{formatCurrency(Number(d.total_amount))}</td>
                      <td>{String(d.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="panel" style={{ width: 260 }}>
            <div className="panel-header">İşlemler</div>
            <div className="panel-body" style={{ fontSize: 12 }}>
              {!selectedDraft ? <p className="empty-text">Taslak seçin</p> : (
                <>
                  {selectedDraft.status_note && <p className="amount-negative" style={{ fontSize: 11 }}>{String(selectedDraft.status_note)}</p>}
                  {canExport && (
                    <>
                      <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => ipc.invoiceDrafts.exportExcel(selectedId!).then((r) => r.exported && setToast(`Excel: ${r.filePath}`))}>Excel&apos;e Aktar</button>
                      <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => ipc.invoiceDrafts.exportXml(selectedId!).then((r) => r.exported && setToast(`XML: ${r.filePath}`))}>XML Dışa Aktar</button>
                    </>
                  )}
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => printDraft(selectedId!)}>HTML Yazdır</button>
                  {canOfficial && (
                    <>
                      <input className="form-input" placeholder="Resmi belge no" value={officialNo} onChange={(e) => setOfficialNo(e.target.value)} style={{ marginBottom: 4 }} />
                      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 4 }} onClick={() => ipc.invoiceDrafts.markOfficial({ draft_id: selectedId!, official_invoice_no: officialNo, status: 'Gönderildi İşaretlendi' }).then(() => { setToast('Gönderildi işaretlendi'); loadDrafts(); })}>Gönderildi İşaretle</button>
                    </>
                  )}
                  {canEdit && <button className="btn" style={{ width: '100%' }} onClick={() => ipc.invoiceDrafts.cancel(selectedId!).then(() => { setToast('İptal edildi'); loadDrafts(); })}>İptal Et</button>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-header">Entegratör Ayarları</div>
          <div className="panel-body">
            <div className="form-group"><label>Entegratör</label>
              <select className="form-select" value={String(settings.provider_name || '')} onChange={(e) => setSettings((s) => ({ ...s, provider_name: e.target.value }))}>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Kullanım Şekli</label>
              <select className="form-select" value={String(settings.usage_mode || '')} onChange={(e) => setSettings((s) => ({ ...s, usage_mode: e.target.value }))}>
                {USAGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Firma Unvanı</label><input className="form-input" value={String(settings.company_title || '')} onChange={(e) => setSettings((s) => ({ ...s, company_title: e.target.value }))} /></div>
            <div className="form-group"><label>VKN / TCKN</label><input className="form-input" value={String(settings.tax_no || '')} onChange={(e) => setSettings((s) => ({ ...s, tax_no: e.target.value }))} /></div>
            <div className="form-group"><label>Vergi Dairesi</label><input className="form-input" value={String(settings.tax_office || '')} onChange={(e) => setSettings((s) => ({ ...s, tax_office: e.target.value }))} /></div>
            <div className="form-group"><label>Varsayılan Senaryo</label>
              <select className="form-select" value={String(settings.default_scenario || '')} onChange={(e) => setSettings((s) => ({ ...s, default_scenario: e.target.value }))}>
                {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Varsayılan KDV (%)</label><input type="number" className="form-input" value={Number(settings.default_vat_rate) || 18} onChange={(e) => setSettings((s) => ({ ...s, default_vat_rate: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>Varsayılan Not</label><input className="form-input" value={String(settings.default_note || '')} onChange={(e) => setSettings((s) => ({ ...s, default_note: e.target.value }))} /></div>
            <label style={{ fontSize: 11, color: '#888' }}><input type="checkbox" checked={!!settings.is_einvoice_taxpayer} onChange={(e) => setSettings((s) => ({ ...s, is_einvoice_taxpayer: e.target.checked }))} /> E-fatura mükellefi</label>
            <p style={{ fontSize: 11, color: '#888', marginTop: 12 }}>API alanları ileride kullanılacak; bu sürümde aktif entegrasyon yoktur.</p>
            {canEdit && <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={saveSettings}>Kaydet</button>}
          </div>
        </div>
      )}
    </div>
  );
}
