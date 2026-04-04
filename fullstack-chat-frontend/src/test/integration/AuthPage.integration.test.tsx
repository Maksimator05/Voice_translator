import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AuthPage from '../../pages/AuthPage';
import { authApi } from '../../api/auth';
import { renderWithProviders } from '../test-utils';

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

describe('AuthPage', () => {
  it('shows registration fields when switching modes', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
      </Routes>,
      {
        route: '/auth',
        preloadedState: {
          auth: { user: null, token: null, isLoading: false, error: null },
          chat: {
            chats: [],
            currentChat: null,
            isLoading: false,
            isSending: false,
            error: null,
            pagination: null,
          },
        },
      }
    );

    await user.click(screen.getByRole('button', { name: /регистрация/i }));

    expect(screen.getByLabelText(/имя пользователя/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/подтвердите пароль/i)).toBeInTheDocument();
  });

  it('logs in as guest and navigates to chats', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.guestLogin).mockResolvedValueOnce({
      access_token: 'guest-access',
      refresh_token: 'guest-refresh',
      token_type: 'bearer',
      user: {
        id: 99,
        email: 'guest@example.com',
        username: 'guest-user',
        created_at: '2026-04-04T10:00:00Z',
        is_active: true,
        role: 'guest',
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/chats" element={<div>Chats stub</div>} />
      </Routes>,
      {
        route: '/auth',
        preloadedState: {
          auth: { user: null, token: null, isLoading: false, error: null },
          chat: {
            chats: [],
            currentChat: null,
            isLoading: false,
            isSending: false,
            error: null,
            pagination: null,
          },
        },
      }
    );

    await user.click(screen.getByRole('button', { name: /гость/i }));

    expect(await screen.findByText('Chats stub')).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBe('guest-access');
  });
});
