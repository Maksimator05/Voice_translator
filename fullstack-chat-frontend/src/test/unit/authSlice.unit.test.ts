import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { fetchCurrentUser, login, restoreAuth } from '../../store/authSlice';
import { authApi } from '../../api/auth';

vi.mock('../../api/auth', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    guestLogin: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
  },
}));

function createAuthStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
  });
}

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores tokens and user data after successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      user: {
        id: 1,
        email: 'user@example.com',
        username: 'user',
        created_at: '2026-04-04T10:00:00Z',
        is_active: true,
        role: 'user',
      },
    });

    const store = createAuthStore();
    await store.dispatch(login({ email: 'user@example.com', password: 'StrongPass123!' }));

    expect(store.getState().auth.token).toBe('access-token');
    expect(store.getState().auth.user?.email).toBe('user@example.com');
    expect(localStorage.getItem('access_token')).toBe('access-token');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
  });

  it('restores an existing session from localStorage', () => {
    localStorage.setItem('access_token', 'restored-token');
    localStorage.setItem('refresh_token', 'restored-refresh');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 2,
        email: 'restored@example.com',
        username: 'restored',
        created_at: '2026-04-04T10:00:00Z',
        is_active: true,
        role: 'admin',
      })
    );

    const store = createAuthStore();
    store.dispatch(restoreAuth());

    expect(store.getState().auth.token).toBe('restored-token');
    expect(store.getState().auth.user?.role).toBe('admin');
  });

  it('clears stored session data when current-user request fails', async () => {
    localStorage.setItem('access_token', 'expired-access');
    localStorage.setItem('refresh_token', 'expired-refresh');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 3,
        email: 'expired@example.com',
        username: 'expired',
        created_at: '2026-04-04T10:00:00Z',
        is_active: true,
        role: 'user',
      })
    );

    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce({
      response: { data: { detail: 'Token expired' } },
    });

    const store = createAuthStore();
    store.dispatch(restoreAuth());
    await store.dispatch(fetchCurrentUser());

    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
