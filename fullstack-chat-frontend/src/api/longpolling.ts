// src/api/longpolling.ts
import axios, { CancelTokenSource } from 'axios';
import { store } from "../store";
import { addMessageFromPolling } from "../store/chatSlice";

type EventCallback = (data: any) => void;

class LongPollingService {
  private userId: number | null = null;
  private cancelTokenSource: CancelTokenSource | null = null;
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private retryDelay = 1000;
  private lastUpdateTime = new Date().toISOString();
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private pollingActive = false;

  // Методы для событий
  on(event: string, callback: EventCallback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  startPolling(userId: number) {
    if (this.pollingActive && this.userId === userId) {
      console.log('Long Polling already running for user:', userId);
      return;
    }

    // Останавливаем предыдущий polling если есть
    this.stopPolling();

    console.log('Long Polling started for user:', userId);
    this.userId = userId;
    this.pollingActive = true;
    this.retryCount = 0;
    this.lastUpdateTime = new Date().toISOString();

    void this.pollForUpdates();
  }

  private async pollForUpdates() {
    if (!this.pollingActive || !this.userId) {
      console.log('Polling not active or no user ID');
      return;
    }

    try {
      // Отменяем предыдущий запрос, если он существует
      if (this.cancelTokenSource) {
        this.cancelTokenSource.cancel('New polling request');
      }

      this.cancelTokenSource = axios.CancelToken.source();

      console.log('Polling for user:', this.userId, 'since:', this.lastUpdateTime);

      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No access token found');
        this.stopPolling();
        return;
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await axios.get(
        `${baseUrl}/longpolling/updates`,
        {
          params: {
            user_id: this.userId,
            since: this.lastUpdateTime
          },
          cancelToken: this.cancelTokenSource.token,
          timeout: 30000,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Polling response:', response.data);

      // Обновляем время последнего обновления
      if (response.data.last_update) {
        this.lastUpdateTime = response.data.last_update;
      }

      // Обрабатываем обновления
      if (response.data.updates && Array.isArray(response.data.updates) && response.data.updates.length > 0) {
        response.data.updates.forEach((update: any) => {
          console.log('Processing update:', update);

          if (update.type === 'new_message' && update.data && update.data.message) {
            const messageData = update.data.message;
            // Создаем корректный объект сообщения
            const isUser = messageData.is_user || messageData.role === 'user';
            const message = {
              id: messageData.id,
              chat_id: update.data.chat_id,
              content: messageData.content || '',
              message_type: (messageData.message_type || 'text') as 'text' | 'audio',
              role: (isUser ? 'user' : 'assistant') as 'user' | 'assistant',
              is_user: isUser,
              created_at: messageData.created_at || new Date().toISOString(),
              audio_url: null as string | null,
              audio_filename: messageData.audio_filename,
              audio_transcription: messageData.audio_transcription,
            };

            console.log('Dispatching message to store:', message);
            store.dispatch(addMessageFromPolling(message));
            this.emit('new_message', {
              message: {
                ...message,
                chat_id: update.data.chat_id
              },
              chat_id: update.data.chat_id
            });
          }
        });
      }

      // Сбрасываем счетчик попыток при успехе
      this.retryCount = 0;

      // Запускаем следующий запрос с небольшой задержкой
      if (this.pollingActive) {
        setTimeout(() => void this.pollForUpdates(), 100);
      }

    } catch (error: any) {
      if (axios.isCancel(error)) {
        console.log('Polling canceled:', error.message);
        return;
      }

      console.error('Long Polling error:', error.message);

      // Если ошибка 401 - неавторизован, останавливаем polling
      if (error.response?.status === 401) {
        console.error('Unauthorized. Stopping polling.');
        this.stopPolling();
        return;
      }

      this.retryCount++;

      if (this.retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        console.log(`Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);

        if (this.pollingActive) {
          this.pollingTimeout = setTimeout(() => void this.pollForUpdates(), delay);
        }
      } else {
        console.error('Max retries reached. Stopping polling.');
        this.stopPolling();
      }
    }
  }

  stopPolling() {
    console.log('Long Polling stopped');
    this.pollingActive = false;
    this.userId = null;
    this.retryCount = 0;

    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('Polling stopped');
      this.cancelTokenSource = null;
    }

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  isActive() {
    return this.pollingActive;
  }

  removeAllListeners(event?: string) {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }
}

export const longPollingService = new LongPollingService();