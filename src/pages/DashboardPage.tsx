import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { DashboardStats } from '@/types/electron';
import { checkMenuPermission } from '@/types/navigation';
import { PERMISSIONS, type Permission } from '@/types/auth';

interface QuickAction {
  label: string;
  icon: string;
  path: string;
  permission: Permission | Permission[];
  search?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      { label: 'Barkodlu Satış', icon: '⊞', path: '/satis', permission: PERMISSIONS.SALES_CREATE },
      { label: 'Mal Kabul', icon: '⊕', path: '/stok-giris', permission: PERMISSIONS.STOCK_EDIT },
      { label: 'Yeni Müşteri', icon: '☺', path: '/musteri', permission: PERMISSIONS.CUSTOMERS_EDIT },
      { label: 'Yeni Reçete', icon: '◎', path: '/recete', permission: PERMISSIONS.PRESCRIPTIONS_EDIT },
      { label: 'Kasa Tahsilat', icon: '₺', path: '/kasa', permission: PERMISSIONS.CASH_EDIT },
      { label: 'Sayım Başlat', icon: '☰', path: '/stok-sayim', permission: PERMISSIONS.STOCK_EDIT },
      { label: 'ÜTS / TİTUBB İşlemleri', icon: '▦', path: '/medula', permission: PERMISSIONS.MEDULA_VIEW },
      { label: 'Raporlar', icon: '▤', path: '/raporlar', permission: PERMISSIONS.REPORTS_VIEW },
    ].filter((action) => checkMenuPermission(action.permission, hasPermission)),
    [hasPermission]
  );

  const loadStats = useCallback(() => {
    setLoading(true);
    ipc.dashboard.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return <div className="loading-text">Yükleniyor...</div>;
  if (!stats) return <div className="empty-text">Veri yüklenemedi.</div>;

  return (
    <div className="page-content dashboard-page">
      <div className="page-title-bar">
        <h2 className="page-title">Dashboard</h2>
        <button className="btn" onClick={loadStats} disabled={loading}>Yenile</button>
      </div>

      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="panel-header">Hızlı İşlemler</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 12px 12px',
          }}
        >
          {quickActions.map((action) => (
            <button
              key={`${action.path}${action.search || ''}-${action.label}`}
              type="button"
              className="btn btn-sm"
              onClick={() => navigate(action.search ? { pathname: action.path, search: action.search } : action.path)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 32,
                paddingInline: 12,
              }}
            >
              <span aria-hidden="true">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid-6">
        <div className="stat-box stat-box-link" onClick={() => navigate('/raporlar?tab=dayEnd')} role="button" tabIndex={0}>
          <div className="stat-label">Bugünkü Satış</div>
          <div className="stat-value">{formatCurrency(stats.todaySales)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Bugünkü Tahsilat</div>
          <div className="stat-value amount-positive">{formatCurrency(stats.todayCollection)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Bugünkü İade</div>
          <div className="stat-value amount-negative">{formatCurrency(stats.todayReturns)}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/raporlar?tab=customerAccount&balance=debt')} role="button" tabIndex={0}>
          <div className="stat-label">Açık Hesap</div>
          <div className="stat-value amount-negative">{formatCurrency(stats.openAccountTotal)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">İptal (Bugün)</div>
          <div className="stat-value">{stats.cancelledToday}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/raporlar?tab=stock&stockType=critical&critical=1')} role="button" tabIndex={0}>
          <div className="stat-label">Kritik Stok</div>
          <div className={`stat-value${stats.criticalStock > 0 ? ' amount-negative' : ''}`}>{stats.criticalStock}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=tracking')} role="button" tabIndex={0}>
          <div className="stat-label">Medula Bekleyen</div>
          <div className={`stat-value${stats.medulaPending > 0 ? ' amount-negative' : ''}`}>{stats.medulaPending}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=sgk')} role="button" tabIndex={0}>
          <div className="stat-label">Eksik Medula Bilgisi</div>
          <div className={`stat-value${(stats.medulaMissingInfo ?? 0) > 0 ? ' amount-negative' : ''}`}>{stats.medulaMissingInfo ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=sgkInvoice')} role="button" tabIndex={0}>
          <div className="stat-label">SGK Faturaya Hazır</div>
          <div className={`stat-value${(stats.sgkInvoiceReady ?? 0) > 0 ? ' amount-positive' : ''}`}>{stats.sgkInvoiceReady ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/e-donusum?tab=drafts')} role="button" tabIndex={0}>
          <div className="stat-label">Fatura Taslağı</div>
          <div className="stat-value">{stats.invoiceDraftCount ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/e-donusum?tab=drafts')} role="button" tabIndex={0}>
          <div className="stat-label">Dışa Aktarılacak Belge</div>
          <div className={`stat-value${(stats.invoiceExportPending ?? 0) > 0 ? ' amount-positive' : ''}`}>{stats.invoiceExportPending ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/e-donusum?tab=drafts')} role="button" tabIndex={0}>
          <div className="stat-label">Eksik Bilgili Fatura</div>
          <div className={`stat-value${(stats.invoiceMissingInfo ?? 0) > 0 ? ' amount-negative' : ''}`}>{stats.invoiceMissingInfo ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/e-donusum?tab=sgk')} role="button" tabIndex={0}>
          <div className="stat-label">SGK Fatura Hazır</div>
          <div className={`stat-value${(stats.sgkInvoiceReadyForEdonusum ?? 0) > 0 ? ' amount-positive' : ''}`}>{stats.sgkInvoiceReadyForEdonusum ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=receivable')} role="button" tabIndex={0}>
          <div className="stat-label">Kurum Alacağı</div>
          <div className="stat-value amount-negative">{formatCurrency(stats.institutionReceivableTotal ?? 0)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Eksik ÜTS Bilgisi</div>
          <div className={`stat-value${stats.utsIncomplete > 0 ? ' amount-negative' : ''}`}>{stats.utsIncomplete}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=titubb')} role="button" tabIndex={0}>
          <div className="stat-label">TİTUBB Bekleyen</div>
          <div className={`stat-value${(stats.titubbPending ?? 0) > 0 ? ' amount-negative' : ''}`}>{stats.titubbPending ?? 0}</div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/tedarikciler?tab=purchases')} role="button" tabIndex={0}>
          <div className="stat-label">Bekleyen Alış Ödemesi</div>
          <div className={`stat-value${(stats.pendingPurchaseCount ?? 0) > 0 ? ' amount-negative' : ''}`}>
            {stats.pendingPurchaseCount ?? 0} ({formatCurrency(stats.pendingPurchaseTotal ?? 0)})
          </div>
        </div>
        <div className="stat-box stat-box-link" onClick={() => navigate('/tedarikciler?tab=account')} role="button" tabIndex={0}>
          <div className="stat-label">Tedarikçi Borç Toplamı</div>
          <div className="stat-value amount-negative">{formatCurrency(stats.supplierDebtTotal ?? 0)}</div>
        </div>
      </div>

      <div className="stat-grid-6" style={{ marginTop: -4 }}>
        <div className="stat-box">
          <div className="stat-label">Toplam Kasa</div>
          <div className="stat-value">{formatCurrency(stats.cashTotal)}</div>
        </div>
        {hasPermission(PERMISSIONS.FINANCE_VIEW) && (
          <>
            <div className="stat-box stat-box-link" onClick={() => navigate('/banka-pos')} role="button" tabIndex={0}>
              <div className="stat-label">Banka Bakiyesi</div>
              <div className="stat-value">{formatCurrency(stats.bankBalanceTotal ?? 0)}</div>
            </div>
            <div className="stat-box stat-box-link" onClick={() => navigate('/banka-pos')} role="button" tabIndex={0}>
              <div className="stat-label">POS Bekleyen</div>
              <div className="stat-value">{formatCurrency(stats.posPendingTotal ?? 0)}</div>
            </div>
            <div className="stat-box stat-box-link" onClick={() => navigate('/giderler')} role="button" tabIndex={0}>
              <div className="stat-label">Bugünkü Gider</div>
              <div className="stat-value amount-negative">{formatCurrency(stats.todayExpense ?? 0)}</div>
            </div>
            <div className="stat-box stat-box-link" onClick={() => navigate('/acik-hesaplar')} role="button" tabIndex={0}>
              <div className="stat-label">Müşteri Açık Hesap</div>
              <div className="stat-value amount-negative">{formatCurrency(stats.customerOpenTotal ?? 0)}</div>
            </div>
            <div className="stat-box stat-box-link" onClick={() => navigate('/kar-zarar')} role="button" tabIndex={0}>
              <div className="stat-label">Bugünkü Net Kâr</div>
              <div className={`stat-value ${(stats.todayNetProfit ?? 0) >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                {formatCurrency(stats.todayNetProfit ?? 0)}
              </div>
            </div>
          </>
        )}
        <div className="stat-box">
          <div className="stat-label">Aktif Reçete</div>
          <div className="stat-value">{stats.activePrescriptions}</div>
        </div>
        {hasPermission(PERMISSIONS.CAMPAIGN_VIEW) && (
          <>
            <div className="stat-box stat-box-link" onClick={() => navigate('/kampanyalar')} role="button" tabIndex={0}>
              <div className="stat-label">Aktif Kampanya</div>
              <div className="stat-value">{stats.activeCampaignCount ?? 0}</div>
            </div>
            <div className="stat-box stat-box-link" onClick={() => navigate('/kampanyalar')} role="button" tabIndex={0}>
              <div className="stat-label">Bugünkü Kampanya İndirimi</div>
              <div className="stat-value amount-negative">{formatCurrency(stats.todayCampaignDiscount ?? 0)}</div>
            </div>
          </>
        )}
      </div>

      {hasPermission(PERMISSIONS.UTS_VIEW) && (
        <div className="stat-grid-6" style={{ marginBottom: 8 }}>
          <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=receive')} role="button" tabIndex={0}>
            <div className="stat-label">ÜTS Alma Bekleyen</div>
            <div className="stat-value">{stats.utsPendingReceive ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=give')} role="button" tabIndex={0}>
            <div className="stat-label">ÜTS Verme Bekleyen</div>
            <div className="stat-value">{stats.utsPendingGive ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=history')} role="button" tabIndex={0}>
            <div className="stat-label">ÜTS Hatalı Kayıt</div>
            <div className="stat-value amount-negative">{stats.utsErrorCount ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/medula?tab=titubb')} role="button" tabIndex={0}>
            <div className="stat-label">TİTUBB Bekleyen</div>
            <div className="stat-value">{stats.utsTitubbPending ?? stats.titubbPending ?? 0}</div>
          </div>
        </div>
      )}

      {hasPermission(PERMISSIONS.CUSTOMERS_VIEW) && (
        <div className="stat-grid-6" style={{ marginBottom: 8 }}>
          <div className="stat-box stat-box-link" onClick={() => navigate('/randevular')} role="button" tabIndex={0}>
            <div className="stat-label">Bugünkü Randevu</div>
            <div className="stat-value">{stats.todayAppointments ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/musteri')} role="button" tabIndex={0}>
            <div className="stat-label">Yaklaşan Kontrol</div>
            <div className="stat-value">{stats.upcomingControls ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/musteri')} role="button" tabIndex={0}>
            <div className="stat-label">Borçlu Müşteri</div>
            <div className="stat-value amount-negative">{stats.debtorsCount ?? 0}</div>
          </div>
          <div className="stat-box stat-box-link" onClick={() => navigate('/musteri')} role="button" tabIndex={0}>
            <div className="stat-label">Lens Yenileme Yaklaşan</div>
            <div className="stat-value">{stats.lensRenewalSoon ?? 0}</div>
          </div>
        </div>
      )}

      <div className="dashboard-tables" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 220 }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header">Son Satışlar</div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Satış No</th>
                  <th>Müşteri</th>
                  <th className="text-right">Tutar</th>
                  <th>Ödeme</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.length === 0 ? (
                  <tr><td colSpan={5} className="empty-text">Henüz satış yok</td></tr>
                ) : (
                  (stats.recentSales as Array<Record<string, unknown>>).map((s, i) => (
                    <tr key={i}>
                      <td>{(s.sale_no as string) || `#${s.id}`}</td>
                      <td>{(s.customer_name as string) || 'Perakende'}</td>
                      <td className="text-right">{formatCurrency(s.net_amount as number)}</td>
                      <td>{s.payment_status as string}</td>
                      <td>{formatDateTime(s.sale_date as string)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header">Son Kasa Hareketleri</div>
          <div className="data-table-wrap" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>İşlem</th>
                  <th>Müşteri</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCashMovements.length === 0 ? (
                  <tr><td colSpan={4} className="empty-text">Henüz hareket yok</td></tr>
                ) : (
                  stats.recentCashMovements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDateTime(m.movement_date)}</td>
                      <td>{m.movement_type}</td>
                      <td>{m.customer_name || m.sale_no || '-'}</td>
                      <td className={`text-right${m.amount >= 0 ? ' amount-positive' : ' amount-negative'}`}>
                        {formatCurrency(m.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
