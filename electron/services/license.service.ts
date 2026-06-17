import type Database from 'better-sqlite3';
import {
  DEMO_LICENSE_KEY,
  DEMO_VALIDITY_DAYS,
  OFFLINE_BLOCK_DAYS,
  OFFLINE_GRACE_DAYS,
  type LicenseActivateInput,
  type LicenseInfoView,
  type LicenseStatus,
  type LicenseStatusResult,
} from '../types/license';
import { getDeviceHash, getDeviceName } from './device.service';
import { logError, logInfo, logWarn } from './logger.service';

const PRODUCT_CODE = 'WO-OPTIK-DESKTOP';
const PRODUCT_NAME = 'Woontegra Optik Desktop';
const SUPPORT_EMAIL = 'destek@woontegra.com';

export class LicenseService {
  constructor(private db: Database.Database) {}

  private getSetting(key: string): string {
    const row = this.db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? '';
  }

  private getLicenseApiUrl(): string {
    return this.getSetting('license_api_url').trim();
  }

  getActiveLicenseRow(): Record<string, unknown> | undefined {
    return this.db
      .prepare(
        `SELECT * FROM license_info WHERE is_active = 1 AND status = 'Aktif' ORDER BY id DESC LIMIT 1`
      )
      .get() as Record<string, unknown> | undefined;
  }

  /** Aktif veya offline uyarılı kayıt */
  getCurrentLicenseRow(): Record<string, unknown> | undefined {
    return (
      this.db
        .prepare(`SELECT * FROM license_info WHERE is_active = 1 ORDER BY id DESC LIMIT 1`)
        .get() as Record<string, unknown> | undefined
    );
  }

