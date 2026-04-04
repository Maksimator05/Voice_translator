import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../../pages/LandingPage';
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

describe('LandingPage guest flow', () => {
  it('starts guest session and opens chats', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.guestLogin).mockResolvedValueOnce({
      access_token: 'guest-access',
      refresh_token: 'guest-refresh',
      token_type: 'bearer',
      user: {
        id: 5,
        email: 'guest@example.com',
        username: 'guest-user',
        created_at: '2026-04-04T10:00:00Z',
        is_active: true,
        role: 'guest',
      },
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chats" element={<div>Chats stub</div>} />
        <Route path="/auth" element={<div>Auth stub</div>} />
      </Routes>,
      {
        route: '/',
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

    await user.click(screen.getAllByRole('button', { name: /начать работу/i })[1]);

    expect(await screen.findByText('Chats stub')).toBeInTheDocument();
    expect(authApi.guestLogin).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('access_token')).toBe('guest-access');
  });

  it('opens chats directly for an authenticated user', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chats" element={<div>Chats stub</div>} />
      </Routes>,
      {
        route: '/',
        preloadedState: {
          auth: {
            user: {
              id: 7,
              email: 'user@example.com',
              username: 'user',
              created_at: '2026-04-04T10:00:00Z',
              is_active: true,
              role: 'user',
            },
            token: 'user-token',
            isLoading: false,
            error: null,
          },
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

    await user.click(screen.getByRole('button', { name: /открыть чаты/i }));

    expect(await screen.findByText('Chats stub')).toBeInTheDocument();
    expect(authApi.guestLogin).not.toHaveBeenCalled();
  });
});
