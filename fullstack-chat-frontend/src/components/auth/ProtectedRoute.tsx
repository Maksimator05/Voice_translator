import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useRedux';
import { useRBAC } from '../../hooks/useRBAC';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  minRole?: UserRole;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  minRole,
  allowedRoles,
}: ProtectedRouteProps) {
  const token = useAppSelector((state) => state.auth.token);
  const { hasRole, hasMinRole } = useRBAC();

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (minRole && !hasMinRole(minRole)) {
    return <Navigate to="/forbidden" replace />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
