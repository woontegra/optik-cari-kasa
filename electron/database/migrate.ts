import type Database from 'better-sqlite3';
import {
  DEMO_COMPANY_TAX_NUMBER,
  DEMO_CUSTOMER_TC_NOS,
  DEMO_PRODUCT_BARCODES,
} from '../constants/demoSeed';

function backfillDemoFlags(db: Database.Database): void {
  const barcodePlaceholders = DEMO_PRODUCT_BARCODES.map(() => '?').join(',');
  db.prepare(
    `UPDATE products SET is_demo = 1 WHERE id IN (
      SELECT product_id FROM product_barcodes WHERE barcode IN (${barcodePlaceholders})
    )`
  ).run(...DEMO_PRODUCT_BARCODES);

  const tcPlaceholders = DEMO_CUSTOMER_TC_NOS.map(() => '?').join(',');
  db.prepare(`UPDATE customers SET is_demo = 1 WHERE tc_no IN (${tcPlaceholders})`).run(...DEMO_CUSTOMER_TC_NOS);

  db.prepare(`UPDATE companies SET is_demo = 1 WHERE tax_number = ?`).run(DEMO_COMPANY_TAX_NUMBER);

  db.prepare(
    `UPDATE prescriptions SET is_demo = 1 WHERE customer_id IN (SELECT id FROM customers WHERE is_demo = 1)`
  ).run();
}

function ensureDemoPrescriptions(db: Database.Database): void {
  const ahmet = db
    .prepare(`SELECT id FROM customers WHERE tc_no = ? LIMIT 1`)
    .get(DEMO_CUSTOMER_TC_NOS[0]) as { id: number } | undefined;
  const ayse = db
    .prepare(`SELECT id FROM customers WHERE tc_no = ? LIMIT 1`)
    .get(DEMO_CUSTOMER_TC_NOS[1]) as { id: number } | undefined;

  const insert = db.prepare(`
    INSERT INTO prescriptions (
      customer_id, prescription_no, prescription_date, doctor, institution,
      right_sph, right_cyl, right_ax, left_sph, left_cyl, left_ax,
      add_value, pd, status, is_active, is_demo, lens_type, usage_type, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', 1, 1, ?, ?, ?)
  `);

  const today = new Date().toISOString().slice(0, 10);

  if (ahmet) {
    const exists = db
      .prepare(`SELECT id FROM prescriptions WHERE customer_id = ? AND is_demo = 1 LIMIT 1`)
      .get(ahmet.id);
    if (!exists) {
      insert.run(
        ahmet.id,
        'RCT-00001',
        today,
        'Dr. Mehmet Kaya',
        'SGK',
        '-1.50',
        '-0.75',
        '90',
        '-1.25',
        '-0.50',
        '85',
        '',
        '62',
        'Monofokal',
        'Uzak',
        'Örnek gözlük reçetesi — Ahmet Yılmaz'
      );
    }
  }

  if (ayse) {
    const exists = db
      .prepare(`SELECT id FROM prescriptions WHERE customer_id = ? AND is_demo = 1 LIMIT 1`)
      .get(ayse.id);
    if (!exists) {
      insert.run(
        ayse.id,
        'RCT-00002',
        today,
        'Dr. Ayşe Öztürk',
        'Özel',
        '-2.00',
        '',
        '',
        '-1.75',
        '-0.25',
        '180',
        '+2.00',
        '60',
        'Progresif',
        'Uzak-Yakın',
        'Örnek progresif reçete — Ayşe Demir'
      );
    }
  }
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(db: Database.Database, table: string, name: string, ddl: string): void {
  if (!columnExists(db, table, name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}

const PRODUCT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'stock_code', ddl: 'TEXT' },
  { name: 'category', ddl: 'TEXT' },
  { name: 'vat_rate', ddl: 'REAL DEFAULT 18' },
  { name: 'description', ddl: 'TEXT' },
  { name: 'extra_fields', ddl: 'TEXT' },
  { name: 'ubb_code', ddl: 'TEXT' },
  { name: 'uts_product_no', ddl: 'TEXT' },
  { name: 'uts_barcode', ddl: 'TEXT' },
  { name: 'serial_no', ddl: 'TEXT' },
  { name: 'lot_no', ddl: 'TEXT' },
  { name: 'uts_expiry_date', ddl: 'TEXT' },
  { name: 'medical_device_class', ddl: 'TEXT' },
  { name: 'uts_tracking_required', ddl: 'INTEGER DEFAULT 0' },
  { name: 'uts_status', ddl: "TEXT DEFAULT 'Bekliyor'" },
  { name: 'uts_note', ddl: 'TEXT' },
];

const CUSTOMER_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'birth_date', ddl: 'TEXT' },
  { name: 'city', ddl: 'TEXT' },
  { name: 'district', ddl: 'TEXT' },
  { name: 'kvkk_consent', ddl: 'INTEGER DEFAULT 0' },
  { name: 'sms_permission', ddl: 'INTEGER DEFAULT 0' },
  { name: 'email_permission', ddl: 'INTEGER DEFAULT 0' },
  { name: 'is_active', ddl: 'INTEGER DEFAULT 1' },
];

