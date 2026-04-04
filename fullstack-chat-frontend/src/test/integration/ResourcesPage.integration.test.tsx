import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ResourcesPage from '../../pages/ResourcesPage';
import { resourcesApi } from '../../api/resources';
import { renderWithProviders } from '../test-utils';

vi.mock('../../api/resources', () => ({
  resourcesApi: {
    searchBooks: vi.fn(),
  },
}));

describe('ResourcesPage', () => {
  it('loads and renders public resources', async () => {
    vi.mocked(resourcesApi.searchBooks).mockResolvedValueOnce({
      query: 'meeting productivity',
      items: [
        {
          id: 'book-1',
          title: 'Deep Work',
          authors: ['Cal Newport'],
          description: 'Focus guide',
          resource_url: 'https://books.example/deep-work',
          thumbnail_url: null,
          published_date: '2016',
          categories: ['Productivity'],
          source: 'google_books',
        },
      ],
      total: 1,
      source: 'google_books',
      cached: false,
      fetched_at: '2026-04-04T10:00:00Z',
    });

    renderWithProviders(<ResourcesPage />, { route: '/resources' });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(resourcesApi.searchBooks).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Deep Work')).toBeInTheDocument();
  });

  it('shows graceful fallback when the provider is unavailable', async () => {
    vi.mocked(resourcesApi.searchBooks).mockRejectedValueOnce({
      response: { data: { detail: 'Provider offline' } },
    });

    renderWithProviders(<ResourcesPage />, { route: '/resources' });

    await waitFor(() => {
      expect(resourcesApi.searchBooks).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Provider offline')).toBeInTheDocument();
    expect(screen.getByText('Crucial Conversations')).toBeInTheDocument();
  });

  it('submits a new search query from the form', async () => {
    const user = userEvent.setup();

    vi.mocked(resourcesApi.searchBooks)
      .mockResolvedValueOnce({
        query: 'meeting productivity',
        items: [],
        total: 0,
        source: 'google_books',
        cached: false,
        fetched_at: '2026-04-04T10:00:00Z',
      })
      .mockResolvedValueOnce({
        query: 'facilitation',
        items: [
          {
            id: 'book-2',
            title: 'Facilitator Guide',
            authors: ['Jane Doe'],
            description: 'Workshop materials',
            resource_url: 'https://books.example/facilitator',
            thumbnail_url: null,
            published_date: '2024',
            categories: ['Workshops'],
            source: 'google_books',
          },
        ],
        total: 1,
        source: 'google_books',
        cached: false,
        fetched_at: '2026-04-04T10:00:00Z',
      });

    const { container } = renderWithProviders(<ResourcesPage />, { route: '/resources' });

    await waitFor(() => {
      expect(resourcesApi.searchBooks).toHaveBeenCalledTimes(1);
    });

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'facilitation');

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(resourcesApi.searchBooks).toHaveBeenLastCalledWith('facilitation', 6);
    });
    expect(await screen.findByText('Facilitator Guide')).toBeInTheDocument();
  });
});
