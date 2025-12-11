import { api } from '.';
import { Chat, Message, AIResponse } from '../types';

export const chatApi = {
  // Получить все чаты пользователя
  getChats: async (): Promise<Chat[]> => {
    const response = await api.get<Chat[]>('/chats');
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