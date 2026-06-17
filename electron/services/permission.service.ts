import type { Permission, UserRole } from '../types/permission';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../types/permission';

export class PermissionService {
  static resolvePermissions(role: UserRole, customPermissions: Permission[] | null | undefined): Permission[] {
    if (role === 'Yönetici') return ALL_PERMISSIONS;
    if (customPermissions && customPermissions.length > 0) return customPermissions;
    return ROLE_DEFAULT_PERMISSIONS[role] || [];
  }

  static hasPermission(
    role: UserRole,
    customPermissions: Permission[] | null | undefined,
    permission: Permission
  ): boolean {
    const perms = this.resolvePermissions(role, customPermissions);
    return perms.includes(permission);
  }

  static hasAnyPermission(
    role: UserRole,
    customPermissions: Permission[] | null | undefined,
    permissions: Permission[]
  ): boolean {
    return permissions.some((p) => this.hasPermission(role, customPermissions, p));
  }
}
