import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatApi } from '../api/chat';
import { Chat, ChatState, Message, ChatSessionListResponse, AIResponse } from '../types';

const initialState: ChatState = {
  chats: [],
  currentChat: null,
  isLoading: false,
  isSending: false,
  error: null,
  pollingInterval: null, // Добавляем для хранения ID интервала
};

// Типы для long polling
export interface PollingResponse {
  messages: Message[];
  chats: ChatSessionListResponse[];
  last_update: string;
}

export const fetchChats = createAsyncThunk(
  'chat/fetchChats',
  async (_, { rejectWithValue }) => {
    try {
      const chats = await chatApi.getChats();
      return chats;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch chats');
    }
  }
);

export const fetchChat = createAsyncThunk(
  'chat/fetchChat',
  async (chatId: number, { rejectWithValue }) => {
    try {
      const chat = await chatApi.getChat(chatId);
      return chat;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch chat');
    }
  }
);

export const createChat = createAsyncThunk(
  'chat/createChat',
  async (title?: string, { rejectWithValue }) => {
    try {
      const chat = await chatApi.createChat(title);
      return chat;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create chat');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { chatId, content, messageType = 'text' }: { chatId: number; content: string; messageType?: 'text' | 'audio' },
    { rejectWithValue, dispatch }
  ) => {
    try {
      // Создаем локальное сообщение для мгновенного отображения
      const tempMessage: Message = {
        id: Date.now(), // Временный ID
        chat_id: chatId,
        content,
        message_type: messageType,
        is_user: true,
        created_at: new Date().toISOString(),
        audio_url: null,
      };

      // Добавляем сообщение локально
      dispatch(addMessageToCurrentChat(tempMessage));

      // Отправляем через API
      const message = await chatApi.sendMessage(chatId, content, messageType);

      // Заменяем временное сообщение на реальное
      dispatch(updateMessageInCurrentChat(message));

      return { chatId, message };
    } catch (error: any) {
      // Удаляем временное сообщение при ошибке
      dispatch(removeTempMessage(tempMessageId));
      return rejectWithValue(error.response?.data?.error || 'Failed to send message');
    }
  }
);


export const deleteChat = createAsyncThunk(
  'chat/deleteChat',
  async (chatId: number, { rejectWithValue }) => {
    try {
      await chatApi.deleteChat(chatId);
      return chatId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete chat');
    }
  }
);



export const askAI = createAsyncThunk(
  'chat/askAI',
  async (
    { chatId, message, audioFile }: { chatId: number; message?: string; audioFile?: File },
    { rejectWithValue, dispatch }
  ) => {
    try {
      // Создаем временное сообщение пользователя, если есть текст
      if (message) {
        const tempUserMessage: Message = {
          id: Date.now(),
          chat_id: chatId,
          content: message,
          message_type: 'text',
          is_user: true,
          created_at: new Date().toISOString(),
          audio_url: null,
        };
        dispatch(addMessageToCurrentChat(tempUserMessage));
      }

      const response = await chatApi.askAI(chatId, message, audioFile);

      // Заменяем временные сообщения и добавляем ответ AI
      if (message) {
        dispatch(updateMessageInCurrentChat(response.user_message));
      }
      dispatch(addMessageToCurrentChat(response.ai_response));

      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get AI response');
    }
  }
);

// Long polling thunks
export const startPolling = createAsyncThunk(
  'chat/startPolling',
  async (_, { dispatch, getState }) => {
    const state = getState() as { chat: ChatState };
    const lastUpdate = state.chat.currentChat?.updated_at || new Date().toISOString();

    try {
      const response = await chatApi.pollUpdates(lastUpdate);

      // Обрабатываем новые сообщения
      if (response.messages && response.messages.length > 0) {
        response.messages.forEach((message: Message) => {
          dispatch(addMessageFromPolling(message));
        });
      }

      // Обновляем список чатов
      if (response.chats && response.chats.length > 0) {
        response.chats.forEach((chat: ChatSessionListResponse) => {
          dispatch(updateChatFromPolling(chat));
        });
      }

      return response;
    } catch (error) {
      console.error('Polling error:', error);
      throw error;
    }
  }
);

export const pollChatUpdates = createAsyncThunk(
  'chat/pollChatUpdates',
  async (chatId: number, { dispatch, getState }) => {
    const state = getState() as { chat: ChatState };
    const lastMessageTime = state.chat.currentChat?.messages?.[state.chat.currentChat.messages.length - 1]?.created_at;

    try {
      const updates = await chatApi.pollChatUpdates(chatId, lastMessageTime);

      if (updates.messages && updates.messages.length > 0) {
        updates.messages.forEach((message: Message) => {
          // Добавляем только новые сообщения, которых еще нет в чате
          if (!state.chat.currentChat?.messages.some(m => m.id === message.id)) {
            dispatch(addMessageFromPolling(message));
          }
        });
      }

      return updates;
    } catch (error) {
      console.error('Chat polling error:', error);
      throw error;
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentChat: (state, action: PayloadAction<Chat | null>) => {
      state.currentChat = action.payload;
      // Очищаем предыдущий polling интервал
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
      }
    },

    addMessageToCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat) {
        // Проверяем, нет ли уже такого сообщения (чтобы избежать дубликатов)
        const messageExists = state.currentChat.messages.some(msg => msg.id === action.payload.id);
        if (!messageExists) {
          state.currentChat.messages.push(action.payload);
          state.currentChat.updated_at = new Date().toISOString();
        }
      }
    },

    updateMessageInCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat) {
        const index = state.currentChat.messages.findIndex(msg => msg.id === action.payload.id);
        if (index !== -1) {
          state.currentChat.messages[index] = action.payload;
        } else {
          // Если сообщения нет, добавляем его
          state.currentChat.messages.push(action.payload);
        }
        state.currentChat.updated_at = new Date().toISOString();
      }
    },

    removeTempMessage: (state, action: PayloadAction<number>) => {
      if (state.currentChat) {
        state.currentChat.messages = state.currentChat.messages.filter(
          msg => msg.id !== action.payload
        );
      }
    },

    clearError: (state) => {
      state.error = null;
    },

    // Long polling actions
    addMessageFromPolling: (state, action: PayloadAction<Message>) => {
      const message = action.payload;

      // Добавляем в текущий чат, если он открыт
      if (state.currentChat?.id === message.chat_id) {
        const messageExists = state.currentChat.messages.some(msg => msg.id === message.id);
        if (!messageExists) {
          state.currentChat.messages.push(message);
          state.currentChat.updated_at = new Date().toISOString();
        }
      }

      // Обновляем информацию о чате в списке
      const chatIndex = state.chats.findIndex(chat => chat.id === message.chat_id);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          last_message: message.content.substring(0, 50) + '...',
          updated_at: message.created_at
        };
      }
    },

    updateChatFromPolling: (state, action: PayloadAction<ChatSessionListResponse>) => {
      const updatedChat = action.payload;
      const index = state.chats.findIndex(chat => chat.id === updatedChat.id);

      if (index !== -1) {
        state.chats[index] = updatedChat;
      } else {
        // Если чата нет в списке, добавляем его
        state.chats.push(updatedChat);
      }
    },

    // Управление polling
    startPollingInterval: (state, action: PayloadAction<number>) => {
      // Очищаем предыдущий интервал
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
      }

      const interval = setInterval(() => {
        if (state.currentChat) {
          // Диспатчим polling для текущего чата
          // @ts-ignore - будет диспатчиться через middleware
          state.pollingCallback?.(state.currentChat.id);
        }
      }, action.payload);

      state.pollingInterval = interval;
    },

    stopPollingInterval: (state) => {
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
      }
    },

    setPollingCallback: (state, action: PayloadAction<(chatId: number) => void>) => {
      state.pollingCallback = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
       // Delete chat
      .addCase(deleteChat.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteChat.fulfilled, (state, action: PayloadAction<number>) => {
        state.isLoading = false;
        // Удаляем чат из списка
        state.chats = state.chats.filter(chat => chat.id !== action.payload);
        // Если удаляли текущий чат, сбрасываем его
        if (state.currentChat?.id === action.payload) {
          state.currentChat = null;
        }
      })
      .addCase(deleteChat.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch chats
      .addCase(fetchChats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action: PayloadAction<ChatSessionListResponse[]>) => {
        state.isLoading = false;
        state.chats = action.payload;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch chat
      .addCase(fetchChat.fulfilled, (state, action: PayloadAction<Chat>) => {
        state.currentChat = action.payload;
        // Запускаем polling при открытии чата
        // @ts-ignore - будет запускаться через middleware или компонент
        state.shouldStartPolling = true;
      })
      // Create chat
      .addCase(createChat.fulfilled, (state, action: PayloadAction<Chat>) => {
        state.chats.unshift({
          id: action.payload.id,
          title: action.payload.title,
          created_at: action.payload.created_at,
          updated_at: action.payload.updated_at,
          last_message: action.payload.messages[0]?.content?.substring(0, 50) + '...',
          message_count: action.payload.messages.length
        });
        state.currentChat = action.payload;
      })
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSending = false;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload as string;
      })
      // Ask AI
      .addCase(askAI.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(askAI.fulfilled, (state) => {
        state.isSending = false;
      })
      .addCase(askAI.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload as string;
      })
      // Polling
      .addCase(startPolling.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(startPolling.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(startPolling.rejected, (state) => {
        state.isLoading = false;
      });

  },
});

export const {
  setCurrentChat,
  addMessageToCurrentChat,
  updateMessageInCurrentChat,
  removeTempMessage,
  clearError,
  addMessageFromPolling,
  updateChatFromPolling,
  startPollingInterval,
  stopPollingInterval,
  setPollingCallback,
} = chatSlice.actions;

export default chatSlice.reducer;