import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { SaleListItem } from '@/types/electron';
import { PAYMENT_STATUSES, SALE_STATUSES } from '@/types/electron';
import SaleDetail from '@/components/sales/SaleDetail';
import '@/components/products/ProductForm.css';

export default function SalesListPage() {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [saleStatus, setSaleStatus] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    ipc.sales
      .list({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        customer_search: customerSearch || undefined,
        payment_status: paymentStatus || undefined,
        payment_type: paymentType || undefined,
        status: saleStatus || undefined,
      })
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, customerSearch, paymentStatus, paymentType, saleStatus]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const openDetail = (id: number) => {
    setSelectedId(id);
    setShowDetail(true);
  };

  return (
    <div className="page-content">
      <div className="page-title-bar">
        <h2 className="page-title">Satışlar</h2>
        <button className="btn" onClick={load}>Yenile</button>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="filter-bar">
          <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Başlangıç" />
          <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Bitiş" />
          <input className="form-input search-input" placeholder="Müşteri ara..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
          <select className="form-select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">Ödeme Durumu</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            <option value="">Ödeme Türü</option>
            <option value="Nakit">Nakit</option>
            <option value="Kredi Kartı">Kredi Kartı</option>
            <option value="Havale/EFT">Havale/EFT</option>
          </select>
          <select className="form-select" value={saleStatus} onChange={(e) => setSaleStatus(e.target.value)}>
            <option value="">Satış Durumu</option>
            {SALE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <div className="loading-text">Yükleniyor...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Satış No</th>
                  <th>Tarih</th>
                  <th>Müşteri</th>
                  <th>Reçete</th>
                  <th className="text-center">Adet</th>
                  <th className="text-right">Toplam</th>
                  <th className="text-right">Ödenen</th>
                  <th className="text-right">Kalan</th>
                  <th>Ödeme</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={11} className="empty-text">Satış bulunamadı</td></tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s.id} className={selectedId === s.id ? 'selected' : ''} onClick={() => setSelectedId(s.id)}>
                      <td>{s.sale_no}</td>
                      <td>{formatDateTime(s.sale_date)}</td>
                      <td>{s.customer_name || 'Perakende'}</td>
                      <td>{s.prescription_no || s.e_prescription_no || '-'}</td>
                      <td className="text-center">{s.item_count}</td>
                      <td className="text-right">{formatCurrency(s.net_amount)}</td>
                      <td className="text-right">{formatCurrency(s.paid_amount ?? 0)}</td>
                      <td className="text-right">{formatCurrency(s.remaining_amount ?? 0)}</td>
                      <td>{s.payment_status}</td>
                      <td>{s.status}</td>
                      <td>
                        <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); openDetail(s.id); }}>Detay</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDetail && selectedId && (
        <SaleDetail saleId={selectedId} onClose={() => setShowDetail(false)} onUpdated={load} />
      )}
    </div>
  );
}
