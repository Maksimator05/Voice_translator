// src/hooks/useRBAC.ts
// Хук для проверки прав доступа на фронтенде

import { useAppSelector } from './useRedux';
import { UserRole } from '../types/auth';

// Лимит бесплатных расшифровок для гостя
export const GUEST_TRANSCRIPTION_LIMIT = 3;

// Ключ для хранения счётчика в localStorage
export const GUEST_USAGE_KEY = 'guest_transcription_count';

// Иерархия ролей
const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  admin: 2,
};

export function useRBAC() {
  const user = useAppSelector((state) => state.auth.user);
  const role: UserRole = user?.role ?? 'guest';

  const hasRole = (...roles: UserRole[]): boolean => roles.includes(role);

  const hasMinRole = (minRole: UserRole): boolean =>
    ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];

  // Получить текущее кол-во использований гостем (из localStorage)
  const getGuestUsageCount = (): number => {
    try {
      return parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  };

  // Увеличить счётчик использований гостем
  const incrementGuestUsage = (): void => {
    if (role === 'guest') {
      const current = getGuestUsageCount();
      localStorage.setItem(GUEST_USAGE_KEY, String(current + 1));
    }
  };

  // Проверить, может ли гость ещё отправить сообщение
  const guestUsageCount = getGuestUsageCount();
  const guestUsageLeft = Math.max(0, GUEST_TRANSCRIPTION_LIMIT - guestUsageCount);
  const guestLimitReached = role === 'guest' && guestUsageCount >= GUEST_TRANSCRIPTION_LIMIT;

  // Может ли пользователь отправлять сообщения
  const canSendMessages = role !== 'guest' || !guestLimitReached;

  return {
    role,
    isGuest: role === 'guest',
    isUser: role === 'user',
    isAdmin: role === 'admin',

    // Права
    canCreateChat: hasMinRole('user'),
    canDeleteOwnChat: hasMinRole('user'),
    canDeleteAnyChat: hasRole('admin'),
    canViewAllChats: hasRole('admin'),
    canManageUsers: hasRole('admin'),
    canSendMessages,

    // Лимит гостя
    guestLimitReached,
    guestUsageCount,
    guestUsageLeft,
    getGuestUsageCount,
    incrementGuestUsage,

    hasRole,
    hasMinRole,
  };
}