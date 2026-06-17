import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import type { StatementFilter } from '@/types/finance';

type StmtType = 'customer' | 'supplier' | 'cash' | 'bank' | 'pos';

const STMT_LABELS: Record<StmtType, string> = {
  customer: 'Müşteri Ekstresi',
  supplier: 'Tedarikçi Ekstresi',
  cash: 'Kasa Ekstresi',
  bank: 'Banka Ekstresi',
  pos: 'POS Ekstresi',
};

export default function StatementsPage() {
  const [stmtType, setStmtType] = useState<StmtType>('customer');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entityId, setEntityId] = useState<number | ''>('');
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [banks, setBanks] = useState<Record<string, unknown>[]>([]);
  const [posAccounts, setPosAccounts] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ipc.customers.list().then(setCustomers).catch(console.error);
    ipc.suppliers.list().then(setSuppliers).catch(console.error);
    ipc.banks.listAccounts(false).then(setBanks).catch(console.error);
    ipc.pos.listAccounts(false).then(setPosAccounts).catch(console.error);
  }, []);

  const filter: StatementFilter = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (stmtType === 'customer') {
        if (!entityId) { setError('Müşteri seçin.'); setRows([]); return; }
        const res = await ipc.statements.getCustomer(entityId, filter);
        setRows(res.rows);
        const c = customers.find((x) => Number(x.id) === entityId);
        setSubtitle(c ? String(c.full_name) : `Müşteri #${entityId}`);
      } else if (stmtType === 'supplier') {
        if (!entityId) { setError('Tedarikçi seçin.'); setRows([]); return; }
        const res = await ipc.statements.getSupplier(entityId, filter);
        setRows(res.rows);
        const s = suppliers.find((x) => Number(x.id) === entityId);
        setSubtitle(s ? String(s.name) : `Tedarikçi #${entityId}`);
      } else if (stmtType === 'cash') {
        const res = await ipc.statements.getCash(filter);
        setRows(res.rows);
        setSubtitle('Kasa');
      } else if (stmtType === 'bank') {
        if (!entityId) { setError('Banka hesabı seçin.'); setRows([]); return; }
        const res = await ipc.statements.getBank(entityId, filter);
        setRows(res.rows);
        const b = banks.find((x) => Number(x.id) === entityId);
        setSubtitle(b ? String(b.account_name) : `Hesap #${entityId}`);
      } else {
        if (!entityId) { setError('POS hesabı seçin.'); setRows([]); return; }
        const res = await ipc.statements.getPos(entityId, filter);
        setRows(res.rows);
        setSubtitle(res.posName);
      }
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [stmtType, entityId, dateFrom, dateTo, customers, suppliers, banks]);

  const handlePrint = async () => {
    if (!rows.length) return;
    const html = await ipc.statements.print({
      title: STMT_LABELS[stmtType],
      subtitle,
      rows,
    });
    openPrintPreview({ html, title: STMT_LABELS[stmtType] });
  };

  const handleExport = async () => {
    if (!rows.length) return;
    await ipc.reports.exportExcel({
      fileName: `ekstre-${stmtType}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      rows,
      sheetName: 'Ekstre',
    });
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Ekstreler</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel" style={{ marginBottom: 8 }}>
        <div className="panel-body">
          <div className="form-row">
            <div className="form-group">
              <label>Ekstre türü</label>
              <select className="form-select" value={stmtType} onChange={(e) => { setStmtType(e.target.value as StmtType); setEntityId(''); setRows([]); }}>
                {(Object.keys(STMT_LABELS) as StmtType[]).map((k) => <option key={k} value={k}>{STMT_LABELS[k]}</option>)}
              </select>
            </div>
            {(stmtType === 'customer' || stmtType === 'supplier' || stmtType === 'bank' || stmtType === 'pos') && (
              <div className="form-group">
                <label>{stmtType === 'customer' ? 'Müşteri' : stmtType === 'supplier' ? 'Tedarikçi' : stmtType === 'bank' ? 'Banka' : 'POS'}</label>
                <select className="form-select" value={entityId} onChange={(e) => setEntityId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Seçin</option>
                  {stmtType === 'customer' && customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.full_name)}</option>)}
                  {stmtType === 'supplier' && suppliers.map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}
                  {stmtType === 'bank' && banks.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.account_name)}</option>)}
                  {stmtType === 'pos' && posAccounts.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}
                </select>
              </div>
            )}
            <div className="form-group"><label>Başlangıç</label><input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div className="form-group"><label>Bitiş</label><input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Ekstre Al'}</button>
              <button type="button" className="btn" onClick={handleExport} disabled={!rows.length}>Excel</button>
              <button type="button" className="btn" onClick={handlePrint} disabled={!rows.length}>Yazdır</button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">{subtitle || 'Ekstre'}</div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Tarih</th><th>İşlem türü</th><th>Belge no</th><th>Açıklama</th><th className="text-right">Borç</th><th className="text-right">Alacak</th><th className="text-right">Bakiye</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} className="empty-text">Ekstre almak için filtreleyin</td></tr> : rows.map((r, i) => (
                <tr key={i}>
                  <td>{String(r.movement_date)}</td>
                  <td>{String(r.movement_type)}</td>
                  <td>{String(r.document_no || '-')}</td>
                  <td>{String(r.description || '-')}</td>
                  <td className="text-right amount-negative">{Number(r.debit) ? formatCurrency(Number(r.debit)) : '-'}</td>
                  <td className="text-right amount-positive">{Number(r.credit) ? formatCurrency(Number(r.credit)) : '-'}</td>
                  <td className="text-right">{formatCurrency(Number(r.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
