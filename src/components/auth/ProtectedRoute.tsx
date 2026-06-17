import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { Permission } from '@/types/auth';
import { ROUTE_PERMISSIONS } from '@/types/auth';

export default function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: Permission | Permission[] | null;
}) {
  const { session, hasPermission } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const basePath = '/' + (location.pathname.split('/').filter(Boolean)[0] || 'dashboard');
  const required = permission !== undefined ? permission : ROUTE_PERMISSIONS[basePath];

  if (required) {
    const perms = Array.isArray(required) ? required : [required];
    if (!perms.some((p) => hasPermission(p))) {
      return (
        <div className="page-content">
          <div className="alert alert-error">Bu işlem için yetkiniz yok.</div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
