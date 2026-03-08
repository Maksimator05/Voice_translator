import { api } from '.';
import { LoginCredentials, RegisterCredentials, TokenResponse, User } from '../types';

export const authApi = {
  register: async (credentials: RegisterCredentials): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/register', {
      email: credentials.email,
      username: credentials.username,
      password: credentials.password
    });
    return response.data;
  },

  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login', {
      email: credentials.email,
      password: credentials.password
    });
    return response.data;
  },

  // Вход как гость — без регистрации, лимит 3 расшифровки
  guestLogin: async (): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/guest-login', {});
    return response.data;
  },

  // Обновление access token через refresh token (ротация токенов)
  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  // Серверный logout: отзывает refresh token в БД
  logout: async (refreshToken: string): Promise<void> => {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Игнорируем ошибку — локальная очистка всё равно произойдёт
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};