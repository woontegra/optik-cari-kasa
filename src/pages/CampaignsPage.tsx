import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  DISCOUNT_TYPES,
  type CampaignInput,
  type CampaignTargetInput,
} from '@/types/campaign';

type Tab = 'active' | 'all' | 'sales' | 'report';

const today = new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const emptyForm: CampaignInput = {
  name: '',
  code: '',
  description: '',
  campaign_type: CAMPAIGN_TYPES[3],
  discount_type: DISCOUNT_TYPES[0],
  discount_value: 10,
  start_date: today,
  end_date: today,
  priority: 100,
  status: 'Taslak',
  targets: [],
};

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.CAMPAIGN_EDIT);
  const [tab, setTab] = useState<Tab>('active');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [sales, setSales] = useState<Record<string, unknown>[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<CampaignInput>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [groups, setGroups] = useState<Record<string, unknown>[]>([]);
  const [subgroups, setSubgroups] = useState<Record<string, unknown>[]>([]);
  const [brands, setBrands] = useState<Record<string, unknown>[]>([]);
  const [models, setModels] = useState<Record<string, unknown>[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Record<string, unknown>[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<CampaignTargetInput[]>([]);
  const [reportFrom, setReportFrom] = useState(monthAgo());
  const [reportTo, setReportTo] = useState(today);

  const loadMeta = useCallback(async () => {
    const [g, b] = await Promise.all([
      ipc.opticalLookups.listByType('PRODUCT_GROUP'),
      ipc.opticalLookups.listByType('BRAND'),
    ]);
    setGroups(g);
    setBrands(b);
  }, []);

  const load = useCallback(async () => {
    try {
      if (tab === 'active') setRows(await ipc.campaigns.list({ activeOnly: true }));
      else if (tab === 'all') setRows(await ipc.campaigns.list());
      else if (tab === 'sales') setSales(await ipc.campaigns.listSales({ date_from: reportFrom, date_to: reportTo }));
      else setReport(await ipc.campaigns.getReport({ date_from: reportFrom, date_to: reportTo }));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [tab, reportFrom, reportTo]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(); }, [load]);

  const addTarget = (t: CampaignTargetInput) => {
    setSelectedTargets((prev) => {
      if (prev.some((x) => x.target_type === t.target_type && x.target_id === t.target_id)) return prev;
      return [...prev, t];
    });
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (!q.trim()) { setProductResults([]); return; }
    const list = await ipc.products.list({ search: q, active_only: true });
    setProductResults(list as unknown as Record<string, unknown>[]);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Kampanya adı zorunludur.'); return; }
    const payload = { ...form, targets: selectedTargets };
    setError('');
    try {
      if (editId) {
        await ipc.campaigns.update(editId, payload);
        setToast('Kampanya güncellendi.');
      } else {
        await ipc.campaigns.create(payload);
        setToast('Kampanya oluşturuldu.');
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setSelectedTargets([]);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openEdit = async (id: number) => {
    const c = await ipc.campaigns.getById(id);
    if (!c) return;
    setForm({
      name: String(c.name),
      code: String(c.code || ''),
      description: String(c.description || ''),
      campaign_type: String(c.campaign_type),
      discount_type: String(c.discount_type),
      discount_value: Number(c.discount_value),
      max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
      min_sale_amount: c.min_sale_amount ? Number(c.min_sale_amount) : null,
      min_quantity: c.min_quantity ? Number(c.min_quantity) : null,
      start_date: String(c.start_date),
      end_date: String(c.end_date),
      priority: Number(c.priority || 100),
      usage_limit: c.usage_limit ? Number(c.usage_limit) : null,
      per_customer_limit: c.per_customer_limit ? Number(c.per_customer_limit) : null,
      status: String(c.status),
      targets: [],
    });
    setSelectedTargets((c.targets as CampaignTargetInput[]) || []);
    setEditId(id);
    setShowForm(true);
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Kampanyalar</h2>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setSelectedTargets([]); }}>
            Yeni Kampanya
          </button>
        )}
      </div>
      {toast && <div className="toast success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        {([
          ['active', 'Aktif Kampanyalar'],
          ['all', 'Tüm Kampanyalar'],
          ['sales', 'Kampanya Satışları'],
          ['report', 'Kampanya Raporu'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {(tab === 'report' || tab === 'sales') && (
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <input type="date" className="form-input" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
          <input type="date" className="form-input" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
          <button type="button" className="btn" onClick={load}>Filtrele</button>
        </div>
      )}

      {showForm && canEdit && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <div className="panel-header">{editId ? 'Kampanya Düzenle' : 'Yeni Kampanya'}</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group"><label>Ad *</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-group"><label>Kod</label><input className="form-input" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div className="form-group">
                <label>Tür</label>
                <select className="form-select" value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}>
                  {CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>İndirim tipi</label>
                <select className="form-select" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                  {DISCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>İndirim değeri</label><input type="number" className="form-input" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-group"><label>Başlangıç</label><input type="date" className="form-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="form-group"><label>Bitiş</label><input type="date" className="form-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div className="form-group"><label>Öncelik</label><input type="number" className="form-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 100 })} /></div>
              <div className="form-group"><label>Min. sepet</label><input type="number" className="form-input" value={form.min_sale_amount ?? ''} onChange={(e) => setForm({ ...form, min_sale_amount: parseFloat(e.target.value) || null })} /></div>
              <div className="form-group">
                <label>Durum</label>
                <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {!['Sepet toplamı bazlı', 'Manuel indirim kuponu'].includes(form.campaign_type) && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                <strong>Kapsam seçimi</strong>
                <div className="form-row" style={{ marginTop: 6 }}>
                  {form.campaign_type === 'Ana grup bazlı' && (
                    <div className="form-group">
                      <label>Ana grup</label>
                      <select className="form-select" onChange={async (e) => {
                        const id = Number(e.target.value);
                        if (id) {
                          addTarget({ target_type: 'PRODUCT_GROUP', target_id: id });
                          setSubgroups(await ipc.opticalLookups.listChildren(id));
                        }
                      }}>
                        <option value="">Seçin</option>
                        {groups.map((g) => <option key={String(g.id)} value={String(g.id)}>{String(g.name)}</option>)}
                      </select>
                    </div>
                  )}
                  {form.campaign_type === 'Alt grup bazlı' && (
                    <div className="form-group">
                      <label>Alt grup</label>
                      <select className="form-select" onChange={(e) => { const id = Number(e.target.value); if (id) addTarget({ target_type: 'PRODUCT_SUBGROUP', target_id: id }); }}>
                        <option value="">Seçin</option>
                        {subgroups.map((g) => <option key={String(g.id)} value={String(g.id)}>{String(g.name)}</option>)}
                      </select>
                    </div>
                  )}
                  {form.campaign_type === 'Marka bazlı' && (
                    <div className="form-group">
                      <label>Marka</label>
                      <select className="form-select" onChange={async (e) => {
                        const id = Number(e.target.value);
                        if (id) {
                          addTarget({ target_type: 'BRAND', target_id: id });
                          setModels(await ipc.opticalLookups.listChildren(id));
                        }
                      }}>
                        <option value="">Seçin</option>
                        {brands.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>)}
                      </select>
                    </div>
                  )}
                  {form.campaign_type === 'Model bazlı' && (
                    <div className="form-group">
                      <label>Model</label>
                      <select className="form-select" onChange={(e) => { const id = Number(e.target.value); if (id) addTarget({ target_type: 'MODEL', target_id: id }); }}>
                        <option value="">Seçin</option>
                        {models.map((m) => <option key={String(m.id)} value={String(m.id)}>{String(m.name)}</option>)}
                      </select>
                    </div>
                  )}
                  {form.campaign_type === 'Ürün bazlı' && (
                    <div className="form-group">
                      <label>Ürün ara</label>
                      <input className="form-input" value={productSearch} onChange={(e) => searchProducts(e.target.value)} />
                      {productResults.map((p) => (
                        <div key={String(p.id)} className="customer-dropdown-item" onClick={() => addTarget({ target_type: 'PRODUCT', target_id: Number(p.id) })}>
                          {String(p.name)} — {String(p.barcode)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTargets.length > 0 && (
                  <table className="data-table" style={{ marginTop: 8 }}>
                    <thead><tr><th>Tür</th><th>ID</th><th></th></tr></thead>
                    <tbody>
                      {selectedTargets.map((t, i) => (
                        <tr key={i}>
                          <td>{t.target_type}</td>
                          <td>{t.target_id}</td>
                          <td><button type="button" className="btn btn-sm btn-remove" onClick={() => setSelectedTargets((prev) => prev.filter((_, j) => j !== i))}>Sil</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-primary" onClick={save}>Kaydet</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}

      {(tab === 'active' || tab === 'all') && (
        <div className="panel">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad</th><th>Tür</th><th>Başlangıç</th><th>Bitiş</th><th>İndirim</th><th>Durum</th><th>Kullanım</th><th>Toplam indirim</th>{canEdit && <th>İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={canEdit ? 9 : 8} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{String(r.name)}</td>
                    <td>{String(r.campaign_type)}</td>
                    <td>{String(r.start_date)}</td>
                    <td>{String(r.end_date)}</td>
                    <td>{String(r.discount_type)} %{Number(r.discount_value)}</td>
                    <td>{String(r.status)}</td>
                    <td>{String(r.usage_count || 0)}</td>
                    <td className="text-right">{formatCurrency(Number(r.total_discount || 0))}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(Number(r.id))}>Düzenle</button>
                        {String(r.status) !== 'Aktif' ? (
                          <button type="button" className="btn btn-sm" style={{ marginLeft: 4 }} onClick={async () => { await ipc.campaigns.activate(Number(r.id)); load(); }}>Aktif Et</button>
                        ) : (
                          <button type="button" className="btn btn-sm" style={{ marginLeft: 4 }} onClick={async () => { await ipc.campaigns.deactivate(Number(r.id)); load(); }}>Pasif</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="panel">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Satış No</th><th>Tarih</th><th>Müşteri</th><th className="text-right">Tutar</th><th className="text-right">İndirim</th><th>Kampanyalar</th></tr></thead>
              <tbody>
                {sales.length === 0 ? <tr><td colSpan={6} className="empty-text">Kayıt yok</td></tr> : sales.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{String(s.sale_no)}</td>
                    <td>{String(s.sale_date)}</td>
                    <td>{String(s.customer_name || 'Perakende')}</td>
                    <td className="text-right">{formatCurrency(Number(s.net_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(s.campaign_discount_amount))}</td>
                    <td>{String(s.campaigns || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'report' && report && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 8 }}>
            <div className="stat-box"><div className="stat-label">Kampanyalı Satış</div><div className="stat-value">{Number((report.summary as Record<string, unknown>)?.campaignSaleCount || 0)}</div></div>
            <div className="stat-box"><div className="stat-label">Toplam Satış</div><div className="stat-value">{formatCurrency(Number((report.summary as Record<string, unknown>)?.totalSales || 0))}</div></div>
            <div className="stat-box"><div className="stat-label">Toplam İndirim</div><div className="stat-value amount-negative">{formatCurrency(Number((report.summary as Record<string, unknown>)?.totalDiscount || 0))}</div></div>
            <div className="stat-box"><div className="stat-label">En Çok Kullanılan</div><div className="stat-value">{String((report.summary as Record<string, unknown>)?.topCampaign || '-')}</div></div>
          </div>
          <div className="panel">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Kampanya</th><th>Kullanım</th><th className="text-right">Satış</th><th className="text-right">İndirim</th><th className="text-right">Ort. Sepet</th></tr></thead>
                <tbody>
                  {((report.rows as Record<string, unknown>[]) || []).map((r, i) => (
                    <tr key={i}>
                      <td>{String(r.campaign_name)}</td>
                      <td>{String(r.usage_count)}</td>
                      <td className="text-right">{formatCurrency(Number(r.sales_total))}</td>
                      <td className="text-right">{formatCurrency(Number(r.discount_total))}</td>
                      <td className="text-right">{formatCurrency(Number(r.avg_basket))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
