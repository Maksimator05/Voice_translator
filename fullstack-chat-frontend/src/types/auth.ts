export interface User {
  id: number;
  email: string;
  username: string;
  created_at: string;
  is_active: boolean;
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
  confirmPassword?: string; // Для фронтенда
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}