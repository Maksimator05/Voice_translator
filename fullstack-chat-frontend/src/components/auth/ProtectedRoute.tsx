// src/components/auth/ProtectedRoute.tsx
// Компонент для защиты маршрутов по роли

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useRedux';
import { useRBAC } from '../../hooks/useRBAC';
import { UserRole } from '../../types/auth';
import { Box, Typography } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Минимальная роль для доступа (включительно) */
  minRole?: UserRole;
  /** Конкретные разрешённые роли */
  allowedRoles?: UserRole[];
}

/**
 * Обёртка для роутов:
 * - Если нет токена — редирект на /auth
 * - Если роль не подходит — страница «Доступ запрещён»
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  minRole,
  allowedRoles,
}) => {
  const token = useAppSelector((state) => state.auth.token);
  const { hasRole, hasMinRole } = useRBAC();

  // Не авторизован
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  // Проверка роли
  if (minRole && !hasMinRole(minRole)) {
    return <AccessDenied />;
  }

  if (allowedRoles && !hasRole(...allowedRoles)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

const AccessDenied: React.FC = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    height="100vh"
    gap={2}
  >
    <LockIcon sx={{ fontSize: 64, color: 'error.main' }} />
    <Typography variant="h5" color="error">
      Доступ запрещён
    </Typography>
    <Typography variant="body1" color="text.secondary">
      У вас недостаточно прав для просмотра этой страницы.
    </Typography>
  </Box>
);