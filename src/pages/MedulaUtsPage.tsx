import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ipc } from '@/services/ipc';
import { formatDateTime } from '@/utils/format';
import type { MedulaListFilters, MedulaRecordListItem, UtsListFilters, UtsRecord } from '@/types/medula';
import { MEDULA_STATUSES, PRESCRIPTION_TYPES, UTS_STATUSES } from '@/types/medula';
import TitubbNotificationTab from '@/components/medula/TitubbNotificationTab';
import '@/components/products/ProductForm.css';

type PageTab = 'medula' | 'uts' | 'titubb';

const MEDULA_DISCLAIMER =
  'Bu dosya Medula işlemleri için veri hazırlama amacıyla oluşturulur. Kullanılacak kesin format, optik işletmenizin Medula işlem yöntemi ve güncel SGK ekranlarına göre kontrol edilmelidir.';

export default function MedulaUtsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [pageTab, setPageTab] = useState<PageTab>(
    initialTab === 'titubb' || initialTab === 'uts' ? initialTab : 'medula'
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [medulaRecords, setMedulaRecords] = useState<MedulaRecordListItem[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [mDateFrom, setMDateFrom] = useState('');
  const [mDateTo, setMDateTo] = useState('');
  const [mCustomer, setMCustomer] = useState('');
  const [mRxNo, setMRxNo] = useState('');
  const [mStatus, setMStatus] = useState('');
  const [mType, setMType] = useState('');
  const [mMissing, setMMissing] = useState('');

  const [utsRecords, setUtsRecords] = useState<UtsRecord[]>([]);
  const [uSearch, setUSearch] = useState('');
  const [uStatus, setUStatus] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [newUtsStatus, setNewUtsStatus] = useState<UtsRecord['uts_status']>('Bekliyor');
  const [utsNote, setUtsNote] = useState('');

  const loadMedula = useCallback(() => {
    setLoading(true);
    const filters: MedulaListFilters = {
      date_from: mDateFrom || undefined,
      date_to: mDateTo || undefined,
      customer_search: mCustomer || undefined,
      prescription_no: mRxNo || undefined,
      medula_status: mStatus || undefined,
      prescription_type: mType || undefined,
      has_missing_fields: mMissing === 'yes' ? true : mMissing === 'no' ? false : undefined,
    };
    ipc.medula.listReadyRecords(filters).then(setMedulaRecords).catch(console.error).finally(() => setLoading(false));
  }, [mDateFrom, mDateTo, mCustomer, mRxNo, mStatus, mType, mMissing]);

  const loadUts = useCallback(() => {
    setLoading(true);
    const filters: UtsListFilters = {
      search: uSearch || undefined,
      uts_status: uStatus || undefined,
    };
    ipc.uts.listRecords(filters).then(setUtsRecords).catch(console.error).finally(() => setLoading(false));
  }, [uSearch, uStatus]);

  useEffect(() => {
    if (pageTab === 'medula') loadMedula();
    else loadUts();
  }, [pageTab, loadMedula, loadUts]);

  const openDetail = async (saleId: number) => {
    setSelectedSaleId(saleId);
    const d = await ipc.medula.getRecordDetail(saleId);
    setDetail(d);
  };

  const exportMedula = async (format: 'excel' | 'csv' | 'txt', force = false) => {
    if (!selectedSaleId) {
      setError('Önce bir kayıt seçin.');
      return;
    }
    setError('');
    try {
      const fn = format === 'excel' ? ipc.medula.exportExcel : format === 'csv' ? ipc.medula.exportCsv : ipc.medula.exportTxt;
      const result = await fn([selectedSaleId], force);
      if (result.exported) {
        setToast(`Dışa aktarıldı: ${result.filePath}`);
        loadMedula();
        openDetail(selectedSaleId);
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (!force && msg.includes('Eksik alan')) {
        if (confirm(`${msg}\n\nYine de dışa aktarmak istiyor musunuz?`)) {
          await exportMedula(format, true);
        }
      } else {
        setError(msg);
      }
    }
  };

  const markUploaded = async () => {
    if (!selectedSaleId) return;
    await ipc.medula.markUploaded([selectedSaleId]);
    setToast('Manuel yüklendi olarak işaretlendi.');
    loadMedula();
    openDetail(selectedSaleId);
  };

  const markExported = async () => {
    if (!selectedSaleId) return;
    await ipc.medula.markExported([selectedSaleId]);
    setToast('Dışa aktarıldı olarak işaretlendi.');
    loadMedula();
    openDetail(selectedSaleId);
  };

  const updateUtsStatus = async () => {
    if (!selectedProductId) return;
    await ipc.uts.updateStatus(selectedProductId, newUtsStatus as import('@/types/medula').UtsStatus, utsNote);
    setToast('ÜTS durumu güncellendi.');
    loadUts();
  };

  const validation = detail?.validation as { errors?: string[]; warnings?: string[]; isValid?: boolean } | undefined;

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Medula / ÜTS</h2>
        <button className="btn" onClick={() => (pageTab === 'medula' ? loadMedula() : loadUts())}>Yenile</button>
      </div>

      {toast && <div className="toast-success">{toast}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="product-form-tabs" style={{ marginBottom: 8 }}>
        <button type="button" className={`tab-btn${pageTab === 'medula' ? ' active' : ''}`} onClick={() => setPageTab('medula')}>
          Medula Dışa Aktarım
        </button>
        <button type="button" className={`tab-btn${pageTab === 'uts' ? ' active' : ''}`} onClick={() => setPageTab('uts')}>
          ÜTS / UBB Takip
        </button>
        <button type="button" className={`tab-btn${pageTab === 'titubb' ? ' active' : ''}`} onClick={() => setPageTab('titubb')}>
          TİTUBB Bildirimi
        </button>
      </div>

      {pageTab === 'medula' && (
        <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header">Reçeteli Satışlar</div>
            <p style={{ fontSize: 11, padding: '6px 8px', margin: 0, color: '#666', borderBottom: '1px solid var(--border)' }}>
              {MEDULA_DISCLAIMER}
            </p>
            <div className="filter-bar">
              <input type="date" className="form-input" value={mDateFrom} onChange={(e) => setMDateFrom(e.target.value)} />
              <input type="date" className="form-input" value={mDateTo} onChange={(e) => setMDateTo(e.target.value)} />
              <input className="form-input" placeholder="Müşteri / T.C." value={mCustomer} onChange={(e) => setMCustomer(e.target.value)} />
              <input className="form-input" placeholder="Reçete no" value={mRxNo} onChange={(e) => setMRxNo(e.target.value)} />
              <select className="form-select" value={mStatus} onChange={(e) => setMStatus(e.target.value)}>
                <option value="">Medula Durumu</option>
                {MEDULA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-select" value={mType} onChange={(e) => setMType(e.target.value)}>
                <option value="">Reçete Tipi</option>
                {PRESCRIPTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-select" value={mMissing} onChange={(e) => setMMissing(e.target.value)}>
                <option value="">Eksik Alan</option>
                <option value="yes">Eksik var</option>
                <option value="no">Eksik yok</option>
              </select>
            </div>
            <div className="data-table-wrap">
              {loading ? <div className="loading-text">Yükleniyor...</div> : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarih</th><th>Müşteri</th><th>T.C.</th><th>Reçete</th><th>Satış</th>
                      <th>Sağ</th><th>Sol</th><th>Ürün</th><th>Eksik</th><th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medulaRecords.length === 0 ? (
                      <tr><td colSpan={10} className="empty-text">Kayıt yok</td></tr>
                    ) : medulaRecords.map((r) => (
                      <tr
                        key={r.sale_id}
                        className={selectedSaleId === r.sale_id ? 'selected' : ''}
                        onClick={() => openDetail(r.sale_id)}
                      >
                        <td>{formatDateTime(r.sale_date)}</td>
                        <td>{r.customer_name || '-'}</td>
                        <td>{r.customer_tc || '-'}</td>
                        <td>{r.prescription_no || r.e_prescription_no || '-'}</td>
                        <td>{r.sale_no}</td>
                        <td>{r.right_eye}</td>
                        <td>{r.left_eye}</td>
                        <td className="text-center">{r.item_count}</td>
                        <td className={r.missing_count > 0 ? 'amount-negative' : ''}>{r.missing_count}</td>
                        <td>{r.medula_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel" style={{ width: 280, display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">İşlemler</div>
            <div className="panel-body" style={{ fontSize: 12 }}>
              {!selectedSaleId ? (
                <p className="empty-text">Listeden kayıt seçin</p>
              ) : (
                <>
                  {validation && (
                    <div style={{ marginBottom: 8 }}>
                      {validation.errors && validation.errors.length > 0 && (
                        <div className="amount-negative" style={{ marginBottom: 4 }}>
                          <strong>Eksikler:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 16 }}>{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                        </div>
                      )}
                      {validation.warnings && validation.warnings.length > 0 && (
                        <div style={{ color: '#b8860b' }}>
                          <strong>Uyarılar:</strong>
                          <ul style={{ margin: '4px 0', paddingLeft: 16 }}>{validation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                  <button className="btn btn-primary" style={{ width: '100%', marginBottom: 4 }} onClick={() => exportMedula('excel')}>Excel Dışa Aktar</button>
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => exportMedula('csv')}>CSV Dışa Aktar</button>
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={() => exportMedula('txt')}>TXT Dışa Aktar</button>
                  <button className="btn" style={{ width: '100%', marginBottom: 4 }} onClick={markExported}>Dışa Aktarıldı İşaretle</button>
                  <button className="btn" style={{ width: '100%' }} onClick={markUploaded}>Manuel Yüklendi İşaretle</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pageTab === 'titubb' && <TitubbNotificationTab />}

      {pageTab === 'uts' && (
        <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'hidden' }}>
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header">ÜTS / UBB Ürünleri</div>
            <div className="filter-bar">
              <input className="form-input search-input" placeholder="Ürün / barkod / UBB" value={uSearch} onChange={(e) => setUSearch(e.target.value)} />
              <select className="form-select" value={uStatus} onChange={(e) => setUStatus(e.target.value)}>
                <option value="">ÜTS Durum</option>
                {UTS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn" onClick={() => ipc.uts.exportExcel({ search: uSearch || undefined, uts_status: uStatus || undefined }).then((r) => r.exported && setToast(`Dosya: ${r.filePath}`))}>
                Excel&apos;e Aktar
              </button>
            </div>
            <div className="data-table-wrap">
              {loading ? <div className="loading-text">Yükleniyor...</div> : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ürün</th><th>Tip</th><th>Barkod</th><th>UBB</th><th>ÜTS No</th>
                      <th>Seri</th><th>Lot</th><th>SKT</th><th className="text-center">Stok</th><th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utsRecords.length === 0 ? (
                      <tr><td colSpan={10} className="empty-text">Kayıt yok</td></tr>
                    ) : utsRecords.map((r) => (
                      <tr
                        key={r.product_id}
                        className={selectedProductId === r.product_id ? 'selected' : ''}
                        onClick={() => { setSelectedProductId(r.product_id); setNewUtsStatus(r.uts_status as UtsRecord['uts_status']); setUtsNote(r.uts_note || ''); }}
                      >
                        <td>{r.product_name}</td>
                        <td>{r.product_type}</td>
                        <td>{r.barcode || '-'}</td>
                        <td>{r.ubb_code || '-'}</td>
                        <td>{r.uts_product_no || '-'}</td>
                        <td>{r.serial_no || '-'}</td>
                        <td>{r.lot_no || '-'}</td>
                        <td>{r.uts_expiry_date || '-'}</td>
                        <td className="text-center">{r.stock_quantity}</td>
                        <td>{r.uts_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel" style={{ width: 260 }}>
            <div className="panel-header">ÜTS Durum Güncelle</div>
            <div className="panel-body" style={{ fontSize: 12 }}>
              {!selectedProductId ? <p className="empty-text">Ürün seçin</p> : (
                <>
                  <div className="form-group">
                    <label>Durum</label>
                    <select className="form-select" value={newUtsStatus} onChange={(e) => setNewUtsStatus(e.target.value as UtsRecord['uts_status'])}>
                      {UTS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Not</label>
                    <input className="form-input" value={utsNote} onChange={(e) => setUtsNote(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={updateUtsStatus}>Kaydet</button>
                  <button className="btn" style={{ marginLeft: 4 }} onClick={() => navigate('/stok')}>Ürün Detayına Git</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
