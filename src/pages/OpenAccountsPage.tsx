import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { PERMISSIONS } from '@/types/auth';

type Tab = 'customers' | 'suppliers';

export default function OpenAccountsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canPay = hasPermission(PERMISSIONS.CASH_EDIT) || hasPermission(PERMISSIONS.SUPPLIER_PAYMENTS);
  const [tab, setTab] = useState<Tab>('customers');
  const [customerRows, setCustomerRows] = useState<Record<string, unknown>[]>([]);
  const [supplierRows, setSupplierRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cust, supp] = await Promise.all([
        ipc.reports.getCustomerAccountReport({ balance: 'debt' }),
        ipc.reports.getSupplierAccountReport({ balance: 'debt' }),
      ]);
      setCustomerRows((cust.rows as Record<string, unknown>[]) || []);
      setSupplierRows((supp.rows as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = tab === 'customers' ? customerRows : supplierRows;

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Açık Hesaplar</h2>
        <button type="button" className="btn" onClick={load}>Yenile</button>
      </div>

      <div className="tab-bar">
        <button type="button" className={`tab-btn ${tab === 'customers' ? 'active' : ''}`} onClick={() => setTab('customers')}>Müşteri Açık Hesapları</button>
        <button type="button" className={`tab-btn ${tab === 'suppliers' ? 'active' : ''}`} onClick={() => setTab('suppliers')}>Tedarikçi Açık Hesapları</button>
      </div>

      <div className="panel">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kişi / Firma</th>
                <th className="text-right">Toplam borç</th>
                <th className="text-right">Toplam alacak</th>
                <th className="text-right">Bakiye</th>
                <th className="text-right">Vadesi geçen</th>
                <th>Son işlem</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="empty-text">Yükleniyor...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="empty-text">Açık hesap yok</td></tr>
              ) : rows.map((r) => (
                <tr key={String(r.id || r.customer_id || r.supplier_id)}>
                  <td>{String(r.full_name || r.name || r.customer_name || r.supplier_name)}</td>
                  <td className="text-right">{formatCurrency(Number(r.total_debit || r.debit_total || 0))}</td>
                  <td className="text-right">{formatCurrency(Number(r.total_credit || r.credit_total || 0))}</td>
                  <td className={`text-right ${Number(r.balance) > 0 ? 'amount-negative' : 'amount-positive'}`}>{formatCurrency(Number(r.balance || 0))}</td>
                  <td className="text-right">{formatCurrency(Number(r.overdue_amount || 0))}</td>
                  <td>{String(r.last_movement_date || r.last_transaction || '-')}</td>
                  <td>
                    {tab === 'customers' && canPay && (
                      <button type="button" className="btn btn-sm" onClick={() => navigate('/kasa')}>Tahsilat</button>
                    )}
                    {tab === 'suppliers' && canPay && (
                      <button type="button" className="btn btn-sm" onClick={() => navigate('/tedarikciler?tab=payments')}>Ödeme</button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => navigate(tab === 'customers' ? '/ekstreler' : '/ekstreler')}
                    >
                      Ekstre
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
