import { useCallback, useEffect, useMemo, useState } from 'react';
import { ipc } from '@/services/ipc';
import { OPTICAL_LOOKUP_TYPES } from '@/types/opticalLookup';

type Tab = 'groups' | 'subgroups' | 'brands' | 'models' | 'colors' | 'lens' | 'frame';

const TAB_TYPE: Record<Tab, OpticalLookupType | OpticalLookupType[]> = {
  groups: 'PRODUCT_GROUP',
  subgroups: 'PRODUCT_SUBGROUP',
  brands: 'BRAND',
  models: 'MODEL',
  colors: 'COLOR',
  lens: ['LENS_TYPE', 'LENS_MATERIAL', 'LENS_COATING', 'CONTACT_LENS_TYPE'],
  frame: ['FRAME_TYPE', 'FRAME_MATERIAL'],
};

export default function OptikTanimlarPage() {
  const [tab, setTab] = useState<Tab>('groups');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [groups, setGroups] = useState<Record<string, unknown>[]>([]);
  const [brands, setBrands] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [parentId, setParentId] = useState<number | ''>('');
  const [formName, setFormName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const activeTypes = useMemo(() => {
    const t = TAB_TYPE[tab];
    return Array.isArray(t) ? t : [t];
  }, [tab]);

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
      if (activeTypes.length === 1) {
        const data = await ipc.opticalLookups.list({
          type: activeTypes[0],
          parent_id: parentId === '' ? undefined : parentId,
          search: search || undefined,
          active_only: false,
        });
        setRows(data);
      } else {
        const batches = await Promise.all(
          activeTypes.map((type) =>
            ipc.opticalLookups.list({ type, search: search || undefined, active_only: false })
          )
        );
        setRows(batches.flat());
      }
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, [activeTypes, parentId, search]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setParentId(''); setEditId(null); setFormName(''); }, [tab]);

  const save = async () => {
    if (!formName.trim()) {
      setError('Ad zorunludur.');
      return;
    }
    setError('');
    try {
      const type = activeTypes[0];
      if (editId) {
        await ipc.opticalLookups.update(editId, {
          name: formName,
          parent_id: parentId === '' ? null : parentId,
        });
        setToast('Güncellendi.');
      } else {
        await ipc.opticalLookups.create({
          type,
          name: formName,
          parent_id: parentId === '' ? null : parentId,
        });
        setToast('Eklendi.');
      }
      setFormName('');
      setEditId(null);
      load();
      loadMeta();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deactivate = async (id: number) => {
    if (!window.confirm('Pasife alınsın mı?')) return;
    await ipc.opticalLookups.deactivate(id);
    setToast('Pasife alındı.');
    load();
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Optik Tanımlar</h2>
      </div>
      {toast && <div className="toast-success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        {([
          ['groups', 'Ana Gruplar'],
          ['subgroups', 'Alt Gruplar'],
          ['brands', 'Markalar'],
          ['models', 'Modeller'],
          ['colors', 'Renkler'],
          ['lens', 'Cam / Lens'],
          ['frame', 'Çerçeve'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <input className="form-input search-input" placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {tab === 'subgroups' && (
          <select className="form-select" value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Ana grup</option>
            {groups.map((g) => <option key={String(g.id)} value={String(g.id)}>{String(g.name)}</option>)}
          </select>
        )}
        {tab === 'models' && (
          <select className="form-select" value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Marka</option>
            {brands.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>)}
          </select>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 8 }}>
        <div className="panel-header">{editId ? 'Düzenle' : 'Yeni Ekle'}</div>
        <div className="panel-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label>Ad</label>
            <input className="form-input" value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          {activeTypes.length === 1 && (
            <div className="form-group">
              <label>Tür</label>
              <input className="form-input" value={activeTypes[0]} readOnly />
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={save}>{editId ? 'Güncelle' : 'Ekle'}</button>
          {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setFormName(''); }}>Vazgeç</button>}
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Ad</th><th>Kod</th><th>Tür</th><th>Üst</th><th>Sıra</th><th>Durum</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="empty-text">Kayıt yok</td></tr>
            ) : rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.name)}</td>
                <td>{String(r.code || '-')}</td>
                <td>{String(r.type)}</td>
                <td>{String(r.parent_name || '-')}</td>
                <td>{String(r.sort_order)}</td>
                <td>{Number(r.is_active) ? 'Aktif' : 'Pasif'}</td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => { setEditId(Number(r.id)); setFormName(String(r.name)); setParentId(r.parent_id ? Number(r.parent_id) : ''); }}>Düzenle</button>
                  {Number(r.is_active) === 1 && (
                    <button type="button" className="btn btn-sm" style={{ marginLeft: 4 }} onClick={() => deactivate(Number(r.id))}>Pasife Al</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
