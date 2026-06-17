import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import type { BankAccountInput, PosAccountInput } from '@/types/finance';
import { BANK_MOVEMENT_TYPES } from '@/types/finance';

type Tab = 'banks' | 'pos' | 'bankMovements' | 'posMovements';

const emptyBank: BankAccountInput = {
  account_name: '',
  bank_name: '',
  iban: '',
  branch_name: '',
  account_no: '',
  opening_balance: 0,
  is_active: true,
  notes: '',
};

const emptyPos: PosAccountInput = {
  name: '',
  bank_account_id: null,
  commission_rate: 0,
  block_days: 0,
  is_active: true,
  notes: '',
};

export default function BankPosPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.FINANCE_EDIT);
  const [tab, setTab] = useState<Tab>('banks');
  const [banks, setBanks] = useState<Record<string, unknown>[]>([]);
  const [posAccounts, setPosAccounts] = useState<Record<string, unknown>[]>([]);
  const [bankMovements, setBankMovements] = useState<Record<string, unknown>[]>([]);
  const [posMovements, setPosMovements] = useState<Record<string, unknown>[]>([]);
  const [bankForm, setBankForm] = useState<BankAccountInput>(emptyBank);
  const [posForm, setPosForm] = useState<PosAccountInput>(emptyPos);
  const [editBankId, setEditBankId] = useState<number | null>(null);
  const [editPosId, setEditPosId] = useState<number | null>(null);
  const [filterBankId, setFilterBankId] = useState<number | ''>('');
  const [filterPosId, setFilterPosId] = useState<number | ''>('');
  const [movementForm, setMovementForm] = useState({
    bank_account_id: '' as number | '',
    movement_type: BANK_MOVEMENT_TYPES[0],
    amount: '',
    direction: 'in' as 'in' | 'out',
    description: '',
  });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadBanks = useCallback(async () => {
    setBanks(await ipc.banks.listAccounts(false));
  }, []);

  const loadPos = useCallback(async () => {
    setPosAccounts(await ipc.pos.listAccounts(false));
  }, []);

  const loadBankMovements = useCallback(async () => {
    setBankMovements(
      await ipc.banks.listMovements({
        bank_account_id: filterBankId === '' ? undefined : filterBankId,
      })
    );
  }, [filterBankId]);

  const loadPosMovements = useCallback(async () => {
    setPosMovements(
      await ipc.pos.listMovements({
        pos_account_id: filterPosId === '' ? undefined : filterPosId,
      })
    );
  }, [filterPosId]);

  useEffect(() => { loadBanks(); loadPos(); }, [loadBanks, loadPos]);
  useEffect(() => { if (tab === 'bankMovements') loadBankMovements(); }, [tab, loadBankMovements]);
  useEffect(() => { if (tab === 'posMovements') loadPosMovements(); }, [tab, loadPosMovements]);

  const saveBank = async () => {
    if (!bankForm.account_name.trim() || !bankForm.bank_name.trim()) {
      setError('Hesap adı ve banka adı zorunludur.');
      return;
    }
    setError('');
    try {
      if (editBankId) {
        await ipc.banks.updateAccount(editBankId, bankForm);
        setToast('Banka hesabı güncellendi.');
      } else {
        await ipc.banks.createAccount(bankForm);
        setToast('Banka hesabı oluşturuldu.');
      }
      setBankForm(emptyBank);
      setEditBankId(null);
      loadBanks();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const savePos = async () => {
    if (!posForm.name.trim()) {
      setError('POS adı zorunludur.');
      return;
    }
    setError('');
    try {
      if (editPosId) {
        await ipc.pos.updateAccount(editPosId, posForm);
        setToast('POS hesabı güncellendi.');
      } else {
        await ipc.pos.createAccount(posForm);
        setToast('POS hesabı oluşturuldu.');
      }
      setPosForm(emptyPos);
      setEditPosId(null);
      loadPos();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveMovement = async () => {
    const amount = parseFloat(movementForm.amount);
    if (!movementForm.bank_account_id || !amount || amount <= 0) {
      setError('Hesap ve geçerli tutar girin.');
      return;
    }
    setError('');
    try {
      await ipc.banks.addMovement({
        bank_account_id: movementForm.bank_account_id,
        movement_type: movementForm.movement_type,
        amount,
        direction: movementForm.direction,
        description: movementForm.description || undefined,
      });
      setToast('Banka hareketi kaydedildi.');
      setMovementForm({ ...movementForm, amount: '', description: '' });
      loadBankMovements();
      loadBanks();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Banka / POS</h2>
        <button type="button" className="btn" onClick={() => { loadBanks(); loadPos(); }}>Yenile</button>
      </div>
      {toast && <div className="toast success" onAnimationEnd={() => setToast('')}>{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        {([
          ['banks', 'Banka Hesapları'],
          ['pos', 'POS Hesapları'],
          ['bankMovements', 'Banka Hareketleri'],
          ['posMovements', 'POS Tahsilatları'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'banks' && (
        <div className="panel">
          {canEdit && (
            <div className="panel-body" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="form-row">
                <div className="form-group"><label>Hesap adı *</label><input className="form-input" value={bankForm.account_name} onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })} /></div>
                <div className="form-group"><label>Banka *</label><input className="form-input" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} /></div>
                <div className="form-group"><label>IBAN</label><input className="form-input" value={bankForm.iban} onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })} /></div>
                <div className="form-group"><label>Şube</label><input className="form-input" value={bankForm.branch_name} onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })} /></div>
                <div className="form-group"><label>Hesap no</label><input className="form-input" value={bankForm.account_no} onChange={(e) => setBankForm({ ...bankForm, account_no: e.target.value })} /></div>
                <div className="form-group"><label>Açılış bakiyesi</label><input type="number" className="form-input" value={bankForm.opening_balance} onChange={(e) => setBankForm({ ...bankForm, opening_balance: parseFloat(e.target.value) || 0 })} /></div>
                <div className="form-group"><label>Aktif</label><input type="checkbox" checked={bankForm.is_active !== false} onChange={(e) => setBankForm({ ...bankForm, is_active: e.target.checked })} /></div>
              </div>
              <button type="button" className="btn btn-primary" onClick={saveBank}>{editBankId ? 'Güncelle' : 'Hesap Ekle'}</button>
              {editBankId && <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => { setEditBankId(null); setBankForm(emptyBank); }}>İptal</button>}
            </div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Hesap</th><th>Banka</th><th>IBAN</th><th className="text-right">Bakiye</th><th>Durum</th>{canEdit && <th>İşlem</th>}</tr>
              </thead>
              <tbody>
                {banks.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="empty-text">Kayıt yok</td></tr> : banks.map((b) => (
                  <tr key={String(b.id)}>
                    <td>{String(b.account_name)}</td>
                    <td>{String(b.bank_name)}</td>
                    <td>{String(b.iban || '-')}</td>
                    <td className="text-right">{formatCurrency(Number(b.current_balance))}</td>
                    <td>{Number(b.is_active) ? 'Aktif' : 'Pasif'}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => {
                          setEditBankId(Number(b.id));
                          setBankForm({
                            account_name: String(b.account_name),
                            bank_name: String(b.bank_name),
                            iban: String(b.iban || ''),
                            branch_name: String(b.branch_name || ''),
                            account_no: String(b.account_no || ''),
                            opening_balance: Number(b.opening_balance),
                            is_active: Boolean(b.is_active),
                            notes: String(b.notes || ''),
                          });
                        }}>Düzenle</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pos' && (
        <div className="panel">
          {canEdit && (
            <div className="panel-body" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="form-row">
                <div className="form-group"><label>POS adı *</label><input className="form-input" value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} /></div>
                <div className="form-group">
                  <label>Banka hesabı</label>
                  <select className="form-select" value={posForm.bank_account_id ?? ''} onChange={(e) => setPosForm({ ...posForm, bank_account_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {banks.filter((b) => Number(b.is_active)).map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Komisyon %</label><input type="number" className="form-input" value={posForm.commission_rate} onChange={(e) => setPosForm({ ...posForm, commission_rate: parseFloat(e.target.value) || 0 })} /></div>
                <div className="form-group"><label>Bloke günü</label><input type="number" className="form-input" value={posForm.block_days} onChange={(e) => setPosForm({ ...posForm, block_days: parseInt(e.target.value, 10) || 0 })} /></div>
                <div className="form-group"><label>Aktif</label><input type="checkbox" checked={posForm.is_active !== false} onChange={(e) => setPosForm({ ...posForm, is_active: e.target.checked })} /></div>
              </div>
              <button type="button" className="btn btn-primary" onClick={savePos}>{editPosId ? 'Güncelle' : 'POS Ekle'}</button>
            </div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>POS</th><th>Banka</th><th className="text-right">Komisyon</th><th>Bloke</th><th>Durum</th>{canEdit && <th>İşlem</th>}</tr>
              </thead>
              <tbody>
                {posAccounts.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="empty-text">Kayıt yok</td></tr> : posAccounts.map((p) => (
                  <tr key={String(p.id)}>
                    <td>{String(p.name)}</td>
                    <td>{String(p.bank_account_name || '-')}</td>
                    <td className="text-right">%{Number(p.commission_rate || 0).toFixed(2)}</td>
                    <td>{Number(p.block_days || 0)} gün</td>
                    <td>{Number(p.is_active) ? 'Aktif' : 'Pasif'}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="btn btn-sm" onClick={() => {
                          setEditPosId(Number(p.id));
                          setPosForm({
                            name: String(p.name),
                            bank_account_id: p.bank_account_id ? Number(p.bank_account_id) : null,
                            commission_rate: Number(p.commission_rate || 0),
                            block_days: Number(p.block_days || 0),
                            is_active: Boolean(p.is_active),
                            notes: String(p.notes || ''),
                          });
                        }}>Düzenle</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'bankMovements' && (
        <div className="panel">
          <div className="toolbar">
            <select className="form-select" value={filterBankId} onChange={(e) => setFilterBankId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Tüm hesaplar</option>
              {banks.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)}</option>)}
            </select>
            <button type="button" className="btn" onClick={loadBankMovements}>Filtrele</button>
          </div>
          {canEdit && (
            <div className="panel-body" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Hesap</label>
                  <select className="form-select" value={movementForm.bank_account_id} onChange={(e) => setMovementForm({ ...movementForm, bank_account_id: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">Seçin</option>
                    {banks.filter((b) => Number(b.is_active)).map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tür</label>
                  <select className="form-select" value={movementForm.movement_type} onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value as typeof movementForm.movement_type })}>
                    {BANK_MOVEMENT_TYPES.filter((t) => !t.includes('aktarım')).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Yön</label>
                  <select className="form-select" value={movementForm.direction} onChange={(e) => setMovementForm({ ...movementForm, direction: e.target.value as 'in' | 'out' })}>
                    <option value="in">Giriş</option>
                    <option value="out">Çıkış</option>
                  </select>
                </div>
                <div className="form-group"><label>Tutar</label><input type="number" className="form-input" value={movementForm.amount} onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })} /></div>
                <div className="form-group"><label>Açıklama</label><input className="form-input" value={movementForm.description} onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })} /></div>
              </div>
              <button type="button" className="btn btn-primary" onClick={saveMovement}>Hareket Kaydet</button>
            </div>
          )}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Tarih</th><th>Hesap</th><th>Tür</th><th>Açıklama</th><th className="text-right">Tutar</th></tr>
              </thead>
              <tbody>
                {bankMovements.length === 0 ? <tr><td colSpan={5} className="empty-text">Hareket yok</td></tr> : bankMovements.map((m) => (
                  <tr key={String(m.id)}>
                    <td>{String(m.movement_date)}</td>
                    <td>{String(m.account_name || m.bank_account_id)}</td>
                    <td>{String(m.movement_type)}</td>
                    <td>{String(m.description || '-')}</td>
                    <td className={`text-right ${m.direction === 'in' ? 'amount-positive' : 'amount-negative'}`}>
                      {m.direction === 'in' ? '+' : '-'}{formatCurrency(Number(m.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'posMovements' && (
        <div className="panel">
          <div className="toolbar">
            <select className="form-select" value={filterPosId} onChange={(e) => setFilterPosId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Tüm POS</option>
              {posAccounts.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
            </select>
            <button type="button" className="btn" onClick={loadPosMovements}>Filtrele</button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Tarih</th><th>POS</th><th>Satış</th><th className="text-right">Brüt</th><th className="text-right">Komisyon</th><th className="text-right">Net</th><th>Bankaya geçiş</th><th>Durum</th></tr>
              </thead>
              <tbody>
                {posMovements.length === 0 ? <tr><td colSpan={8} className="empty-text">Tahsilat yok</td></tr> : posMovements.map((m) => (
                  <tr key={String(m.id)}>
                    <td>{String(m.created_at)}</td>
                    <td>{String(m.pos_name || m.pos_account_id)}</td>
                    <td>{String(m.sale_no || m.sale_id)}</td>
                    <td className="text-right">{formatCurrency(Number(m.gross_amount))}</td>
                    <td className="text-right">{formatCurrency(Number(m.commission_amount))}</td>
                    <td className="text-right amount-positive">{formatCurrency(Number(m.net_amount))}</td>
                    <td>{String(m.expected_transfer_date || '-')}</td>
                    <td>{String(m.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
