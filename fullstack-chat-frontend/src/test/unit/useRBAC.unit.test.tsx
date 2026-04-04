import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { GUEST_TRANSCRIPTION_LIMIT, GUEST_USAGE_KEY, useRBAC } from '../../hooks/useRBAC';
import { createTestStore } from '../test-utils';

function createWrapper(preloadedState?: Parameters<typeof createTestStore>[0]) {
  const store = createTestStore(preloadedState);

  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('useRBAC', () => {
  it('calculates guest limits from localStorage', () => {
    localStorage.setItem(GUEST_USAGE_KEY, String(GUEST_TRANSCRIPTION_LIMIT));

    const wrapper = createWrapper({
      auth: {
        user: {
          id: 1,
          email: 'guest@example.com',
          username: 'guest-user',
          created_at: '2026-04-04T10:00:00Z',
          is_active: true,
          role: 'guest',
        },
        token: 'guest-token',
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
    });

    const { result } = renderHook(() => useRBAC(), { wrapper });

    expect(result.current.isGuest).toBe(true);
    expect(result.current.guestLimitReached).toBe(true);
    expect(result.current.guestUsageLeft).toBe(0);
    expect(result.current.canSendMessages).toBe(false);
  });

  it('increments guest usage counter', () => {
    const wrapper = createWrapper({
      auth: {
        user: {
          id: 2,
          email: 'guest2@example.com',
          username: 'guest-two',
          created_at: '2026-04-04T10:00:00Z',
          is_active: true,
          role: 'guest',
        },
        token: 'guest-token',
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
    });

    const { result } = renderHook(() => useRBAC(), { wrapper });

    act(() => {
      result.current.incrementGuestUsage();
    });

    expect(localStorage.getItem(GUEST_USAGE_KEY)).toBe('1');
  });

  it('grants admin permissions and role hierarchy checks', () => {
    const wrapper = createWrapper({
      auth: {
        user: {
          id: 3,
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
    });

    const { result } = renderHook(() => useRBAC(), { wrapper });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.canDeleteAnyChat).toBe(true);
    expect(result.current.hasMinRole('user')).toBe(true);
    expect(result.current.hasRole('admin')).toBe(true);
  });
});
