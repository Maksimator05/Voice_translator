import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { renderWithProviders } from '../test-utils';

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /auth', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/auth" element={<div>Auth page</div>} />
        <Route
          path="/chats"
          element={
            <ProtectedRoute>
              <div>Private chats</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      {
        route: '/chats',
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

    expect(await screen.findByText('Auth page')).toBeInTheDocument();
  });

  it('redirects users without required role to /forbidden', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/forbidden" element={<div>Forbidden</div>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <div>Admin panel</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      {
        route: '/admin',
        preloadedState: {
          auth: {
            user: {
              id: 1,
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

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('renders protected content for an allowed user', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <div>Admin panel</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      {
        route: '/admin',
        preloadedState: {
          auth: {
            user: {
              id: 2,
              email: 'admin@example.com',
              username: 'admin',
              created_at: '2026-04-04T10:00:00Z',
              is_active: true,
              role: 'admin',
            },
            token: 'admin-token',
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

    expect(await screen.findByText('Admin panel')).toBeInTheDocument();
  });
});
