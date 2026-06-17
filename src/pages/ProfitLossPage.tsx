import { useCallback, useEffect, useState } from 'react';
import { ipc } from '@/services/ipc';
import { formatCurrency } from '@/utils/format';
import { openPrintPreview } from '@/utils/print';
import type { ProfitLossFilter } from '@/types/finance';
import PageTitleBar from '@/components/layout/PageTitleBar';

const today = new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ProfitLossPage() {
  const [filter, setFilter] = useState<ProfitLossFilter>({
    date_from: monthAgo(),
    date_to: today,
    period: 'custom',
  });
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const applyPeriod = (period: ProfitLossFilter['period']) => {
    const to = new Date();
    const from = new Date();
    if (period === 'daily') {
      // same day
    } else if (period === 'weekly') {
      from.setDate(from.getDate() - 7);
    } else if (period === 'monthly') {
      from.setMonth(from.getMonth() - 1);
    }
    setFilter({
      ...filter,
      period,
      date_from: from.toISOString().slice(0, 10),
      date_to: to.toISOString().slice(0, 10),
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        ipc.profitLoss.getSummary(filter),
        ipc.profitLoss.getDetail(filter),
      ]);
      setSummary(s);
      setDetail(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = async () => {
    if (!detail?.daily) return;
    const rows = (detail.daily as Record<string, unknown>[]).map((r) => ({
      movement_date: String(r.period),
      movement_type: 'Satış',
      document_no: String(r.sale_count),
      description: 'Günlük satış',
      debit: 0,
      credit: Number(r.sales_total),
      balance: Number(r.sales_total),
    }));
    const html = await ipc.profitLoss.print({
      title: 'Kâr-Zarar Raporu',
      subtitle: `${filter.date_from} — ${filter.date_to}`,
      rows,
    });
    openPrintPreview({ html, title: 'Kâr-Zarar' });
  };

  const handleExport = async () => {
    if (!detail?.byGroup) return;
    await ipc.profitLoss.exportExcel({
      fileName: `kar-zarar-${filter.date_to}.xlsx`,
      rows: detail.byGroup as Record<string, unknown>[],
    });
  };

  return (
    <div className="page-content">
      <PageTitleBar title="Kâr-Zarar">
        <button type="button" className="btn" onClick={load} disabled={loading}>Yenile</button>
      </PageTitleBar>

      <div className="toolbar" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <button type="button" className={`btn btn-sm ${filter.period === 'daily' ? 'btn-primary' : ''}`} onClick={() => applyPeriod('daily')}>Günlük</button>
        <button type="button" className={`btn btn-sm ${filter.period === 'weekly' ? 'btn-primary' : ''}`} onClick={() => applyPeriod('weekly')}>Haftalık</button>
        <button type="button" className={`btn btn-sm ${filter.period === 'monthly' ? 'btn-primary' : ''}`} onClick={() => applyPeriod('monthly')}>Aylık</button>
        <input type="date" className="form-input" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value, period: 'custom' })} />
        <input type="date" className="form-input" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value, period: 'custom' })} />
        <button type="button" className="btn btn-primary btn-sm" onClick={load}>Uygula</button>
        <button type="button" className="btn btn-sm" onClick={handleExport}>Excel</button>
        <button type="button" className="btn btn-sm" onClick={handlePrint}>Yazdır</button>
      </div>

      {summary?.costWarning && (
        <div className="alert alert-warning" style={{ marginBottom: 8 }}>{String(summary.costWarning)}</div>
      )}

      {loading || !summary ? (
        <div className="loading-text">Yükleniyor...</div>
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 8 }}>
            <div className="stat-box"><div className="stat-label">Toplam Satış</div><div className="stat-value">{formatCurrency(Number(summary.totalSales))}</div></div>
            <div className="stat-box"><div className="stat-label">Maliyet</div><div className="stat-value">{formatCurrency(Number(summary.costOfGoods))}</div></div>
            <div className="stat-box"><div className="stat-label">Brüt Kâr</div><div className="stat-value amount-positive">{formatCurrency(Number(summary.grossProfit))}</div></div>
            <div className="stat-box"><div className="stat-label">Giderler</div><div className="stat-value amount-negative">{formatCurrency(Number(summary.expenseTotal))}</div></div>
            <div className="stat-box"><div className="stat-label">Kampanya İndirimi</div><div className="stat-value amount-negative">{formatCurrency(Number(summary.campaignDiscountTotal || 0))}</div></div>
            <div className="stat-box"><div className="stat-label">Manuel İndirim</div><div className="stat-value amount-negative">{formatCurrency(Number(summary.manualDiscountTotal || 0))}</div></div>
            <div className="stat-box"><div className="stat-label">İade</div><div className="stat-value amount-negative">{formatCurrency(Number(summary.returnTotal))}</div></div>
            <div className="stat-box"><div className="stat-label">Net Kâr</div><div className={`stat-value ${Number(summary.netProfit) >= 0 ? 'amount-positive' : 'amount-negative'}`}>{formatCurrency(Number(summary.netProfit))}</div></div>
            <div className="stat-box"><div className="stat-label">Kâr Oranı</div><div className="stat-value">%{Number(summary.profitRate).toFixed(1)}</div></div>
            <div className="stat-box"><div className="stat-label">Açık Hesap</div><div className="stat-value">{formatCurrency(Number(summary.openAccountTotal))}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="panel">
              <div className="panel-header">Ürün Grubu Bazlı</div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Grup</th><th className="text-right">Satış</th><th className="text-right">Kâr</th></tr></thead>
                  <tbody>
                    {((detail?.byGroup as Record<string, unknown>[]) || []).map((r, i) => (
                      <tr key={i}>
                        <td>{String(r.group_name)}</td>
                        <td className="text-right">{formatCurrency(Number(r.sales_total))}</td>
                        <td className="text-right amount-positive">{formatCurrency(Number(r.profit))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">En Çok Kâr Bırakan Ürünler</div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Ürün</th><th className="text-right">Satış</th><th className="text-right">Kâr</th></tr></thead>
                  <tbody>
                    {((detail?.topProducts as Record<string, unknown>[]) || []).slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td>{String(r.product_name)}</td>
                        <td className="text-right">{formatCurrency(Number(r.sales_total))}</td>
                        <td className="text-right amount-positive">{formatCurrency(Number(r.sales_total) - Number(r.cost_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {((detail?.lossProducts as Record<string, unknown>[]) || []).length > 0 && (
            <div className="panel" style={{ marginTop: 8 }}>
              <div className="panel-header">Zarar Edilen Ürünler</div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Ürün</th><th className="text-right">Satış</th><th className="text-right">Maliyet</th><th className="text-right">Zarar</th></tr></thead>
                  <tbody>
                    {(detail?.lossProducts as Record<string, unknown>[]).map((r, i) => (
                      <tr key={i}>
                        <td>{String(r.product_name)}</td>
                        <td className="text-right">{formatCurrency(Number(r.sales_total))}</td>
                        <td className="text-right">{formatCurrency(Number(r.cost_total))}</td>
                        <td className="text-right amount-negative">{formatCurrency(Number(r.sales_total) - Number(r.cost_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
