// src/api/admin.ts
import { api } from './index';
import { User, UserRole } from '../types/auth';

export const adminApi = {
  /** Получить список всех пользователей (только admin) */
  getUsers: async (): Promise<User[]> => {
    const { data } = await api.get<User[]>('/admin/users');
    return data;
  },

  /** Изменить роль пользователя (только admin) */
  updateUserRole: async (userId: number, role: UserRole): Promise<User> => {
    const { data } = await api.patch<User>(`/admin/users/${userId}/role`, { role });
    return data;
  },

  /** Активировать/деактивировать пользователя (только admin) */
  toggleUserActive: async (userId: number, isActive: boolean): Promise<User> => {
    const { data } = await api.patch<User>(
      `/admin/users/${userId}/activate`,
      null,
      { params: { is_active: isActive } }
    );
    return data;
  },
};
