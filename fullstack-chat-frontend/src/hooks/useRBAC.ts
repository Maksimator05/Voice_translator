// src/hooks/useRBAC.ts
// Хук для проверки прав доступа на фронтенде

import { useAppSelector } from './useRedux';
import { UserRole } from '../types/auth';

// Иерархия ролей (чем выше число, тем больше прав)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  moderator: 2,
  admin: 3,
};

export function useRBAC() {
  const user = useAppSelector((state) => state.auth.user);
  const role: UserRole = user?.role ?? 'guest';

  /**
   * Проверяет, есть ли у пользователя хотя бы одна из указанных ролей
   */
  const hasRole = (...roles: UserRole[]): boolean => {
    return roles.includes(role);
  };

  /**
   * Проверяет, что роль пользователя >= минимально требуемой
   */
  const hasMinRole = (minRole: UserRole): boolean => {
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
  };

  return {
    role,
    isGuest: role === 'guest',
    isUser: role === 'user',
    isModerator: role === 'moderator',
    isAdmin: role === 'admin',

    // Составные разрешения
    canCreateChat: hasMinRole('user'),
    canDeleteOwnChat: hasMinRole('user'),
    canDeleteAnyChat: hasRole('moderator', 'admin'),
    canViewAllChats: hasRole('moderator', 'admin'),
    canManageUsers: hasRole('admin'),
    canSendMessages: hasMinRole('user'),

    hasRole,
    hasMinRole,
  };
}