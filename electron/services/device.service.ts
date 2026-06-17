import crypto from 'crypto';
import os from 'os';

const APP_SALT = 'woontegra-optik-desktop-device-v1';

/**
 * Cihaz kimliği: hostname, platform, arch, CPU model ve bellek bilgisinden türetilir.
 * Kullanıcı adı dahil edilmez; Windows kullanıcı değişse bile kimlik sabit kalır.
 */
export function getDeviceFingerprint(): string {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model ?? 'unknown-cpu',
    String(os.totalmem()),
  ];
  return parts.join('|');
}

export function getDeviceHash(): string {
  return crypto.createHash('sha256').update(`${APP_SALT}:${getDeviceFingerprint()}`).digest('hex');
}

export function getDeviceName(): string {
  return os.hostname() || 'Bilinmeyen Cihaz';
}
