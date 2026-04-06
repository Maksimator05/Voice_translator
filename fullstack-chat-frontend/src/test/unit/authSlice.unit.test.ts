import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, {
  clearError,
  clearUser,
  fetchCurrentUser,
  guestLogin,
  login,
  logout,
  register,
  restoreAuth,
} from '../../store/authSlice';
import { authApi } from '../../api/auth';
import type { TokenResponse, User } from '../../types';

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

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'user@example.com',
    username: 'user',
    created_at: '2026-04-04T10:00:00Z',
    is_active: true,
    role: 'user',
    ...overrides,
  };
}

function buildTokenResponse(overrides: Partial<TokenResponse> = {}): TokenResponse {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user: buildUser(),
    ...overrides,
  };
}

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('stores tokens and user data after successful login', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(buildTokenResponse());

    const store = createAuthStore();
    await store.dispatch(login({ email: 'user@example.com', password: 'StrongPass123!' }));

    expect(store.getState().auth.token).toBe('access-token');
    expect(store.getState().auth.user?.email).toBe('user@example.com');
    expect(localStorage.getItem('access_token')).toBe('access-token');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-token');
  });

  it('stores tokens after successful registration', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce(
      buildTokenResponse({
        access_token: 'register-access',
        refresh_token: 'register-refresh',
        user: buildUser({ email: 'new@example.com', username: 'new-user' }),
      })
    );

    const store = createAuthStore();
    await store.dispatch(
      register({
        email: 'new@example.com',
        username: 'new-user',
        password: 'StrongPass123!',
      })
    );

    expect(store.getState().auth.user?.username).toBe('new-user');
    expect(store.getState().auth.token).toBe('register-access');
    expect(localStorage.getItem('refresh_token')).toBe('register-refresh');
  });

  it('stores guest session after guest login', async () => {
    vi.mocked(authApi.guestLogin).mockResolvedValueOnce(
      buildTokenResponse({
        access_token: 'guest-access',
        refresh_token: 'guest-refresh',
        user: buildUser({
          id: 99,
          email: 'guest@example.com',
          username: 'guest',
          role: 'guest',
        }),
      })
    );

    const store = createAuthStore();
    await store.dispatch(guestLogin());

    expect(store.getState().auth.user?.role).toBe('guest');
    expect(store.getState().auth.token).toBe('guest-access');
    expect(localStorage.getItem('user')).toContain('"role":"guest"');
  });

  it('stores rejected login error in state', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { data: { detail: 'Invalid credentials' } },
    });

    const store = createAuthStore();
    await store.dispatch(login({ email: 'user@example.com', password: 'wrong' }));

    expect(store.getState().auth.error).toBe('Invalid credentials');
    expect(store.getState().auth.isLoading).toBe(false);
  });

  it('uses fallback message when guest login fails without response payload', async () => {
    vi.mocked(authApi.guestLogin).mockRejectedValueOnce(new Error('network down'));

    const store = createAuthStore();
    await store.dispatch(guestLogin());

    expect(store.getState().auth.error).toBe('Guest login failed');
  });

  it('restores an existing session from localStorage', () => {
    localStorage.setItem('access_token', 'restored-token');
    localStorage.setItem('refresh_token', 'restored-refresh');
    localStorage.setItem(
      'user',
      JSON.stringify(buildUser({ id: 2, email: 'restored@example.com', role: 'admin' }))
    );

    const store = createAuthStore();
    store.dispatch(restoreAuth());

    expect(store.getState().auth.token).toBe('restored-token');
    expect(store.getState().auth.user?.role).toBe('admin');
  });

  it('removes corrupted session data when restoreAuth cannot parse user JSON', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    localStorage.setItem('access_token', 'broken-token');
    localStorage.setItem('refresh_token', 'broken-refresh');
    localStorage.setItem('user', '{not-valid-json');

    const store = createAuthStore();
    store.dispatch(restoreAuth());

    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it('updates current user data on successful session refresh', async () => {
    localStorage.setItem('access_token', 'active-access');
    localStorage.setItem('refresh_token', 'active-refresh');
    localStorage.setItem('user', JSON.stringify(buildUser({ username: 'stale-user' })));

    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(
      buildUser({
        username: 'fresh-user',
        email: 'fresh@example.com',
      })
    );

    const store = createAuthStore();
    store.dispatch(restoreAuth());
    await store.dispatch(fetchCurrentUser());

    expect(store.getState().auth.user?.username).toBe('fresh-user');
    expect(localStorage.getItem('user')).toContain('"username":"fresh-user"');
  });

  it('clears stored session data when current-user request fails', async () => {
    localStorage.setItem('access_token', 'expired-access');
    localStorage.setItem('refresh_token', 'expired-refresh');
    localStorage.setItem('user', JSON.stringify(buildUser({ id: 3, username: 'expired' })));

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

  it('clears tokens locally on logout even when server logout fails', async () => {
    localStorage.setItem('access_token', 'active-access');
    localStorage.setItem('refresh_token', 'active-refresh');
    localStorage.setItem('user', JSON.stringify(buildUser()));

    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('server unavailable'));

    const store = createAuthStore();
    store.dispatch(restoreAuth());
    await store.dispatch(logout());

    expect(authApi.logout).toHaveBeenCalledWith('active-refresh');
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('supports explicit clearError and clearUser reducers', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { data: { detail: 'Invalid credentials' } },
    });

    const store = createAuthStore();
    await store.dispatch(login({ email: 'user@example.com', password: 'wrong' }));

    store.dispatch(clearError());
    expect(store.getState().auth.error).toBeNull();

    localStorage.setItem('access_token', 'access-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('user', JSON.stringify(buildUser()));

    store.dispatch(restoreAuth());
    store.dispatch(clearUser());

    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.token).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
