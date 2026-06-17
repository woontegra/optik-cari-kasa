export const DEMO_LICENSE_KEY = 'WO-OPTIK-DEMO-2026';

export const LICENSE_STATUSES = [
  'Aktif',
  'Süresi doldu',
  'Pasif',
  'Cihaz limiti dolu',
  'Offline süre doldu',
  'Geçersiz',
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const DEMO_VALIDITY_DAYS = 30;
export const OFFLINE_GRACE_DAYS = 15;
export const OFFLINE_BLOCK_DAYS = 30;

export interface LicenseActivateInput {
  licenseKey: string;
  companyName?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface LicenseStatusResult {
  isActive: boolean;
  canEnterApp: boolean;
  warning: string | null;
  blockReason: string | null;
  license: LicenseInfoView | null;
  offlineDaysSinceCheck: number;
  offlineGraceRemaining: number;
}

export interface LicenseInfoView {
  id: number;
  licenseKeyMasked: string;
  customerName: string | null;
  customerEmail: string | null;
  companyName: string | null;
  productCode: string | null;
  productName: string | null;
  licenseType: string | null;
  deviceName: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  lastOnlineCheckAt: string | null;
  offlineGraceDays: number;
  status: LicenseStatus;
  planName: string | null;
  maxDevices: number | null;
  features: string | null;
  isDemo: boolean;
}

export interface LicenseCopyInfo {
  text: string;
}
