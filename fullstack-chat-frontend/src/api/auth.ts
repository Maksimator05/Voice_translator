import { api } from '.';
import { LoginCredentials, RegisterCredentials, User } from '../types';

export const authApi = {
  register: async (credentials: RegisterCredentials) => {
    const response = await api.post<{
      access_token: string;
      token_type: string;
      user: User;
    }>('/auth/register', {
      email: credentials.email,
      username: credentials.username,
      password: credentials.password
    });
    return response.data;
  },

  login: async (credentials: LoginCredentials) => {
    const response = await api.post<{
      access_token: string;
      token_type: string;
      user: User;
    }>('/auth/login', {
      email: credentials.email,
      password: credentials.password
    });
    return response.data;
  },

  // Вход как гость — без регистрации, лимит 3 расшифровки
  guestLogin: async () => {
    const response = await api.post<{
      access_token: string;
      token_type: string;
      user: User;
    }>('/auth/guest-login', {});
    return response.data;
  },

  logout: async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  getCurrentUser: async () => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};