  maskLicenseKey(key: string): string {
    const k = key.trim();
    if (k.length <= 8) return '****';
    const parts = k.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-${parts[1].slice(0, 1)}***-${parts[parts.length - 1]}`;
    }
    return `${k.slice(0, 4)}***${k.slice(-4)}`;
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  private addDays(iso: string, days: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  private rowToView(row: Record<string, unknown>): LicenseInfoView {
    const key = String(row.license_key || '');
    const isDemo = key.toUpperCase() === DEMO_LICENSE_KEY;
    return {
      id: Number(row.id),
      licenseKeyMasked: this.maskLicenseKey(key),
      customerName: row.customer_name ? String(row.customer_name) : null,
      customerEmail: row.customer_email ? String(row.customer_email) : null,
      companyName: row.company_name ? String(row.company_name) : null,
      productCode: row.product_code ? String(row.product_code) : PRODUCT_CODE,
      productName: row.product_name ? String(row.product_name) : PRODUCT_NAME,
      licenseType: row.license_type ? String(row.license_type) : isDemo ? 'Demo' : 'Standart',
      deviceName: row.device_name ? String(row.device_name) : null,
      activatedAt: row.activated_at ? String(row.activated_at) : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      lastOnlineCheckAt: row.last_online_check_at ? String(row.last_online_check_at) : null,
      offlineGraceDays: Number(row.offline_grace_days ?? OFFLINE_GRACE_DAYS),
      status: (row.status as LicenseStatus) || 'Pasif',
      planName: row.plan_name ? String(row.plan_name) : isDemo ? 'Demo' : null,
      maxDevices: row.max_devices != null ? Number(row.max_devices) : 1,
      features: row.features ? String(row.features) : null,
      isDemo,
    };
  }

  evaluateLicense(row: Record<string, unknown>): LicenseStatusResult {
    const now = new Date();
    const view = this.rowToView(row);
    const isDemo = view.isDemo;

    if (view.expiresAt && new Date(view.expiresAt) < now) {
      return {
        isActive: false,
        canEnterApp: false,
        warning: null,
        blockReason: 'Lisans süresi dolmuş. Lütfen lisansınızı yenileyin.',
        license: { ...view, status: 'Süresi doldu' },
        offlineDaysSinceCheck: 0,
        offlineGraceRemaining: 0,
      };
    }

    const lastCheck = view.lastOnlineCheckAt || view.activatedAt || new Date().toISOString();
    const offlineDays = this.daysBetween(new Date(lastCheck), now);
    const graceDays = isDemo ? DEMO_VALIDITY_DAYS : Number(row.offline_grace_days ?? OFFLINE_GRACE_DAYS);
    const blockDays = isDemo ? DEMO_VALIDITY_DAYS : OFFLINE_BLOCK_DAYS;
    const graceRemaining = Math.max(0, graceDays - offlineDays);
    const blockRemaining = Math.max(0, blockDays - offlineDays);

    if (offlineDays >= blockDays) {
      return {
        isActive: false,
        canEnterApp: false,
        warning: null,
        blockReason:
          'Lisans doğrulaması yapılamadı. Programı kullanmaya devam etmek için internet bağlantınızı kontrol edip lisansı doğrulayın.',
        license: { ...view, status: 'Offline süre doldu' },
        offlineDaysSinceCheck: offlineDays,
        offlineGraceRemaining: 0,
      };
    }

    let warning: string | null = null;
    if (!isDemo && offlineDays >= graceDays) {
      warning = `Lisans doğrulaması ${offlineDays} gündür yapılamadı. ${blockRemaining} gün içinde doğrulama yapılmazsa program kilitlenecektir.`;
    } else if (!isDemo && offlineDays >= graceDays - 3 && offlineDays < graceDays) {
      warning = `Lisans doğrulaması yakında gerekli. Son doğrulamadan ${offlineDays} gün geçti.`;
    }

    return {
      isActive: true,
      canEnterApp: true,
      warning,
      blockReason: null,
      license: { ...view, status: 'Aktif' },
      offlineDaysSinceCheck: offlineDays,
      offlineGraceRemaining: graceRemaining,
    };
  }

  getStatus(): LicenseStatusResult {
    const row = this.getCurrentLicenseRow();
    if (!row) {
      return {
        isActive: false,
        canEnterApp: false,
        warning: null,
        blockReason: null,
        license: null,
        offlineDaysSinceCheck: 0,
        offlineGraceRemaining: 0,
      };
    }
    if (row.status && row.status !== 'Aktif') {
      const view = this.rowToView(row);
      return {
        isActive: false,
        canEnterApp: false,
        warning: null,
        blockReason: `Lisans durumu: ${row.status}`,
        license: view,
        offlineDaysSinceCheck: 0,
        offlineGraceRemaining: 0,
      };
    }
    return this.evaluateLicense(row);
  }

  private async validateWithServer(
    licenseKey: string,
    deviceHash: string
  ): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
    const apiUrl = this.getLicenseApiUrl();
    if (!apiUrl) {
      return { ok: false, error: 'Lisans API adresi yapılandırılmamış.' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, deviceHash, productCode: PRODUCT_CODE }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return { ok: false, error: 'Lisans sunucusu geçersiz yanıt döndürdü.' };
      }
      const data = (await res.json()) as Record<string, unknown>;
      return { ok: true, data };
    } catch (err) {
      logWarn('Lisans', 'Online doğrulama başarısız', (err as Error).message);
      return { ok: false, error: 'Lisans sunucusuna bağlanılamadı.' };
    }
  }

  private validateLocalKey(licenseKey: string): { ok: boolean; error?: string; isDemo: boolean } {
    const key = licenseKey.trim().toUpperCase();
    if (key === DEMO_LICENSE_KEY) {
      return { ok: true, isDemo: true };
    }
    if (!/^WO-[A-Z0-9]{4,}-[A-Z0-9]{4,}-[A-Z0-9]{4,}$/.test(key)) {
      return { ok: false, isDemo: false, error: 'Geçersiz lisans anahtarı formatı.' };
    }
    const apiUrl = this.getLicenseApiUrl();
    if (!apiUrl) {
      return {
        ok: false,
        isDemo: false,
        error: 'Bu lisans anahtarı yerel olarak doğrulanamıyor. İnternet bağlantısı veya demo lisans kullanın.',
      };
    }
    return { ok: true, isDemo: false };
  }

  async activate(input: LicenseActivateInput): Promise<{ success: boolean; error?: string }> {
    const key = input.licenseKey.trim().toUpperCase();
    if (!key) return { success: false, error: 'Lisans anahtarı zorunludur.' };

    const local = this.validateLocalKey(key);
    if (!local.ok) return { success: false, error: local.error };

    const deviceHash = getDeviceHash();
    const deviceName = getDeviceName();
    const now = new Date().toISOString();
    let serverData: Record<string, unknown> | null = null;

    if (!local.isDemo) {
      const online = await this.validateWithServer(key, deviceHash);
      if (online.ok && online.data) {
        serverData = online.data;
      } else if (online.error && this.getLicenseApiUrl()) {
        return { success: false, error: online.error || 'Lisans doğrulanamadı.' };
      }
    }

    const expiresAt = local.isDemo
      ? this.addDays(now, DEMO_VALIDITY_DAYS)
      : serverData?.expiresAt
        ? String(serverData.expiresAt)
        : null;

    this.db.prepare(`UPDATE license_info SET is_active = 0`).run();
    this.db
      .prepare(
        `INSERT INTO license_info (
          license_key, is_active, activated_at, expires_at, company_name,
          customer_name, customer_email, product_code, product_name, license_type,
          device_hash, device_name, last_online_check_at, offline_grace_days,
          status, plan_name, max_devices, features, raw_response, hardware_id
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', ?, ?, ?, ?, ?)`
      )
      .run(
        key,
        now,
        expiresAt,
        input.companyName?.trim() || (local.isDemo ? 'Demo Firma' : ''),
        input.customerName?.trim() || null,
        input.customerEmail?.trim() || null,
        PRODUCT_CODE,
        PRODUCT_NAME,
        local.isDemo ? 'Demo' : 'Standart',
        deviceHash,
        deviceName,
        now,
        local.isDemo ? DEMO_VALIDITY_DAYS : OFFLINE_GRACE_DAYS,
        local.isDemo ? 'Demo' : serverData?.planName ? String(serverData.planName) : 'Standart',
        serverData?.maxDevices ? Number(serverData.maxDevices) : 1,
        serverData?.features ? JSON.stringify(serverData.features) : null,
        serverData ? JSON.stringify(serverData) : null,
        deviceHash
      );

    logInfo('Lisans', `Lisans aktifleştirildi: ${this.maskLicenseKey(key)}`);
    return { success: true };
  }

