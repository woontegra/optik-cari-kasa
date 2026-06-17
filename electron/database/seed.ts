import type Database from 'better-sqlite3';

import { hashPassword } from '../services/auth.service';



export function seedInitialData(db: Database.Database): void {

  const insertUser = db.prepare(`

    INSERT INTO users (username, password_hash, full_name, role, must_change_password, is_active)

    VALUES (?, ?, ?, ?, 1, 1)

  `);

  insertUser.run('admin', hashPassword('admin123'), 'Sistem Yöneticisi', 'Yönetici');



  const insertCompany = db.prepare(`

    INSERT INTO companies (name, tax_number, tax_office, address, phone, email, is_default, is_demo)

    VALUES (?, ?, ?, ?, ?, ?, 1, 1)

  `);

  insertCompany.run(

    'Örnek Optik Mağazası',

    '1234567890',

    'Kadıköy',

    'İstanbul',

    '0212 000 00 00',

    'info@ornekoptik.com'

  );



  const insertSettings = db.prepare(`

    INSERT INTO app_settings (key, value) VALUES (?, ?)

  `);

  insertSettings.run('auto_backup_enabled', '0');

  insertSettings.run('backup_folder', '');

  insertSettings.run('backup_frequency', 'daily');

  insertSettings.run('auto_lock_minutes', '0');

  insertSettings.run('app_version', '1.0.0');



  const insertProduct = db.prepare(`

    INSERT INTO products (

      name, product_type, brand, model, stock_code, category,

      stock_quantity, purchase_price, sale_price, vat_rate,

      shelf_location, status, min_stock, description, extra_fields, is_demo

    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)

  `);



  const products: Array<{

    data: unknown[];

    barcode: string;

  }> = [

    {

      barcode: '8690001001001',

      data: [

        'Ray-Ban RB2140 Siyah Çerçeve',

        'Çerçeve',

        'Ray-Ban',

        'RB2140',

        'CRV-001',

        'Güneş Gözlüğü',

        15,

        850,

        1299,

        20,

        'A-01',

        'Aktif',

        3,

        'Klasik wayfarer model siyah çerçeve',

        JSON.stringify({

          color: 'Siyah',

          size: '50',

          bridge_size: '22',

          temple_length: '150',

          gender: 'Unisex',

          material: 'Asetat',

        }),

      ],

    },

    {

      barcode: '8690001001002',

      data: [

        'Essilor Crizal UV Cam',

        'Cam',

        'Essilor',

        'Crizal UV',

        'CAM-001',

        'Progresif Cam',

        25,

        320,

        549,

        20,

        'B-02',

        'Aktif',

        5,

        'UV korumalı anti-refle cam',

        JSON.stringify({

          sph: '-2.00',

          cyl: '-0.50',

          ax: '90',

          add: '',

          diameter: '65',

          index: '1.67',

          coating: 'Crizal UV',

        }),

      ],

    },

    {

      barcode: '8690001001003',

      data: [

        'Acuvue Oasys Lens',

        'Lens',

        'Johnson & Johnson',

        'Oasys',

        'LNS-001',

        'Yumuşak Lens',

        40,

        180,

        299,

        20,

        'C-03',

        'Aktif',

        10,

        '2 haftalık kullanım lensi (6lı kutu)',

        JSON.stringify({

          sph: '-1.25',

          cyl: '',

          ax: '',

          bc: '8.4',

          dia: '14.0',

          add: '',

          color: '',

          expiry_date: '2027-12-31',

          lot_no: 'LOT2026001',

        }),

      ],

    },

    {

      barcode: '8690001001004',

      data: [

        'Premium Gözlük Kılıfı',

        'Aksesuar',

        'Woontegra',

        'KLF-01',

        'AKS-001',

        'Kılıf',

        50,

        35,

        79,

        20,

        'D-01',

        'Aktif',

        5,

        'Mikrofiber astarlı sert kılıf',

        null,

      ],

    },

    {

      barcode: '8690001001005',

      data: [

        'Lens Temizleme Spreyi',

        'Aksesuar',

        'Woontegra',

        'SPY-100',

        'AKS-002',

        'Bakım',

        100,

        25,

        59,

        20,

        'D-02',

        'Aktif',

        20,

        'Cam ve lens temizleme spreyi (100 ml)',

        null,

      ],

    },

  ];



  const productIds: number[] = [];

  for (const p of products) {

    const result = insertProduct.run(...p.data);

    productIds.push(Number(result.lastInsertRowid));

  }



  const insertBarcode = db.prepare(`

    INSERT INTO product_barcodes (product_id, barcode, is_primary) VALUES (?, ?, 1)

  `);

  products.forEach((p, i) => {

    insertBarcode.run(productIds[i], p.barcode);

  });



  const insertCustomer = db.prepare(`

    INSERT INTO customers (full_name, tc_no, phone, email, balance, last_sale_date, is_demo, is_active)

    VALUES (?, ?, ?, ?, 0, NULL, 1, 1)

  `);

  const ahmetId = Number(

    insertCustomer.run('Ahmet Yılmaz', '12345678901', '0532 111 22 33', 'ahmet@mail.com').lastInsertRowid

  );

  const ayseId = Number(

    insertCustomer.run('Ayşe Demir', '98765432109', '0533 444 55 66', 'ayse@mail.com').lastInsertRowid

  );



  const insertPrescription = db.prepare(`

    INSERT INTO prescriptions (

      customer_id, prescription_no, prescription_date, doctor, institution,

      right_sph, right_cyl, right_ax, left_sph, left_cyl, left_ax,

      add_value, pd, status, is_active, is_demo, lens_type, usage_type, notes

    ) VALUES (?, ?, date('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', 1, 1, ?, ?, ?)

  `);



  insertPrescription.run(

    ahmetId,

    'RCT-00001',

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



  insertPrescription.run(

    ayseId,

    'RCT-00002',

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



  const insertStockMovement = db.prepare(`

    INSERT INTO stock_movements (product_id, movement_type, quantity, unit_price, notes)

    VALUES (?, 'Giriş', ?, ?, 'İlk stok girişi')

  `);

  products.forEach((p, i) => {

    const qty = p.data[6] as number;

    const price = p.data[7] as number;

    insertStockMovement.run(productIds[i], qty, price);

  });

}


