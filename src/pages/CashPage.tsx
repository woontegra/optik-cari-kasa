import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { CashMovementRow, CashSummary, Customer, CashPaymentType } from '@/types/electron';
import { CASH_PAYMENT_TYPES } from '@/types/electron';
import { PERMISSIONS } from '@/types/auth';
import '@/components/products/ProductForm.css';

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast-success">{message}</div>;
}

export default function CashPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.CASH_EDIT);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeType, setIncomeType] = useState<CashPaymentType>('Nakit');
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeCustomerSearch, setIncomeCustomerSearch] = useState('');
  const [incomeCustomer, setIncomeCustomer] = useState<Customer | null>(null);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);

  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<CashPaymentType>('Nakit');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Genel');

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDirection, setTransferDirection] = useState<'toBank' | 'fromBank'>('toBank');
  const [transferBankId, setTransferBankId] = useState<number | ''>('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [bankAccounts, setBankAccounts] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([ipc.cash.getSummary(), ipc.cash.listMovements()])
      .then(([s, m]) => {
        setSummary(s);
        setMovements(m);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (canEdit) ipc.banks.listAccounts().then(setBankAccounts).catch(console.error);
  }, [canEdit]);

  const searchCustomer = (q: string) => {
    setIncomeCustomerSearch(q);
    if (!q.trim()) { setCustomerResults([]); return; }
    ipc.customers.search(q).then(setCustomerResults).catch(console.error);
  };

  const handleIncome = async () => {
    const amount = parseFloat(incomeAmount);
    if (!amount || amount <= 0) { setError('Geçerli tutar girin.'); return; }
    setError('');
    try {
      await ipc.cash.addIncome({
        amount,
        paymentType: incomeType,
        description: incomeDesc || undefined,
        customerId: incomeCustomer?.id,
      });
      setToast('Tahsilat kaydedildi.');
      setShowIncome(false);
      setIncomeAmount('');
      setIncomeCustomer(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (!amount || amount <= 0) { setError('Geçerli tutar girin.'); return; }
    if (!expenseDesc.trim()) { setError('Açıklama zorunludur.'); return; }
    setError('');
    try {
      await ipc.cash.addExpense({
        amount,
        paymentType: expenseType,
        description: expenseDesc,
        category: expenseCategory,
      });
      setToast('Gider kaydedildi.');
      setShowExpense(false);
      setExpenseAmount('');
      setExpenseDesc('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (!transferBankId || !amount || amount <= 0) {
      setError('Banka hesabı ve geçerli tutar girin.');
      return;
    }
    setError('');
    try {
      if (transferDirection === 'toBank') {
        await ipc.banks.transferCashToBank({
          bank_account_id: transferBankId,
          amount,
          description: transferDesc || 'Kasadan bankaya aktarım',
        });
        setToast('Kasadan bankaya aktarım yapıldı.');
      } else {
        await ipc.banks.transferBankToCash({
          bank_account_id: transferBankId,
          amount,
          description: transferDesc || 'Bankadan kasaya aktarım',
        });
        setToast('Bankadan kasaya aktarım yapıldı.');
      }
      setShowTransfer(false);
      setTransferAmount('');
      setTransferDesc('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading && !summary) return <div className="loading-text">Yükleniyor...</div>;

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Kasa / Tahsilat</h2>
        <button className="btn" onClick={load}>Yenile</button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast('')} />}
      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-box"><div className="stat-label">Bugün Nakit</div><div className="stat-value">{formatCurrency(summary.todayCash)}</div></div>
          <div className="stat-box"><div className="stat-label">Bugün Kart</div><div className="stat-value">{formatCurrency(summary.todayCard)}</div></div>
          <div className="stat-box"><div className="stat-label">Bugün Havale</div><div className="stat-value">{formatCurrency(summary.todayTransfer)}</div></div>
          <div className="stat-box"><div className="stat-label">Bugün Tahsilat</div><div className="stat-value amount-positive">{formatCurrency(summary.todayCollection)}</div></div>
          <div className="stat-box"><div className="stat-label">Toplam Kasa</div><div className="stat-value">{formatCurrency(summary.totalCash)}</div></div>
        </div>
      )}

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="toolbar">
          {canEdit && (
            <>
              <button className="btn btn-primary" onClick={() => { setShowIncome(true); setShowExpense(false); setShowTransfer(false); }}>Manuel Tahsilat</button>
              <button className="btn" onClick={() => { setShowExpense(true); setShowIncome(false); setShowTransfer(false); }}>Manuel Gider</button>
              <button className="btn" onClick={() => { setShowTransfer(true); setShowIncome(false); setShowExpense(false); }}>Kasa-Banka Aktarım</button>
            </>
          )}
        </div>

        {(showIncome || showExpense || showTransfer) && canEdit && (
          <div className="panel-body" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {showIncome && (
              <div className="form-row">
                <div className="form-group"><label>Tutar</label><input type="number" className="form-input" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} /></div>
                <div className="form-group">
                  <label>Ödeme Türü</label>
                  <select className="form-select" value={incomeType} onChange={(e) => setIncomeType(e.target.value as CashPaymentType)}>
                    {CASH_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Açıklama</label><input className="form-input" value={incomeDesc} onChange={(e) => setIncomeDesc(e.target.value)} /></div>
                <div className="form-group">
                  <label>Müşteri (opsiyonel)</label>
                  {incomeCustomer ? (
                    <div>{incomeCustomer.full_name} <button type="button" className="btn btn-remove" onClick={() => setIncomeCustomer(null)}>×</button></div>
                  ) : (
                    <>
                      <input className="form-input" value={incomeCustomerSearch} onChange={(e) => searchCustomer(e.target.value)} placeholder="Müşteri ara..." />
                      {customerResults.map((c) => (
                        <div key={c.id} className="customer-dropdown-item" onClick={() => { setIncomeCustomer(c); setCustomerResults([]); }}>
                          {c.full_name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button className="btn btn-primary" onClick={handleIncome}>Kaydet</button>
                  <button className="btn" onClick={() => setShowIncome(false)}>Vazgeç</button>
                </div>
              </div>
            )}
            {showExpense && (
              <div className="form-row">
                <div className="form-group"><label>Tutar</label><input type="number" className="form-input" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} /></div>
                <div className="form-group">
                  <label>Ödeme Türü</label>
                  <select className="form-select" value={expenseType} onChange={(e) => setExpenseType(e.target.value as CashPaymentType)}>
                    {CASH_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Kategori</label><input className="form-input" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} /></div>
                <div className="form-group"><label>Açıklama *</label><input className="form-input" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button className="btn btn-primary" onClick={handleExpense}>Kaydet</button>
                  <button className="btn" onClick={() => setShowExpense(false)}>Vazgeç</button>
                </div>
              </div>
            )}
            {showTransfer && (
              <div className="form-row">
                <div className="form-group">
                  <label>İşlem</label>
                  <select className="form-select" value={transferDirection} onChange={(e) => setTransferDirection(e.target.value as 'toBank' | 'fromBank')}>
                    <option value="toBank">Kasadan Bankaya Aktar</option>
                    <option value="fromBank">Bankadan Kasaya Aktar</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Banka hesabı</label>
                  <select className="form-select" value={transferBankId} onChange={(e) => setTransferBankId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">Seçin</option>
                    {bankAccounts.filter((b) => Number(b.is_active)).map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)} — {formatCurrency(Number(b.current_balance))}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Tutar</label><input type="number" className="form-input" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} /></div>
                <div className="form-group"><label>Açıklama</label><input className="form-input" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button className="btn btn-primary" onClick={handleTransfer}>Aktar</button>
                  <button className="btn" onClick={() => setShowTransfer(false)}>Vazgeç</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Ödeme Türü</th>
                <th>Müşteri</th>
                <th>Açıklama</th>
                <th className="text-right">Giriş</th>
                <th className="text-right">Çıkış</th>
                <th className="text-right">Tutar</th>
                <th>Satış No</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={9} className="empty-text">Kasa hareketi bulunamadı</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.movement_date)}</td>
                    <td>{m.movement_type}</td>
                    <td>{m.payment_type || '-'}</td>
                    <td>{m.customer_name || '-'}</td>
                    <td>{m.description || '-'}</td>
                    <td className="text-right amount-positive">{m.amount > 0 ? formatCurrency(m.amount) : '-'}</td>
                    <td className="text-right amount-negative">{m.amount < 0 ? formatCurrency(Math.abs(m.amount)) : '-'}</td>
                    <td className={`text-right${m.amount >= 0 ? ' amount-positive' : ' amount-negative'}`}>{formatCurrency(m.amount)}</td>
                    <td>{m.sale_no || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
