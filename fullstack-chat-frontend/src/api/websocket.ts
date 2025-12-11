import { Message, Chat } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    const url = `${WS_URL}/ws?token=${token}`;
    this.ws = new WebSocket(url);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emitEvent('connected');

      // Ping для поддержания соединения
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send({ type: 'ping' });
        }
      }, 30000);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.emitEvent('disconnected', { code: event.code, reason: event.reason });

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Автоматическое переподключение
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);

        this.reconnectTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            // Получаем токен из localStorage
            const token = localStorage.getItem('access_token');
            if (token) {
              this.connect(token);
            }
          }
        }, 3000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emitEvent('error', { error: 'Connection error' });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emitEvent(data.type, data);

        // Обработка pong
        if (data.type === 'pong') {
          this.emitEvent('heartbeat');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error, event.data);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data));
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send: WebSocket not connected');
    }
  }

  // Специфичные методы для нашего приложения
  sendMessage(chatId: number, content: string, messageType: 'text' | 'audio' = 'text') {
    this.send({
      type: 'send_message',
      chat_id: chatId,
      content,
      message_type: messageType,
      timestamp: new Date().toISOString()
    });
  }

  joinChat(chatId: number) {
    this.send({
      type: 'join_chat',
      chat_id: chatId
    });
  }

  leaveChat(chatId: number) {
    this.send({
      type: 'leave_chat',
      chat_id: chatId
    });
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();