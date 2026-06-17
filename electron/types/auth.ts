import type { Permission, UserRole } from './permission';

export interface UserSession {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: Permission[];
  mustChangePassword: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SecuritySettings {
  autoLockMinutes: number;
}

export const AUTO_LOCK_OPTIONS = [
  { value: 0, label: 'Kapalı' },
  { value: 5, label: '5 dakika' },
  { value: 10, label: '10 dakika' },
  { value: 30, label: '30 dakika' },
  { value: 60, label: '1 saat' },
] as const;
