// src/types/auth.ts

export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';

export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
  is_active: boolean;
  role: UserRole;        // Роль пользователя
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  confirmPassword?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}