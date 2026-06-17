import type { IpcMain } from 'electron';
import type Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { BankService } from '../services/bank.service';
import { PosService } from '../services/pos.service';
import { ProfitLossService } from '../services/profitLoss.service';
import { AppointmentService } from '../services/appointment.service';
import { CustomerService } from '../services/customer.service';
import { UtsTrackingService } from '../services/utsTracking.service';
import { TitubbExportService } from '../services/titubbExport.service';
import { requirePermission } from './authGuard';
import { PERMISSIONS } from '../types/permission';
import { handleIpcError } from './ipcHelpers';
import { success, failure } from './utils';

function db(): Database.Database {
  const database = getDatabase();
  if (!database) throw new Error('Veritabanı başlatılamadı');
  return database;
}

export function registerDashboardHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('dashboard:getStats', () => {
    try {
      requirePermission(PERMISSIONS.DASHBOARD_VIEW);
      const todaySales = db()
        .prepare(
          `SELECT COALESCE(SUM(net_amount), 0) as total FROM sales
           WHERE date(sale_date) = date('now', 'localtime') AND status != 'İptal edildi'`
        )
        .get() as { total: number };

      const todayCollection = db()
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
           WHERE date(movement_date) = date('now', 'localtime') AND amount > 0`
        )
        .get() as { total: number };

      const openAccountTotal = db()
        .prepare(
          `SELECT COALESCE(SUM(remaining_amount), 0) as total FROM sales
           WHERE remaining_amount > 0 AND status != 'İptal edildi'`
        )
        .get() as { total: number };

      const cashTotal = db()
        .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements`)
        .get() as { total: number };

      const criticalStock = db()
        .prepare(
          `SELECT COUNT(*) as count FROM products
           WHERE stock_quantity <= min_stock AND status = 'Aktif'`
        )
        .get() as { count: number };

      const activePrescriptions = db()
        .prepare(
          `SELECT COUNT(*) as count FROM prescriptions
           WHERE status = 'Aktif' AND (is_active = 1 OR is_active IS NULL)`
        )
        .get() as { count: number };

      const recentSales = db()
        .prepare(
          `SELECT s.*, c.full_name as customer_name
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           ORDER BY s.sale_date DESC LIMIT 5`
        )
        .all();

      const recentCashMovements = db()
        .prepare(
          `SELECT cm.*, c.full_name as customer_name, s.sale_no
           FROM cash_movements cm
           LEFT JOIN customers c ON c.id = cm.customer_id
           LEFT JOIN sales s ON s.id = cm.sale_id
           ORDER BY cm.movement_date DESC LIMIT 5`
        )
        .all();

      const cancelledToday = db()
        .prepare(
          `SELECT COUNT(*) as count FROM sales
           WHERE date(cancelled_at) = date('now', 'localtime') AND status = 'İptal edildi'`
        )
        .get() as { count: number };

      const todayReturns = db()
        .prepare(
          `SELECT COALESCE(SUM(total_amount), 0) as total FROM returns
           WHERE date(created_at) = date('now', 'localtime') AND status = 'Tamamlandı'`
        )
        .get() as { total: number };

      const medulaPending = db()
        .prepare(
          `SELECT COUNT(DISTINCT s.id) as count FROM sales s
           INNER JOIN prescriptions pr ON pr.id = s.prescription_id
           WHERE s.status != 'İptal edildi'
           AND pr.medula_status IN ('Hazırlanmadı', 'Hazır')`
        )
        .get() as { count: number };

      const utsIncomplete = new UtsTrackingService(db()).countIncompleteProducts();
      const titubbPending = new TitubbExportService(db()).countPending();

      const pendingPurchasePayments = db()
        .prepare(
          `SELECT COUNT(*) as count, COALESCE(SUM(remaining_amount), 0) as total
           FROM purchase_documents WHERE status = 'Aktif' AND payment_status IN ('Ödeme bekliyor', 'Kısmi ödendi')`
        )
        .get() as { count: number; total: number };

      const supplierDebtTotal = db()
        .prepare(`SELECT COALESCE(SUM(balance), 0) as total FROM suppliers WHERE is_active = 1 AND balance > 0`)
        .get() as { total: number };

      const bankBalanceTotal = new BankService(db()).getTotalBalance();
      const posPendingTotal = new PosService(db()).getPendingTotal();

      const todayExpense = db()
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
           WHERE date(expense_date) = date('now', 'localtime') AND status = 'Aktif'`
        )
        .get() as { total: number };

      const customerOpenTotal = db()
        .prepare(
          `SELECT COALESCE(SUM(balance), 0) as total FROM customers WHERE is_active = 1 AND balance > 0`
        )
        .get() as { total: number };

      const today = new Date().toISOString().slice(0, 10);
      const todayProfitLoss = new ProfitLossService(db()).getSummary({
        date_from: today,
        date_to: today,
      });

      const activeCampaignCount = db()
        .prepare(
          `SELECT COUNT(*) as count FROM campaigns
           WHERE status = 'Aktif' AND date(start_date) <= date('now', 'localtime') AND date(end_date) >= date('now', 'localtime')`
        )
        .get() as { count: number };

      const todayCampaignDiscount = db()
        .prepare(
          `SELECT COALESCE(SUM(campaign_discount_amount), 0) as total FROM sales
           WHERE date(sale_date) = date('now', 'localtime') AND status != 'İptal edildi'`
        )
        .get() as { total: number };

      const appointmentService = new AppointmentService(db());
      const customerService = new CustomerService(db());
      const todayAppointments = appointmentService.countToday();
      const upcomingControls = appointmentService.countUpcomingControls();
      const debtorsCount = customerService.countDebtors();
      const lensRenewalSoon = appointmentService.countLensRenewalSoon();

      return success({
        todaySales: todaySales.total,
        todayCollection: todayCollection.total,
        openAccountTotal: openAccountTotal.total,
        cashTotal: cashTotal.total,
        bankBalanceTotal,
        posPendingTotal,
        todayExpense: todayExpense.total,
        customerOpenTotal: customerOpenTotal.total,
        todayNetProfit: todayProfitLoss.netProfit as number,
        activeCampaignCount: activeCampaignCount.count,
        todayCampaignDiscount: todayCampaignDiscount.total,
        todayAppointments,
        upcomingControls,
        debtorsCount,
        lensRenewalSoon,
        criticalStock: criticalStock.count,
        activePrescriptions: activePrescriptions.count,
        todayReturns: todayReturns.total,
        cancelledToday: cancelledToday.count,
        medulaPending: medulaPending.count,
        utsIncomplete,
        titubbPending,
        pendingPurchaseCount: pendingPurchasePayments.count,
        pendingPurchaseTotal: pendingPurchasePayments.total,
        supplierDebtTotal: supplierDebtTotal.total,
        recentSales,
        recentCashMovements,
      });
    } catch (err) {
      const auth = handleIpcError(err);
      if (auth) return auth;
      return failure((err as Error).message);
    }
  });
}
