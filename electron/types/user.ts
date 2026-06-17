import type { Permission, UserRole } from './permission';

export interface UserRecord {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  permissions: Permission[] | null;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UserInput {
  full_name: string;
  username: string;
  password?: string;
  role: UserRole;
  phone?: string;
  email?: string;
  permissions?: Permission[];
  is_active?: boolean;
}

export interface UserListItem {
  id: number;
  full_name: string;
  username: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  is_active: number;
  last_login_at: string | null;
}
