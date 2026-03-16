import { api } from '.';
import { Chat, Message, AIResponse, ChatSessionListResponse } from '../types';

export interface ChatFilters {
  search?: string;
  session_type?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
  paginate?: boolean;
}

export interface PaginatedChats {
  items: ChatSessionListResponse[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export const chatApi = {
  // Получить все чаты пользователя (с опциональной фильтрацией и пагинацией)
  getChats: async (filters?: ChatFilters): Promise<ChatSessionListResponse[] | PaginatedChats> => {
    const params: Record<string, any> = {};
    if (filters) {
      if (filters.search) params.search = filters.search;
      if (filters.session_type) params.session_type = filters.session_type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_order) params.sort_order = filters.sort_order;
      if (filters.page) params.page = filters.page;
      if (filters.page_size) params.page_size = filters.page_size;
      if (filters.paginate !== undefined) params.paginate = filters.paginate;
    }
    const response = await api.get('/chats', { params });
    return response.data;
  },

  // Получить конкретный чат с сообщениями
  getChat: async (chatId: number): Promise<Chat> => {
    const response = await api.get<Chat>(`/chats/${chatId}`);
    return response.data;
  },

  // Создать новый чат
  createChat: async (title?: string, session_type: 'text' | 'audio' | 'meeting' = 'text'): Promise<Chat> => {
    const response = await api.post<Chat>('/chats', {
      title: title || 'New Chat',
      session_type,
    });
    return response.data;
  },

  // Удалить чат
  deleteChat: async (chatId: number): Promise<void> => {
    await api.delete(`/chats/${chatId}`);
  },

  // Отправить текстовое сообщение
  sendMessage: async (chatId: number, content: string, message_type: 'text' | 'audio' = 'text'): Promise<Message> => {
    const response = await api.post<Message>(`/chats/${chatId}/messages`, {
      content,
      role: 'user',
      message_type
    });
    return response.data;
  },

  // Отправить запрос AI (текст или аудио)
  askAI: async (chatId: number, message?: string, audioFile?: File): Promise<AIResponse> => {
    const formData = new FormData();

    if (message) {
      formData.append('message', message);
    }

    if (audioFile) {
      formData.append('audio_file', audioFile);
    }

    const response = await api.post<AIResponse>(
      `/chats/${chatId}/ask`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Отправить аудио сообщение как base64
  sendAudioMessage: async (chatId: number, audioBase64: string, message?: string): Promise<Message> => {
    const response = await api.post<Message>(`/chats/${chatId}/messages`, {
      content: message || '[Audio message]',
      role: 'user',
      message_type: 'audio',
      audio_data: audioBase64
    });
    return response.data;
  },
};