  async revalidate(): Promise<{ success: boolean; warning?: string; error?: string }> {
    const row = this.getCurrentLicenseRow();
    if (!row) return { success: false, error: 'Aktif lisans bulunamadı.' };

    const key = String(row.license_key);
    const deviceHash = getDeviceHash();
    const isDemo = key.toUpperCase() === DEMO_LICENSE_KEY;
    const now = new Date().toISOString();

    if (isDemo) {
      this.db
        .prepare(
          `UPDATE license_info SET last_online_check_at = ?, status = 'Aktif', updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(now, row.id);
      logInfo('Lisans', 'Demo lisans yeniden doğrulandı (yerel)');
      return { success: true };
    }

    const online = await this.validateWithServer(key, deviceHash);
    if (online.ok) {
      this.db
        .prepare(
          `UPDATE license_info SET last_online_check_at = ?, status = 'Aktif',
           raw_response = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(now, online.data ? JSON.stringify(online.data) : null, row.id);
      logInfo('Lisans', 'Lisans online doğrulandı');
      return { success: true };
    }

    this.db
      .prepare(
        `UPDATE license_info SET updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(row.id);

    return {
      success: true,
      warning: online.error || 'Online doğrulama yapılamadı. Offline kullanım süresi devam ediyor.',
    };
  }

  getInfo(): LicenseInfoView | null {
    const row = this.getCurrentLicenseRow();
    if (!row) return null;
    return this.rowToView(row);
  }

  getCopyText(): string {
    const info = this.getInfo();
    if (!info) return '';
    return [
      `Woontegra Optik Desktop Lisans Bilgileri`,
      `Anahtar: ${info.licenseKeyMasked}`,
      `Firma: ${info.companyName || '-'}`,
      `Müşteri: ${info.customerName || '-'}`,
      `E-posta: ${info.customerEmail || '-'}`,
      `Ürün: ${info.productName}`,
      `Paket: ${info.planName || '-'}`,
      `Durum: ${info.status}`,
      `Aktivasyon: ${info.activatedAt || '-'}`,
      `Son Doğrulama: ${info.lastOnlineCheckAt || '-'}`,
      `Bitiş: ${info.expiresAt || '-'}`,
      `Cihaz: ${info.deviceName || '-'}`,
      `Destek: ${SUPPORT_EMAIL}`,
    ].join('\n');
  }

  async changeKey(input: LicenseActivateInput): Promise<{ success: boolean; error?: string }> {
    return this.activate(input);
  }

  getSupportEmail(): string {
    return SUPPORT_EMAIL;
  }
}
