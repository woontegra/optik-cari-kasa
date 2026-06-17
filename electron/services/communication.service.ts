import type Database from 'better-sqlite3';
import type {
  CommunicationLogInput,
  CommunicationTemplateInput,
  PrepareMessageInput,
} from '../types/customerTracking';

export class CommunicationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommunicationValidationError';
  }
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₺`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  } catch {
    return dateStr;
  }
}

export class CommunicationService {
  constructor(private db: Database.Database) {}

  listTemplates(activeOnly = true): Record<string, unknown>[] {
    let sql = `SELECT * FROM communication_templates WHERE 1=1`;
    if (activeOnly) sql += ` AND is_active = 1`;
    sql += ` ORDER BY channel, name`;
    return this.db.prepare(sql).all() as Record<string, unknown>[];
  }

  createTemplate(input: CommunicationTemplateInput): { id: number } {
    if (!input.name?.trim()) throw new CommunicationValidationError('Şablon adı zorunludur.');
    if (!input.body?.trim()) throw new CommunicationValidationError('Mesaj metni zorunludur.');
    const result = this.db
      .prepare(
        `INSERT INTO communication_templates (channel, name, subject, body, is_active) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.channel,
        input.name.trim(),
        input.subject?.trim() || null,
        input.body.trim(),
        input.is_active !== false ? 1 : 0
      );
    return { id: Number(result.lastInsertRowid) };
  }

  updateTemplate(id: number, input: Partial<CommunicationTemplateInput>): { id: number } {
    const existing = this.db.prepare(`SELECT id FROM communication_templates WHERE id = ?`).get(id);
    if (!existing) throw new CommunicationValidationError('Şablon bulunamadı.');
    this.db
      .prepare(
        `UPDATE communication_templates SET
          channel = COALESCE(?, channel),
          name = COALESCE(?, name),
          subject = COALESCE(?, subject),
          body = COALESCE(?, body),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.channel ?? null,
        input.name?.trim() ?? null,
        input.subject !== undefined ? input.subject?.trim() || null : null,
        input.body?.trim() ?? null,
        input.is_active !== undefined ? (input.is_active ? 1 : 0) : null,
        id
      );
    return { id };
  }

  deactivateTemplate(id: number): { id: number } {
    this.db
      .prepare(`UPDATE communication_templates SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(id);
    return { id };
  }

  private getCompanyName(): string {
    const company = this.db
      .prepare(`SELECT name FROM companies WHERE is_default = 1 LIMIT 1`)
      .get() as { name: string } | undefined;
    return company?.name || 'Woontegra Optik';
  }

  private buildVariables(customerId: number, appointmentId?: number): Record<string, string> {
    const customer = this.db.prepare(`SELECT * FROM customers WHERE id = ?`).get(customerId) as
      | Record<string, unknown>
      | undefined;
    if (!customer) throw new CommunicationValidationError('Müşteri bulunamadı.');

    let appointmentDate = '';
    let appointmentTime = '';
    if (appointmentId) {
      const appt = this.db
        .prepare(`SELECT appointment_date, appointment_time FROM appointments WHERE id = ?`)
        .get(appointmentId) as { appointment_date: string; appointment_time: string } | undefined;
      if (appt) {
        appointmentDate = formatDate(appt.appointment_date);
        appointmentTime = appt.appointment_time || '';
      }
    }

    const lastControl = formatDate(customer.next_control_date as string);
    const deliveryDate = this.db
      .prepare(
        `SELECT date FROM customer_important_dates
         WHERE customer_id = ? AND is_active = 1 AND title LIKE '%Teslim%' ORDER BY date DESC LIMIT 1`
      )
      .get(customerId) as { date: string } | undefined;

    return {
      musteri_adi: String(customer.full_name || ''),
      telefon: String(customer.phone || customer.whatsapp_phone || ''),
      randevu_tarihi: appointmentDate,
      randevu_saati: appointmentTime,
      bakiye: formatCurrency(Number(customer.balance || 0)),
      firma_adi: this.getCompanyName(),
      son_kontrol_tarihi: lastControl,
      teslim_tarihi: formatDate(deliveryDate?.date),
    };
  }

  private applyVariables(text: string, vars: Record<string, string>): string {
    return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
  }

  prepareMessage(input: PrepareMessageInput): {
    channel: string;
    subject: string;
    body: string;
    phone: string;
    email: string;
    whatsappUrl: string;
    mailtoUrl: string;
  } {
    let subject = input.subject || '';
    let body = input.body || '';

    if (input.template_id) {
      const template = this.db
        .prepare(`SELECT * FROM communication_templates WHERE id = ?`)
        .get(input.template_id) as Record<string, unknown> | undefined;
      if (!template) throw new CommunicationValidationError('Şablon bulunamadı.');
      subject = subject || String(template.subject || '');
      body = body || String(template.body || '');
    }

    if (!body.trim()) throw new CommunicationValidationError('Mesaj metni boş olamaz.');

    const vars = this.buildVariables(input.customer_id, input.appointment_id);
    subject = this.applyVariables(subject, vars);
    body = this.applyVariables(body, vars);

    const customer = this.db.prepare(`SELECT phone, whatsapp_phone, email FROM customers WHERE id = ?`).get(
      input.customer_id
    ) as { phone: string; whatsapp_phone: string; email: string };

    const phone = (customer.whatsapp_phone || customer.phone || '').replace(/\D/g, '');
    const email = customer.email || '';
    const encodedBody = encodeURIComponent(body);
    const encodedSubject = encodeURIComponent(subject);
    const whatsappUrl = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodedBody}` : '';
    const mailtoUrl = email
      ? `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`
      : `mailto:?subject=${encodedSubject}&body=${encodedBody}`;

    return {
      channel: input.channel,
      subject,
      body,
      phone: customer.phone || '',
      email,
      whatsappUrl,
      mailtoUrl,
    };
  }

  log(input: CommunicationLogInput, createdBy?: number): { id: number } {
    const result = this.db
      .prepare(
        `INSERT INTO communication_logs (customer_id, channel, template_id, subject, message, status, sent_at, created_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customer_id,
        input.channel,
        input.template_id || null,
        input.subject?.trim() || null,
        input.message,
        input.status || 'Hazırlandı',
        input.status === 'Gönderildi İşaretlendi' ? new Date().toISOString() : null,
        createdBy || null,
        input.notes?.trim() || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  markSent(id: number): { id: number } {
    this.db
      .prepare(
        `UPDATE communication_logs SET status = 'Gönderildi İşaretlendi', sent_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(id);
    return { id };
  }

  listByCustomer(customerId: number): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT cl.*, ct.name as template_name
         FROM communication_logs cl
         LEFT JOIN communication_templates ct ON ct.id = cl.template_id
         WHERE cl.customer_id = ?
         ORDER BY cl.created_at DESC`
      )
      .all(customerId) as Record<string, unknown>[];
  }
}

export class CustomerImportantDateService {
  constructor(private db: Database.Database) {}

  listByCustomer(customerId: number, activeOnly = true): Record<string, unknown>[] {
    let sql = `SELECT * FROM customer_important_dates WHERE customer_id = ?`;
    if (activeOnly) sql += ` AND is_active = 1`;
    sql += ` ORDER BY date`;
    return this.db.prepare(sql).all(customerId) as Record<string, unknown>[];
  }

  create(input: {
    customer_id: number;
    title: string;
    date: string;
    repeat_type?: string;
    reminder_days_before?: number;
    notes?: string;
  }): { id: number } {
    if (!input.title?.trim()) throw new Error('Başlık zorunludur.');
    if (!input.date) throw new Error('Tarih zorunludur.');
    const result = this.db
      .prepare(
        `INSERT INTO customer_important_dates (customer_id, title, date, repeat_type, reminder_days_before, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.customer_id,
        input.title.trim(),
        input.date,
        input.repeat_type || 'Tek seferlik',
        input.reminder_days_before ?? 0,
        input.notes?.trim() || null
      );
    return { id: Number(result.lastInsertRowid) };
  }

  update(
    id: number,
    input: Partial<{
      title: string;
      date: string;
      repeat_type: string;
      reminder_days_before: number;
      notes: string;
      is_active: boolean;
    }>
  ): { id: number } {
    this.db
      .prepare(
        `UPDATE customer_important_dates SET
          title = COALESCE(?, title),
          date = COALESCE(?, date),
          repeat_type = COALESCE(?, repeat_type),
          reminder_days_before = COALESCE(?, reminder_days_before),
          notes = COALESCE(?, notes),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        input.title?.trim() ?? null,
        input.date ?? null,
        input.repeat_type ?? null,
        input.reminder_days_before ?? null,
        input.notes !== undefined ? input.notes?.trim() || null : null,
        input.is_active !== undefined ? (input.is_active ? 1 : 0) : null,
        id
      );
    return { id };
  }

  deactivate(id: number): { id: number } {
    return this.update(id, { is_active: false });
  }

  listUpcoming(days = 7): Record<string, unknown>[] {
    return this.db
      .prepare(
        `SELECT cid.*, c.full_name as customer_name, c.phone
         FROM customer_important_dates cid
         INNER JOIN customers c ON c.id = cid.customer_id
         WHERE cid.is_active = 1 AND c.is_active = 1
         AND date(cid.date) BETWEEN date('now', 'localtime') AND date('now', 'localtime', ? || ' days')
         ORDER BY cid.date`
      )
      .all(String(days)) as Record<string, unknown>[];
  }
}
