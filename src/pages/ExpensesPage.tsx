import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  PERSONNEL_EXPENSE_TYPES,
  type ExpenseInput,
  type PersonnelExpenseInput,
} from '@/types/finance';

type Tab = 'expenses' | 'personnel';

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.FINANCE_EDIT);
  const [tab, setTab] = useState<Tab>('expenses');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [banks, setBanks] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [expenseForm, setExpenseForm] = useState<ExpenseInput>({
    expense_date: today(),
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: 0,
    vat_rate: 0,
    payment_method: 'Nakit',
    bank_account_id: null,
    document_no: '',
    notes: '',
  });

  const [personnelForm, setPersonnelForm] = useState<PersonnelExpenseInput>({
    personnel_name: '',
    expense_type: PERSONNEL_EXPENSE_TYPES[0],
    expense_date: today(),
    amount: 0,
    payment_method: 'Nakit',
    bank_account_id: null,
    description: '',
  });

  const [amountInput, setAmountInput] = useState('');
  const [personnelAmountInput, setPersonnelAmountInput] = useState('');

  const load = useCallback(async () => {
    const filters: Record<string, unknown> = {};
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    setRows(await ipc.expenses.list(filters));
  }, [dateFrom, dateTo]);

  useEffect(() => {
    ipc.banks.listAccounts().then(setBanks).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveExpense = async () => {
    const amount = parseFloat(amountInput);
    if (!amount || amount <= 0 || !expenseForm.description.trim()) {
      setError('Açıklama ve geçerli tutar zorunludur.');
      return;
    }
    if (expenseForm.payment_method === 'Banka' && !expenseForm.bank_account_id) {
      setError('Banka ödemesi için hesap seçin.');
      return;
    }
    setError('');
    try {
      await ipc.expenses.create({ ...expenseForm, amount });
      setToast('Gider kaydedildi.');
      setAmountInput('');
      setExpenseForm({ ...expenseForm, description: '', document_no: '', notes: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const savePersonnel = async () => {
    const amount = parseFloat(personnelAmountInput);
    if (!personnelForm.personnel_name.trim() || !amount || amount <= 0) {
      setError('Personel adı ve geçerli tutar zorunludur.');
      return;
    }
    setError('');
    try {
      await ipc.expenses.createPersonnel({ ...personnelForm, amount });
      setToast('Personel gideri kaydedildi.');
      setPersonnelAmountInput('');
      setPersonnelForm({ ...personnelForm, personnel_name: '', description: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelExpense = async (id: number) => {
    if (!window.confirm('Gider iptal edilsin mi?')) return;
    try {
      await ipc.expenses.cancel(id);
      setToast('Gider iptal edildi.');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Giderler</h2>
        <button type="button" className="btn" onClick={load}>Yenile</button>
      </div>
      {toast && <div className="toast success">{toast}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        <button type="button" className={`tab-btn ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>Giderler</button>
        <button type="button" className={`tab-btn ${tab === 'personnel' ? 'active' : ''}`} onClick={() => setTab('personnel')}>Personel Giderleri</button>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button type="button" className="btn" onClick={load}>Filtrele</button>
      </div>

      {tab === 'expenses' && canEdit && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <div className="panel-header">Yeni Gider</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group"><label>Tarih</label><input type="date" className="form-input" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} /></div>
              <div className="form-group">
                <label>Kategori</label>
                <select className="form-select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Açıklama *</label><input className="form-input" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
              <div className="form-group"><label>Tutar *</label><input type="number" className="form-input" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} /></div>
              <div className="form-group"><label>KDV %</label><input type="number" className="form-input" value={expenseForm.vat_rate} onChange={(e) => setExpenseForm({ ...expenseForm, vat_rate: parseFloat(e.target.value) || 0 })} /></div>
              <div className="form-group">
                <label>Ödeme</label>
                <select className="form-select" value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value as ExpenseInput['payment_method'] })}>
                  {EXPENSE_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {expenseForm.payment_method === 'Banka' && (
                <div className="form-group">
                  <label>Banka hesabı</label>
                  <select className="form-select" value={expenseForm.bank_account_id ?? ''} onChange={(e) => setExpenseForm({ ...expenseForm, bank_account_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Seçin</option>
                    {banks.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group"><label>Belge no</label><input className="form-input" value={expenseForm.document_no} onChange={(e) => setExpenseForm({ ...expenseForm, document_no: e.target.value })} /></div>
            </div>
            <button type="button" className="btn btn-primary" onClick={saveExpense}>Kaydet</button>
          </div>
        </div>
      )}

      {tab === 'personnel' && canEdit && (
        <div className="panel" style={{ marginBottom: 8 }}>
          <div className="panel-header">Personel Gideri</div>
          <div className="panel-body">
            <div className="form-row">
              <div className="form-group"><label>Personel *</label><input className="form-input" value={personnelForm.personnel_name} onChange={(e) => setPersonnelForm({ ...personnelForm, personnel_name: e.target.value })} /></div>
              <div className="form-group">
                <label>Tür</label>
                <select className="form-select" value={personnelForm.expense_type} onChange={(e) => setPersonnelForm({ ...personnelForm, expense_type: e.target.value })}>
                  {PERSONNEL_EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Tarih</label><input type="date" className="form-input" value={personnelForm.expense_date} onChange={(e) => setPersonnelForm({ ...personnelForm, expense_date: e.target.value })} /></div>
              <div className="form-group"><label>Tutar *</label><input type="number" className="form-input" value={personnelAmountInput} onChange={(e) => setPersonnelAmountInput(e.target.value)} /></div>
              <div className="form-group">
                <label>Ödeme</label>
                <select className="form-select" value={personnelForm.payment_method} onChange={(e) => setPersonnelForm({ ...personnelForm, payment_method: e.target.value as PersonnelExpenseInput['payment_method'] })}>
                  {EXPENSE_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Açıklama</label><input className="form-input" value={personnelForm.description} onChange={(e) => setPersonnelForm({ ...personnelForm, description: e.target.value })} /></div>
            </div>
            <button type="button" className="btn btn-primary" onClick={savePersonnel}>Kaydet</button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">Gider Listesi</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Ödeme</th><th className="text-right">Tutar</th><th>Durum</th>{canEdit && <th>İşlem</th>}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={canEdit ? 7 : 6} className="empty-text">Kayıt yok</td></tr> : rows.map((r) => (
                <tr key={String(r.id)}>
                  <td>{String(r.expense_date)}</td>
                  <td>{String(r.category)}</td>
                  <td>{String(r.description)}</td>
                  <td>{String(r.payment_method)}</td>
                  <td className="text-right amount-negative">{formatCurrency(Number(r.amount))}</td>
                  <td>{String(r.status)}</td>
                  {canEdit && (
                    <td>
                      {String(r.status) === 'Aktif' && (
                        <button type="button" className="btn btn-sm btn-remove" onClick={() => cancelExpense(Number(r.id))}>İptal</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
