import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ipc } from '@/services/ipc';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { DashboardStats } from '@/types/electron';
import { checkMenuPermission } from '@/types/navigation';
import { PERMISSIONS, type Permission } from '@/types/auth';
import { QUICK_ACTION_TONE } from '@/theme/modules';
import PageTitleBar from '@/components/layout/PageTitleBar';
import DashboardStatCard from '@/components/dashboard/DashboardStatCard';
import DashboardSection from '@/components/dashboard/DashboardSection';
import StatusBadge from '@/components/ui/StatusBadge';
import type { AlertLevel, ValueTone } from '@/components/dashboard/DashboardStatCard';

interface QuickAction {
  label: string;
  icon: string;
  path: string;
  permission: Permission | Permission[];
  search?: string;
}

function countAlert(n: number, active: 'warning' | 'critical' | 'pending' = 'warning'): AlertLevel {
  if (n <= 0) return 'neutral';
  return active;
}

function moneyAlert(n: number, invert = false): { alert: AlertLevel; tone: ValueTone } {
  if (n === 0) return { alert: 'neutral', tone: 'muted' };
  if (invert) return { alert: 'critical', tone: 'danger' };
  return { alert: 'warning', tone: 'danger' };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const go = (path: string, search?: string) => {
    navigate(search ? { pathname: path, search } : path);
  };

  const quickActions = useMemo<QuickAction[]>(
    () =>
      [
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

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) return <div className="loading-text">Yükleniyor...</div>;
  if (!stats) return <div className="empty-text">Veri yüklenemedi.</div>;

  const netProfit = stats.todayNetProfit ?? 0;
  const netProfitTone: ValueTone = netProfit > 0 ? 'success' : netProfit < 0 ? 'danger' : 'muted';
  const netProfitAlert: AlertLevel = netProfit < 0 ? 'critical' : netProfit > 0 ? 'success' : 'neutral';

  const showFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
  const showMedula = hasPermission(PERMISSIONS.MEDULA_VIEW);
  const showUts = hasPermission(PERMISSIONS.UTS_VIEW);
  const showEdonusum = hasPermission(PERMISSIONS.EINVOICE_VIEW);
  const showCustomers = hasPermission(PERMISSIONS.CUSTOMERS_VIEW);
  const showCampaign = hasPermission(PERMISSIONS.CAMPAIGN_VIEW);

  return (
    <div className="page-content dashboard-page">
      <PageTitleBar title="Dashboard" module="home">
        <button className="btn" onClick={loadStats} disabled={loading}>
          Yenile
        </button>
      </PageTitleBar>

      {quickActions.length > 0 && (
        <div className="panel" style={{ marginBottom: 4, flexShrink: 0 }}>
          <div className="panel-header">Hızlı İşlemler</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px 10px' }}>
            {quickActions.map((action) => {
              const tone = QUICK_ACTION_TONE[action.path] || 'sales';
              return (
                <button
                  key={`${action.path}${action.search || ''}-${action.label}`}
                  type="button"
                  className={`quick-action-btn tone-${tone}`}
                  onClick={() => go(action.path, action.search)}
                >
                  <span aria-hidden="true">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Günlük özet + günlük işler tek bölümde */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <DashboardSection id="daily" title="Günlük İşler" defaultOpen tone="sales">
          <div className="dashboard-hero-grid" style={{ marginBottom: 8 }}>
            <DashboardStatCard
              icon="⊞"
              label="Bugünkü Satış"
              value={formatCurrency(stats.todaySales)}
              hint="Gün sonu raporu"
              module="sales"
              size="hero"
              onClick={() => go('/raporlar', '?tab=dayEnd')}
            />
            <DashboardStatCard
              icon="₺"
              label="Bugünkü Tahsilat"
              value={formatCurrency(stats.todayCollection)}
              hint="Kasa girişleri"
              module="sales"
              size="hero"
              alert={stats.todayCollection > 0 ? 'success' : 'neutral'}
              valueTone={stats.todayCollection > 0 ? 'success' : 'muted'}
            />
            <DashboardStatCard
              icon="▣"
              label="Toplam Kasa"
              value={formatCurrency(stats.cashTotal)}
              hint="Anlık kasa bakiyesi"
              module="finance"
              size="hero"
              onClick={() => go('/kasa')}
            />
            <DashboardStatCard
              icon="▤"
              label="Kritik Stok"
              value={String(stats.criticalStock)}
              hint={stats.criticalStock > 0 ? 'Acil müdahale' : 'Stok seviyesi uygun'}
              module="stock"
              size="hero"
              alert={countAlert(stats.criticalStock, 'critical')}
              valueTone={stats.criticalStock > 0 ? 'danger' : 'muted'}
              onClick={() => go('/raporlar', '?tab=stock&stockType=critical&critical=1')}
            />
            {showMedula && (
              <DashboardStatCard
                icon="⊕"
                label="Medula Bekleyen"
                value={String(stats.medulaPending)}
                hint={stats.medulaPending > 0 ? 'Hazırlık bekliyor' : 'Bekleyen yok'}
                module="official"
                size="hero"
                alert={countAlert(stats.medulaPending, 'pending')}
                valueTone={stats.medulaPending > 0 ? 'warning' : 'muted'}
                onClick={() => go('/medula', '?tab=tracking')}
              />
            )}
            {showFinance && (
              <DashboardStatCard
                icon="▦"
                label="Bugünkü Net Kâr"
                value={formatCurrency(netProfit)}
                hint="Tahmini günlük sonuç"
                module="finance"
                size="hero"
                alert={netProfitAlert}
                valueTone={netProfitTone}
                onClick={() => go('/kar-zarar')}
              />
            )}
          </div>
          <div className="dashboard-compact-grid">
            <DashboardStatCard
              icon="↩"
              label="Bugünkü İade"
              value={formatCurrency(stats.todayReturns)}
              module="sales"
              alert={stats.todayReturns > 0 ? 'warning' : 'neutral'}
              valueTone={stats.todayReturns > 0 ? 'warning' : 'muted'}
            />
            <DashboardStatCard
              icon="✕"
              label="İptal (Bugün)"
              value={String(stats.cancelledToday)}
              module="sales"
              alert={countAlert(stats.cancelledToday, 'warning')}
              valueTone={stats.cancelledToday > 0 ? 'warning' : 'muted'}
            />
            {!showFinance && (
              <DashboardStatCard
                icon="▦"
                label="Bugünkü Net Kâr"
                value={formatCurrency(netProfit)}
                module="finance"
                alert={netProfitAlert}
                valueTone={netProfitTone}
              />
            )}
          </div>
        </DashboardSection>

        {showFinance && (
          <DashboardSection id="finance" title="Finans Durumu" defaultOpen tone="finance">
            <div className="dashboard-compact-grid">
              <DashboardStatCard
                icon="⊟"
                label="Müşteri Açık Hesap"
                value={formatCurrency(stats.customerOpenTotal ?? stats.openAccountTotal)}
                hint="Toplam alacak"
                module="finance"
                {...moneyAlert(stats.customerOpenTotal ?? stats.openAccountTotal)}
                onClick={() => go('/acik-hesaplar')}
              />
              <DashboardStatCard
                icon="▦"
                label="Banka Bakiyesi"
                value={formatCurrency(stats.bankBalanceTotal ?? 0)}
                module="finance"
                onClick={() => go('/banka-pos')}
              />
              <DashboardStatCard
                icon="⊞"
                label="POS Bekleyen"
                value={formatCurrency(stats.posPendingTotal ?? 0)}
                module="finance"
                alert={(stats.posPendingTotal ?? 0) > 0 ? 'warning' : 'neutral'}
                valueTone={(stats.posPendingTotal ?? 0) > 0 ? 'warning' : 'muted'}
                onClick={() => go('/banka-pos')}
              />
              <DashboardStatCard
                icon="↦"
                label="Bugünkü Gider"
                value={formatCurrency(stats.todayExpense ?? 0)}
                module="finance"
                alert={(stats.todayExpense ?? 0) > 0 ? 'warning' : 'neutral'}
                valueTone={(stats.todayExpense ?? 0) > 0 ? 'danger' : 'muted'}
                onClick={() => go('/giderler')}
              />
              <DashboardStatCard
                icon="⊟"
                label="Tedarikçi Borç Toplamı"
                value={formatCurrency(stats.supplierDebtTotal ?? 0)}
                module="finance"
                {...moneyAlert(stats.supplierDebtTotal ?? 0)}
                onClick={() => go('/tedarikciler', '?tab=account')}
              />
              <DashboardStatCard
                icon="◎"
                label="Bekleyen Alış Ödemesi"
                value={`${stats.pendingPurchaseCount ?? 0} (${formatCurrency(stats.pendingPurchaseTotal ?? 0)})`}
                module="finance"
                alert={countAlert(stats.pendingPurchaseCount ?? 0)}
                valueTone={(stats.pendingPurchaseCount ?? 0) > 0 ? 'warning' : 'muted'}
                onClick={() => go('/tedarikciler', '?tab=purchases')}
              />
              {showCampaign && (
                <>
                  <DashboardStatCard
                    icon="％"
                    label="Aktif Kampanya"
                    value={String(stats.activeCampaignCount ?? 0)}
                    module="sales"
                    onClick={() => go('/kampanyalar')}
                  />
                  <DashboardStatCard
                    icon="％"
                    label="Kampanya İndirimi (Bugün)"
                    value={formatCurrency(stats.todayCampaignDiscount ?? 0)}
                    module="sales"
                    valueTone={(stats.todayCampaignDiscount ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/kampanyalar')}
                  />
                </>
              )}
            </div>
          </DashboardSection>
        )}

        <DashboardSection id="stock" title="Stok / Ürün Uyarıları" defaultOpen tone="stock">
          <div className="dashboard-compact-grid">
            <DashboardStatCard
              icon="◎"
              label="Eksik ÜTS Bilgisi"
              value={String(stats.utsIncomplete)}
              hint="Ürün kartı eksikleri"
              module="stock"
              alert={countAlert(stats.utsIncomplete, 'critical')}
              valueTone={stats.utsIncomplete > 0 ? 'danger' : 'muted'}
            />
          </div>
        </DashboardSection>

        {(showMedula || showUts || showEdonusum) && (
          <DashboardSection id="official" title="Resmi İşlem Uyarıları" defaultOpen={false} tone="official">
            <div className="dashboard-compact-grid">
              {showMedula && (
                <>
                  <DashboardStatCard
                    icon="!"
                    label="Eksik Medula Bilgisi"
                    value={String(stats.medulaMissingInfo ?? 0)}
                    module="official"
                    alert={countAlert(stats.medulaMissingInfo ?? 0, 'critical')}
                    valueTone={(stats.medulaMissingInfo ?? 0) > 0 ? 'danger' : 'muted'}
                    onClick={() => go('/medula', '?tab=sgk')}
                  />
                  <DashboardStatCard
                    icon="⊕"
                    label="SGK Faturaya Hazır"
                    value={String(stats.sgkInvoiceReady ?? 0)}
                    module="official"
                    alert={countAlert(stats.sgkInvoiceReady ?? 0, 'pending')}
                    valueTone={(stats.sgkInvoiceReady ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/medula', '?tab=sgkInvoice')}
                  />
                  <DashboardStatCard
                    icon="▦"
                    label="Kurum Alacağı"
                    value={formatCurrency(stats.institutionReceivableTotal ?? 0)}
                    module="official"
                    {...moneyAlert(stats.institutionReceivableTotal ?? 0)}
                    onClick={() => go('/medula', '?tab=receivable')}
                  />
                  <DashboardStatCard
                    icon="▦"
                    label="TİTUBB Bekleyen"
                    value={String(stats.titubbPending ?? stats.utsTitubbPending ?? 0)}
                    module="official"
                    alert={countAlert(stats.titubbPending ?? stats.utsTitubbPending ?? 0, 'pending')}
                    valueTone={(stats.titubbPending ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/medula', '?tab=titubb')}
                  />
                </>
              )}
              {showUts && (
                <>
                  <DashboardStatCard
                    icon="↓"
                    label="ÜTS Alma Bekleyen"
                    value={String(stats.utsPendingReceive ?? 0)}
                    module="official"
                    alert={countAlert(stats.utsPendingReceive ?? 0, 'pending')}
                    valueTone={(stats.utsPendingReceive ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/medula', '?tab=receive')}
                  />
                  <DashboardStatCard
                    icon="↑"
                    label="ÜTS Verme Bekleyen"
                    value={String(stats.utsPendingGive ?? 0)}
                    module="official"
                    alert={countAlert(stats.utsPendingGive ?? 0, 'pending')}
                    valueTone={(stats.utsPendingGive ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/medula', '?tab=give')}
                  />
                  <DashboardStatCard
                    icon="✕"
                    label="ÜTS Hatalı Kayıt"
                    value={String(stats.utsErrorCount ?? 0)}
                    module="official"
                    alert={countAlert(stats.utsErrorCount ?? 0, 'critical')}
                    valueTone={(stats.utsErrorCount ?? 0) > 0 ? 'danger' : 'muted'}
                    onClick={() => go('/medula', '?tab=history')}
                  />
                </>
              )}
              {showEdonusum && (
                <>
                  <DashboardStatCard
                    icon="▦"
                    label="Fatura Taslağı"
                    value={String(stats.invoiceDraftCount ?? 0)}
                    module="official"
                    alert={(stats.invoiceDraftCount ?? 0) > 0 ? 'pending' : 'neutral'}
                    onClick={() => go('/e-donusum', '?tab=drafts')}
                  />
                  <DashboardStatCard
                    icon="↗"
                    label="Dışa Aktarılacak Belge"
                    value={String(stats.invoiceExportPending ?? 0)}
                    module="official"
                    alert={countAlert(stats.invoiceExportPending ?? 0, 'pending')}
                    valueTone={(stats.invoiceExportPending ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/e-donusum', '?tab=drafts')}
                  />
                  <DashboardStatCard
                    icon="!"
                    label="Eksik Bilgili Fatura"
                    value={String(stats.invoiceMissingInfo ?? 0)}
                    module="official"
                    alert={countAlert(stats.invoiceMissingInfo ?? 0, 'critical')}
                    valueTone={(stats.invoiceMissingInfo ?? 0) > 0 ? 'danger' : 'muted'}
                    onClick={() => go('/e-donusum', '?tab=drafts')}
                  />
                  <DashboardStatCard
                    icon="⊕"
                    label="SGK Fatura Hazır"
                    value={String(stats.sgkInvoiceReadyForEdonusum ?? 0)}
                    module="official"
                    alert={countAlert(stats.sgkInvoiceReadyForEdonusum ?? 0, 'pending')}
                    valueTone={(stats.sgkInvoiceReadyForEdonusum ?? 0) > 0 ? 'warning' : 'muted'}
                    onClick={() => go('/e-donusum', '?tab=sgk')}
                  />
                </>
              )}
            </div>
          </DashboardSection>
        )}

        {showCustomers && (
          <DashboardSection id="customer" title="Müşteri Hatırlatmaları" defaultOpen={false} tone="sales">
            <div className="dashboard-compact-grid">
              {hasPermission(PERMISSIONS.APPOINTMENTS_VIEW) && (
                <DashboardStatCard
                  icon="◷"
                  label="Bugünkü Randevu"
                  value={String(stats.todayAppointments ?? 0)}
                  module="sales"
                  alert={countAlert(stats.todayAppointments ?? 0, 'warning')}
                  valueTone={(stats.todayAppointments ?? 0) > 0 ? 'warning' : 'muted'}
                  onClick={() => go('/randevular')}
                />
              )}
              <DashboardStatCard
                icon="◎"
                label="Yaklaşan Kontrol"
                value={String(stats.upcomingControls ?? 0)}
                module="sales"
                alert={countAlert(stats.upcomingControls ?? 0, 'warning')}
                valueTone={(stats.upcomingControls ?? 0) > 0 ? 'warning' : 'muted'}
                onClick={() => go('/musteri')}
              />
              <DashboardStatCard
                icon="⊟"
                label="Borçlu Müşteri"
                value={String(stats.debtorsCount ?? 0)}
                module="sales"
                alert={countAlert(stats.debtorsCount ?? 0, 'critical')}
                valueTone={(stats.debtorsCount ?? 0) > 0 ? 'danger' : 'muted'}
                onClick={() => go('/musteri')}
              />
              <DashboardStatCard
                icon="◎"
                label="Lens Yenileme Yaklaşan"
                value={String(stats.lensRenewalSoon ?? 0)}
                module="sales"
                alert={countAlert(stats.lensRenewalSoon ?? 0, 'warning')}
                valueTone={(stats.lensRenewalSoon ?? 0) > 0 ? 'warning' : 'muted'}
                onClick={() => go('/musteri')}
              />
            </div>
          </DashboardSection>
        )}

        <div className="dashboard-tables" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, minHeight: 200 }}>
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
                    <tr>
                      <td colSpan={5} className="empty-text">
                        Henüz satış yok
                      </td>
                    </tr>
                  ) : (
                    (stats.recentSales as Array<Record<string, unknown>>).map((s, i) => (
                      <tr key={i}>
                        <td>{(s.sale_no as string) || `#${s.id}`}</td>
                        <td>{(s.customer_name as string) || 'Perakende'}</td>
                        <td className="text-right">{formatCurrency(s.net_amount as number)}</td>
                        <td>
                          <StatusBadge status={s.payment_status as string} />
                        </td>
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
                    <tr>
                      <td colSpan={4} className="empty-text">
                        Henüz hareket yok
                      </td>
                    </tr>
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
    </div>
  );
}
