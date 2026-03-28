import { api } from '.';
import { ExternalResourceResponse } from '../types/resources';

export const resourcesApi = {
  searchBooks: async (
    query?: string,
    limit = 6
  ): Promise<ExternalResourceResponse> => {
    const response = await api.get<ExternalResourceResponse>('/resources/books', {
      params: {
        query: query || undefined,
        limit,
      },
    });

    return response.data;
  },
};