const CUSTOMER_V2_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'customer_category', ddl: 'TEXT' },
  { name: 'photo_path', ddl: 'TEXT' },
  { name: 'second_phone', ddl: 'TEXT' },
  { name: 'whatsapp_phone', ddl: 'TEXT' },
  { name: 'institution_name', ddl: 'TEXT' },
  { name: 'institution_no', ddl: 'TEXT' },
  { name: 'occupation', ddl: 'TEXT' },
  { name: 'reference_source', ddl: 'TEXT' },
  { name: 'referred_by_customer_id', ddl: 'INTEGER REFERENCES customers(id)' },
  { name: 'last_visit_date', ddl: 'TEXT' },
  { name: 'next_control_date', ddl: 'TEXT' },
  { name: 'whatsapp_permission', ddl: 'INTEGER DEFAULT 0' },
  { name: 'marketing_permission', ddl: 'INTEGER DEFAULT 0' },
  { name: 'important_note', ddl: 'TEXT' },
  { name: 'risk_note', ddl: 'TEXT' },
  { name: 'is_vip', ddl: 'INTEGER DEFAULT 0' },
];

const PRESCRIPTION_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'lens_type', ddl: 'TEXT' },
  { name: 'usage_type', ddl: 'TEXT' },
  { name: 'is_active', ddl: 'INTEGER DEFAULT 1' },
  { name: 'prescription_type', ddl: "TEXT DEFAULT 'Özel'" },
  { name: 'e_report_no', ddl: 'TEXT' },
  { name: 'provision_no', ddl: 'TEXT' },
  { name: 'sgk_tracking_no', ddl: 'TEXT' },
  { name: 'institution_code', ddl: 'TEXT' },
  { name: 'doctor_registration_no', ddl: 'TEXT' },
  { name: 'patient_tc', ddl: 'TEXT' },
  { name: 'beneficiary_note', ddl: 'TEXT' },
  { name: 'medula_status', ddl: "TEXT DEFAULT 'Hazırlanmadı'" },
  { name: 'medula_note', ddl: 'TEXT' },
];

const SALES_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'prescription_id', ddl: 'INTEGER REFERENCES prescriptions(id)' },
  { name: 'paid_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'remaining_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'status', ddl: "TEXT DEFAULT 'Tamamlandı'" },
  { name: 'updated_at', ddl: 'TEXT' },
  { name: 'cancel_reason', ddl: 'TEXT' },
  { name: 'cancel_note', ddl: 'TEXT' },
  { name: 'cancelled_at', ddl: 'TEXT' },
  { name: 'delivery_date', ddl: 'TEXT' },
];

const SALE_ITEM_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'returned_quantity', ddl: 'INTEGER DEFAULT 0' },
  { name: 'line_note', ddl: 'TEXT' },
  { name: 'discount_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'campaign_id', ddl: 'INTEGER REFERENCES campaigns(id)' },
  { name: 'original_unit_price', ddl: 'REAL' },
  { name: 'final_unit_price', ddl: 'REAL' },
];

const SALES_DISCOUNT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'total_discount_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'manual_discount_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'campaign_discount_amount', ddl: 'REAL DEFAULT 0' },
  { name: 'manual_discount_note', ddl: 'TEXT' },
];

