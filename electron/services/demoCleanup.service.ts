import type Database from 'better-sqlite3';
import { logInfo } from './logger.service';

export class DemoCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoCleanupError';
  }
}

export interface DemoCleanupResult {
  products: number;
  customers: number;
  prescriptions: number;
  stockMovements: number;
  message: string;
}

export class DemoCleanupService {
  constructor(private db: Database.Database) {}

  clearDemoData(): DemoCleanupResult {
    const productInSales = (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM sale_items si
           INNER JOIN products p ON p.id = si.product_id
           WHERE p.is_demo = 1`
        )
        .get() as { c: number }
    ).c;

    if (productInSales > 0) {
      throw new DemoCleanupError(
        'Demo ürünlerden yapılmış satış kayıtları var. Güvenlik için demo veriler temizlenemedi.'
      );
    }

    const customerInSales = (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM sales s
           INNER JOIN customers c ON c.id = s.customer_id
           WHERE c.is_demo = 1`
        )
        .get() as { c: number }
    ).c;

    if (customerInSales > 0) {
      throw new DemoCleanupError(
        'Demo müşterilere ait satış kayıtları var. Güvenlik için demo veriler temizlenemedi.'
      );
    }

    const prescriptionInSales = (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM sales s
           INNER JOIN prescriptions pr ON pr.id = s.prescription_id
           WHERE pr.is_demo = 1`
        )
        .get() as { c: number }
    ).c;

    if (prescriptionInSales > 0) {
      throw new DemoCleanupError(
        'Demo reçetelere bağlı satış kayıtları var. Güvenlik için demo veriler temizlenemedi.'
      );
    }

    const run = this.db.transaction(() => {
      const stockDel = this.db
        .prepare(`DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE is_demo = 1)`)
        .run();
      const prescDel = this.db.prepare(`DELETE FROM prescriptions WHERE is_demo = 1`).run();
      const prodDel = this.db.prepare(`DELETE FROM products WHERE is_demo = 1`).run();
      const custDel = this.db.prepare(`DELETE FROM customers WHERE is_demo = 1`).run();

      return {
        products: prodDel.changes,
        customers: custDel.changes,
        prescriptions: prescDel.changes,
        stockMovements: stockDel.changes,
      };
    });

    const counts = run();
    const message = `${counts.products} ürün, ${counts.customers} müşteri, ${counts.prescriptions} reçete ve ${counts.stockMovements} stok hareketi silindi.`;
    logInfo('Bakım', 'Demo veriler temizlendi', counts);
    return { ...counts, message };
  }
}