const PAYMENT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'description', ddl: 'TEXT' },
];

const CASH_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'customer_id', ddl: 'INTEGER REFERENCES customers(id)' },
  { name: 'sale_id', ddl: 'INTEGER REFERENCES sales(id)' },
  { name: 'category', ddl: 'TEXT' },
];

const USER_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'phone', ddl: 'TEXT' },
  { name: 'email', ddl: 'TEXT' },
  { name: 'permissions', ddl: 'TEXT' },
  { name: 'must_change_password', ddl: 'INTEGER DEFAULT 0' },
  { name: 'last_login_at', ddl: 'TEXT' },
];

const COMPANY_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'authorized_person', ddl: 'TEXT' },
  { name: 'city', ddl: 'TEXT' },
  { name: 'district', ddl: 'TEXT' },
  { name: 'receipt_footer_note', ddl: 'TEXT' },
  { name: 'support_phone', ddl: 'TEXT' },
  { name: 'support_email', ddl: 'TEXT' },
];

const AUDIT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'module', ddl: 'TEXT' },
  { name: 'description', ddl: 'TEXT' },
  { name: 'old_value', ddl: 'TEXT' },
  { name: 'new_value', ddl: 'TEXT' },
];

const DEMO_FLAG_COLUMN = { name: 'is_demo', ddl: 'INTEGER DEFAULT 0' };

const SUPPLIER_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'authorized_person', ddl: 'TEXT' },
  { name: 'tax_office', ddl: 'TEXT' },
  { name: 'city', ddl: 'TEXT' },
  { name: 'district', ddl: 'TEXT' },
  { name: 'balance', ddl: 'REAL DEFAULT 0' },
];

const OPTICAL_PRODUCT_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'group_id', ddl: 'INTEGER' },
  { name: 'subgroup_id', ddl: 'INTEGER' },
  { name: 'brand_id', ddl: 'INTEGER' },
  { name: 'model_id', ddl: 'INTEGER' },
  { name: 'color_id', ddl: 'INTEGER' },
  { name: 'frame_type_id', ddl: 'INTEGER' },
  { name: 'frame_material_id', ddl: 'INTEGER' },
  { name: 'lens_type_id', ddl: 'INTEGER' },
  { name: 'lens_material_id', ddl: 'INTEGER' },
  { name: 'lens_coating_id', ddl: 'INTEGER' },
  { name: 'contact_lens_type_id', ddl: 'INTEGER' },
  { name: 'gender', ddl: 'TEXT' },
  { name: 'age_group', ddl: 'TEXT' },
  { name: 'frame_color', ddl: 'TEXT' },
  { name: 'lens_color', ddl: 'TEXT' },
  { name: 'frame_shape', ddl: 'TEXT' },
  { name: 'eye_size', ddl: 'TEXT' },
  { name: 'bridge_size', ddl: 'TEXT' },
  { name: 'temple_length', ddl: 'TEXT' },
  { name: 'sph', ddl: 'TEXT' },
  { name: 'cyl', ddl: 'TEXT' },
  { name: 'axis', ddl: 'TEXT' },
  { name: 'addition', ddl: 'TEXT' },
  { name: 'diameter', ddl: 'TEXT' },
  { name: 'base_curve', ddl: 'TEXT' },
  { name: 'lens_index', ddl: 'TEXT' },
  { name: 'usage_period', ddl: 'TEXT' },
  { name: 'package_quantity', ddl: 'TEXT' },
  { name: 'season', ddl: 'TEXT' },
  { name: 'collection_name', ddl: 'TEXT' },
  { name: 'accessory_type', ddl: 'TEXT' },
  { name: 'material', ddl: 'TEXT' },
  { name: 'compatible_product', ddl: 'TEXT' },
  { name: 'label_name', ddl: 'TEXT' },
  { name: 'last_purchase_price', ddl: 'REAL' },
  { name: 'average_cost', ddl: 'REAL' },
  { name: 'is_polarized', ddl: 'INTEGER DEFAULT 0' },
  { name: 'has_uv_protection', ddl: 'INTEGER DEFAULT 0' },
  { name: 'has_blue_light_filter', ddl: 'INTEGER DEFAULT 0' },
  { name: 'is_photochromic', ddl: 'INTEGER DEFAULT 0' },
  { name: 'is_progressive', ddl: 'INTEGER DEFAULT 0' },
];

const LICENSE_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'customer_name', ddl: 'TEXT' },
  { name: 'customer_email', ddl: 'TEXT' },
  { name: 'product_code', ddl: 'TEXT' },
  { name: 'product_name', ddl: 'TEXT' },
  { name: 'license_type', ddl: 'TEXT' },
  { name: 'device_hash', ddl: 'TEXT' },
  { name: 'device_name', ddl: 'TEXT' },
  { name: 'last_online_check_at', ddl: 'TEXT' },
  { name: 'offline_grace_days', ddl: 'INTEGER DEFAULT 15' },
  { name: 'status', ddl: "TEXT DEFAULT 'Pasif'" },
  { name: 'plan_name', ddl: 'TEXT' },
  { name: 'max_devices', ddl: 'INTEGER DEFAULT 1' },
  { name: 'features', ddl: 'TEXT' },
  { name: 'raw_response', ddl: 'TEXT' },
];

function seedOpticalLookups(db: Database.Database): void {
  const count = db.prepare(`SELECT COUNT(*) as c FROM optical_lookup_values`).get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(
    `INSERT INTO optical_lookup_values (type, parent_id, name, code, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  );

  const groups: Array<[string, string]> = [
    ['Çerçeve', 'FRAME'],
    ['Güneş Gözlüğü', 'SUNGLASSES'],
    ['Optik Cam', 'OPTIC_GLASS'],
    ['Kontakt Lens', 'CONTACT_LENS'],
    ['Lens Solüsyonu', 'LENS_SOLUTION'],
    ['Aksesuar', 'ACCESSORY'],
    ['Hizmet', 'SERVICE'],
    ['Diğer', 'OTHER'],
  ];

  const groupIds: Record<string, number> = {};
  groups.forEach(([name, code], i) => {
    const r = insert.run('PRODUCT_GROUP', null, name, code, i + 1);
    groupIds[code] = Number(r.lastInsertRowid);
  });

  const subgroups: Array<[string, string, string]> = [
    ['Metal Çerçeve', 'FRAME', 'METAL_FRAME'],
    ['Kemik Çerçeve', 'FRAME', 'ACETATE_FRAME'],
    ['Çocuk Çerçeve', 'FRAME', 'KIDS_FRAME'],
    ['Spor Çerçeve', 'FRAME', 'SPORT_FRAME'],
    ['Numaralı Gözlük Çerçevesi', 'FRAME', 'RX_FRAME'],
    ['Tek Odak', 'OPTIC_GLASS', 'SINGLE_VISION'],
    ['Progresif', 'OPTIC_GLASS', 'PROGRESSIVE'],
    ['Bifokal', 'OPTIC_GLASS', 'BIFOCAL'],
    ['Ofis Camı', 'OPTIC_GLASS', 'OFFICE'],
    ['Mavi Işık Filtreli', 'OPTIC_GLASS', 'BLUE_FILTER'],
    ['Fotokromik', 'OPTIC_GLASS', 'PHOTOCHROMIC'],
    ['Polarize', 'OPTIC_GLASS', 'POLARIZED_GLASS'],
    ['Günlük Lens', 'CONTACT_LENS', 'DAILY'],
    ['Aylık Lens', 'CONTACT_LENS', 'MONTHLY'],
    ['Toric Lens', 'CONTACT_LENS', 'TORIC'],
    ['Multifokal Lens', 'CONTACT_LENS', 'MULTIFOCAL'],
    ['Renkli Lens', 'CONTACT_LENS', 'COLORED'],
    ['Kılıf', 'ACCESSORY', 'CASE'],
    ['Temizleme Spreyi', 'ACCESSORY', 'SPRAY'],
    ['Mikrofiber Bez', 'ACCESSORY', 'CLOTH'],
    ['Zincir / Askı', 'ACCESSORY', 'CHAIN'],
    ['Yedek Parça', 'ACCESSORY', 'SPARE'],
  ];

  subgroups.forEach(([name, parentCode, code], i) => {
    insert.run('PRODUCT_SUBGROUP', groupIds[parentCode], name, code, i + 1);
  });
}

export function runColumnMigrations(db: Database.Database): void {
  for (const col of PRODUCT_COLUMNS) {
    addColumnIfMissing(db, 'products', col.name, col.ddl);
  }
  for (const col of CUSTOMER_COLUMNS) {
    addColumnIfMissing(db, 'customers', col.name, col.ddl);
  }
  for (const col of PRESCRIPTION_COLUMNS) {
    addColumnIfMissing(db, 'prescriptions', col.name, col.ddl);
  }
  for (const col of SALES_COLUMNS) {
    addColumnIfMissing(db, 'sales', col.name, col.ddl);
  }
  for (const col of SALE_ITEM_COLUMNS) {
    addColumnIfMissing(db, 'sale_items', col.name, col.ddl);
  }
  for (const col of PAYMENT_COLUMNS) {
    addColumnIfMissing(db, 'payments', col.name, col.ddl);
  }
  for (const col of CASH_COLUMNS) {
    addColumnIfMissing(db, 'cash_movements', col.name, col.ddl);
  }
  for (const col of USER_COLUMNS) {
    addColumnIfMissing(db, 'users', col.name, col.ddl);
  }
  for (const col of COMPANY_COLUMNS) {
    addColumnIfMissing(db, 'companies', col.name, col.ddl);
  }
  for (const col of AUDIT_COLUMNS) {
    addColumnIfMissing(db, 'audit_logs', col.name, col.ddl);
  }
  for (const col of LICENSE_COLUMNS) {
    addColumnIfMissing(db, 'license_info', col.name, col.ddl);
  }
  for (const col of SUPPLIER_COLUMNS) {
    addColumnIfMissing(db, 'suppliers', col.name, col.ddl);
  }

  addColumnIfMissing(db, 'products', DEMO_FLAG_COLUMN.name, DEMO_FLAG_COLUMN.ddl);
  addColumnIfMissing(db, 'customers', DEMO_FLAG_COLUMN.name, DEMO_FLAG_COLUMN.ddl);
  addColumnIfMissing(db, 'prescriptions', DEMO_FLAG_COLUMN.name, DEMO_FLAG_COLUMN.ddl);
  addColumnIfMissing(db, 'companies', DEMO_FLAG_COLUMN.name, DEMO_FLAG_COLUMN.ddl);

  backfillDemoFlags(db);
  ensureDemoPrescriptions(db);

  db.prepare(`UPDATE license_info SET status = 'Aktif' WHERE is_active = 1 AND (status IS NULL OR status = 'Pasif')`).run();
  db.prepare(`UPDATE license_info SET last_online_check_at = activated_at WHERE is_active = 1 AND last_online_check_at IS NULL AND activated_at IS NOT NULL`).run();

  db.prepare(`UPDATE users SET role = 'Yönetici' WHERE role = 'admin'`).run();
  db.prepare(`UPDATE users SET is_active = 1 WHERE is_active IS NULL`).run();

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_account_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      sale_id INTEGER,
      movement_type TEXT NOT NULL,
      debit_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );
  `);

  db.prepare(`UPDATE customers SET is_active = 1 WHERE is_active IS NULL`).run();
  db.prepare(`UPDATE prescriptions SET is_active = 1 WHERE is_active IS NULL`).run();

  db.prepare(`
    UPDATE sales SET
      paid_amount = COALESCE(net_amount, total_amount, 0),
      remaining_amount = 0,
      status = 'Tamamlandı',
      payment_status = COALESCE(payment_status, 'Ödendi')
    WHERE paid_amount IS NULL OR paid_amount = 0 AND remaining_amount IS NULL
  `).run();

  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT NOT NULL,
      sale_id INTEGER NOT NULL,
      customer_id INTEGER,
      return_type TEXT NOT NULL,
      refund_method TEXT,
      total_amount REAL DEFAULT 0,
      exchange_diff REAL DEFAULT 0,
      reason TEXT,
      notes TEXT,
      status TEXT DEFAULT 'Tamamlandı',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS exchange_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      barcode TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS print_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT NOT NULL,
      related_id INTEGER,
      printed_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS medula_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_no TEXT NOT NULL,
      export_type TEXT NOT NULL,
      file_path TEXT,
      record_count INTEGER DEFAULT 0,
      exported_at TEXT DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'Tamamlandı',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS medula_export_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_id INTEGER NOT NULL,
      sale_id INTEGER,
      prescription_id INTEGER,
      customer_id INTEGER,
      status TEXT DEFAULT 'Dışa Aktarıldı',
      notes TEXT,
      FOREIGN KEY (export_id) REFERENCES medula_exports(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      tax_no TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_entry_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT NOT NULL UNIQUE,
      supplier_id INTEGER,
      document_no TEXT,
      entry_date TEXT NOT NULL,
      total_items INTEGER DEFAULT 0,
      total_quantity INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stock_entry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      barcode TEXT,
      quantity INTEGER NOT NULL,
      purchase_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      previous_stock INTEGER DEFAULT 0,
      new_stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (batch_id) REFERENCES stock_entry_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      count_date TEXT NOT NULL,
      count_type TEXT NOT NULL DEFAULT 'Tam sayım',
      product_type_filter TEXT,
      category_filter TEXT,
      brand_filter TEXT,
      location_filter TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Devam Ediyor',
      created_by INTEGER,
      completed_at TEXT,
      adjusted_at TEXT,
      last_scanned_code TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      barcode TEXT,
      expected_quantity INTEGER NOT NULL DEFAULT 0,
      counted_quantity INTEGER NOT NULL DEFAULT 0,
      difference_quantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Sayılmadı',
      last_scanned_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      UNIQUE(count_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_count_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER NOT NULL,
      product_id INTEGER,
      raw_code TEXT NOT NULL,
      normalized_code TEXT,
      barcode_type TEXT,
      gtin TEXT,
      serial_no TEXT,
      lot_no TEXT,
      expiry_date TEXT,
      scan_result TEXT NOT NULL,
      scanned_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_by INTEGER,
      FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_unknown_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER NOT NULL,
      raw_code TEXT NOT NULL,
      normalized_code TEXT,
      barcode_type TEXT,
      gtin TEXT,
      serial_no TEXT,
      lot_no TEXT,
      expiry_date TEXT,
      notes TEXT,
      resolved_product_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Bekliyor',
      scanned_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE,
      FOREIGN KEY (resolved_product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_no TEXT NOT NULL UNIQUE,
      document_type TEXT NOT NULL,
      supplier_id INTEGER NOT NULL,
      document_date TEXT NOT NULL,
      due_date TEXT,
      source_type TEXT NOT NULL DEFAULT 'direct',
      stock_entry_batch_id INTEGER,
      subtotal_amount REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'Ödeme bekliyor',
      status TEXT NOT NULL DEFAULT 'Aktif',
      notes TEXT,
      cancel_reason TEXT,
      cancelled_at TEXT,
      total_items INTEGER DEFAULT 0,
      total_quantity INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (stock_entry_batch_id) REFERENCES stock_entry_batches(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_document_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_document_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      barcode TEXT,
      quantity INTEGER NOT NULL,
      purchase_price REAL DEFAULT 0,
      vat_rate REAL DEFAULT 18,
      vat_amount REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      shelf_location TEXT,
      previous_stock INTEGER DEFAULT 0,
      new_stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (purchase_document_id) REFERENCES purchase_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_account_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_document_id INTEGER,
      payment_id INTEGER,
      movement_type TEXT NOT NULL,
      debit_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (purchase_document_id) REFERENCES purchase_documents(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      purchase_document_id INTEGER,
      amount REAL NOT NULL,
      payment_type TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      description TEXT,
      cash_movement_id INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (purchase_document_id) REFERENCES purchase_documents(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS uts_titubb_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_no TEXT NOT NULL UNIQUE,
      file_path TEXT,
      record_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Excel Hazırlandı',
      exported_at TEXT DEFAULT (datetime('now', 'localtime')),
      uploaded_at TEXT,
      notes TEXT,
      created_by INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS uts_titubb_export_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      stock_entry_batch_id INTEGER,
      stock_entry_item_id INTEGER,
      barcode TEXT,
      gtin TEXT,
      serial_no TEXT,
      lot_no TEXT,
      expiry_date TEXT,
      status TEXT NOT NULL DEFAULT 'Excel Hazırlandı',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (export_id) REFERENCES uts_titubb_exports(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (stock_entry_batch_id) REFERENCES stock_entry_batches(id),
      FOREIGN KEY (stock_entry_item_id) REFERENCES stock_entry_items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_titubb_items_lookup
      ON uts_titubb_export_items(product_id, serial_no, lot_no, status);

    CREATE TABLE IF NOT EXISTS optical_lookup_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      parent_id INTEGER,
      name TEXT NOT NULL,
      code TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (parent_id) REFERENCES optical_lookup_values(id)
    );

    CREATE INDEX IF NOT EXISTS idx_optical_lookup_type ON optical_lookup_values(type, is_active);
    CREATE INDEX IF NOT EXISTS idx_optical_lookup_parent ON optical_lookup_values(parent_id);
  `);

  for (const col of OPTICAL_PRODUCT_COLUMNS) {
    addColumnIfMissing(db, 'products', col.name, col.ddl);
  }

  seedOpticalLookups(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      iban TEXT,
      branch_name TEXT,
      account_no TEXT,
      currency TEXT DEFAULT '₺',
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS pos_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bank_account_id INTEGER,
      commission_rate REAL DEFAULT 0,
      block_days INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS bank_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_account_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL,
      related_cash_movement_id INTEGER,
      related_sale_id INTEGER,
      related_supplier_id INTEGER,
      related_customer_id INTEGER,
      related_expense_id INTEGER,
      description TEXT,
      movement_date TEXT DEFAULT (datetime('now', 'localtime')),
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
      FOREIGN KEY (related_cash_movement_id) REFERENCES cash_movements(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS pos_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pos_account_id INTEGER NOT NULL,
      sale_id INTEGER,
      gross_amount REAL NOT NULL,
      commission_amount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      expected_transfer_date TEXT,
      transferred_at TEXT,
      status TEXT DEFAULT 'Bekliyor',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (pos_account_id) REFERENCES pos_accounts(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      vat_rate REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      payment_method TEXT NOT NULL,
      bank_account_id INTEGER,
      status TEXT DEFAULT 'Aktif',
      document_no TEXT,
      notes TEXT,
      cash_movement_id INTEGER,
      bank_movement_id INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS personnel_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      personnel_name TEXT NOT NULL,
      expense_type TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      bank_account_id INTEGER,
      description TEXT,
      expense_id INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (expense_id) REFERENCES expenses(id),
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bank_movements_account ON bank_movements(bank_account_id, movement_date);
    CREATE INDEX IF NOT EXISTS idx_pos_movements_account ON pos_movements(pos_account_id, status);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date, status);
  `);

  addColumnIfMissing(db, 'supplier_payments', 'bank_account_id', 'INTEGER');
  addColumnIfMissing(db, 'supplier_payments', 'bank_movement_id', 'INTEGER');
  addColumnIfMissing(db, 'payments', 'pos_account_id', 'INTEGER');
  addColumnIfMissing(db, 'payments', 'pos_movement_id', 'INTEGER');

  for (const col of SALES_DISCOUNT_COLUMNS) {
    addColumnIfMissing(db, 'sales', col.name, col.ddl);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      campaign_type TEXT NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL DEFAULT 0,
      max_discount_amount REAL,
      min_sale_amount REAL,
      min_quantity INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      priority INTEGER DEFAULT 100,
      usage_limit INTEGER,
      per_customer_limit INTEGER,
      status TEXT NOT NULL DEFAULT 'Taslak',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS campaign_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      target_value TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      sale_item_id INTEGER,
      campaign_id INTEGER,
      discount_type TEXT NOT NULL,
      discount_value REAL,
      discount_amount REAL NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS campaign_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      customer_id INTEGER,
      discount_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Aktif',
      used_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign ON campaign_targets(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_usages_campaign ON campaign_usages(campaign_id, used_at);
    CREATE INDEX IF NOT EXISTS idx_sale_discounts_sale ON sale_discounts(sale_id);
  `);

  for (const col of CUSTOMER_V2_COLUMNS) {
    addColumnIfMissing(db, 'customers', col.name, col.ddl);
  }

  seedCustomerCategories(db);
  seedCommunicationTemplates(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_important_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      repeat_type TEXT NOT NULL DEFAULT 'Tek seferlik',
      reminder_days_before INTEGER DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT,
      appointment_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Planlandı',
      notes TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS communication_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS communication_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      template_id INTEGER,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Hazırlandı',
      sent_at TEXT,
      created_by INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (template_id) REFERENCES communication_templates(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, status);
    CREATE INDEX IF NOT EXISTS idx_customer_dates ON customer_important_dates(customer_id, date);
    CREATE INDEX IF NOT EXISTS idx_comm_logs_customer ON communication_logs(customer_id, created_at);
  `);
}

function seedCustomerCategories(db: Database.Database): void {
  const count = db
    .prepare(`SELECT COUNT(*) as c FROM optical_lookup_values WHERE type = 'CUSTOMER_CATEGORY'`)
    .get() as { c: number };
  if (count.c > 0) return;
  const insert = db.prepare(
    `INSERT INTO optical_lookup_values (type, parent_id, name, code, sort_order, is_active) VALUES (?, NULL, ?, ?, ?, 1)`
  );
  const cats = ['Normal', 'VIP', 'Kurumsal', 'SGK', 'Çocuk', 'Lens Kullanıcısı', 'Kampanya Müşterisi', 'Borçlu Müşteri'];
  cats.forEach((name, i) => insert.run('CUSTOMER_CATEGORY', name, name.toUpperCase().replace(/\s+/g, '_'), i + 1));
}

function seedCommunicationTemplates(db: Database.Database): void {
  const count = db.prepare(`SELECT COUNT(*) as c FROM communication_templates`).get() as { c: number };
  if (count.c > 0) return;
  const insert = db.prepare(
    `INSERT INTO communication_templates (channel, name, subject, body, is_active) VALUES (?, ?, ?, ?, 1)`
  );
  const templates: Array<[string, string, string | null, string]> = [
    ['WHATSAPP', 'Randevu hatırlatma', null, 'Sayın {musteri_adi}, {randevu_tarihi} {randevu_saati} randevunuzu hatırlatırız. {firma_adi}'],
    ['SMS', 'Randevu hatırlatma', null, 'Sayın {musteri_adi}, {randevu_tarihi} {randevu_saati} randevunuz var. {firma_adi}'],
    ['EMAIL', 'Randevu hatırlatma', 'Randevu Hatırlatma', 'Sayın {musteri_adi},\n\n{randevu_tarihi} {randevu_saati} randevunuzu hatırlatırız.\n\n{firma_adi}'],
    ['WHATSAPP', 'Borç bakiye hatırlatma', null, 'Sayın {musteri_adi}, cari bakiyeniz {bakiye}. {firma_adi}'],
    ['SMS', 'Borç bakiye hatırlatma', null, 'Sayın {musteri_adi}, bakiyeniz {bakiye}. {firma_adi}'],
    ['WHATSAPP', 'Doğum günü kutlama', null, 'İyi ki doğdunuz {musteri_adi}! {firma_adi} ailesi olarak nice sağlıklı yıllar dileriz.'],
    ['WHATSAPP', 'Lens yenileme hatırlatma', null, 'Sayın {musteri_adi}, lens yenileme zamanınız yaklaşıyor. Son kontrol: {son_kontrol_tarihi}. {firma_adi}'],
    ['WHATSAPP', 'Gözlük teslim hazır', null, 'Sayın {musteri_adi}, gözlüğünüz hazır. Teslim tarihi: {teslim_tarihi}. {firma_adi}'],
    ['WHATSAPP', 'Kampanya bilgilendirme', null, 'Sayın {musteri_adi}, yeni kampanyalarımızdan haberdar olun. {firma_adi}'],
  ];
  for (const t of templates) insert.run(...t);
}
