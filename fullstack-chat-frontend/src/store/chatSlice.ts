import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatApi } from '../api/chat';
import { Chat, ChatState, Message, ChatSessionListResponse, AIResponse } from '../types';
import { webSocketService } from '../api/websocket';

const initialState: ChatState = {
  chats: [],
  currentChat: null,
  isLoading: false,
  isSending: false,
  error: null,
};

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
      // Отправляем сообщение через WebSocket для мгновенного отображения
      webSocketService.sendMessage(chatId, content, messageType);

      // Отправляем через API
      const message = await chatApi.sendMessage(chatId, content, messageType);

      // Обновляем текущий чат
      dispatch(addMessageToCurrentChat(message));

      return { chatId, message };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to send message');
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
      const response = await chatApi.askAI(chatId, message, audioFile);

      // Добавляем сообщения в текущий чат
      dispatch(addMessageToCurrentChat(response.user_message));
      dispatch(addMessageToCurrentChat(response.ai_response));

      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to get AI response');
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentChat: (state, action: PayloadAction<Chat | null>) => {
      state.currentChat = action.payload;
      if (action.payload) {
        // Присоединяемся к WebSocket комнате чата
        webSocketService.joinChat(action.payload.id);
      }
    },

    addMessageToCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat) {
        state.currentChat.messages.push(action.payload);
      }
    },

    updateMessageInCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat) {
        const index = state.currentChat.messages.findIndex(msg => msg.id === action.payload.id);
        if (index !== -1) {
          state.currentChat.messages[index] = action.payload;
        }
      }
    },

    clearError: (state) => {
      state.error = null;
    },

    // WebSocket events
    handleNewMessage: (state, action: PayloadAction<{ chat_id: number; message: Message }>) => {
      if (state.currentChat?.id === action.payload.chat_id) {
        state.currentChat.messages.push(action.payload.message);
      }

      // Обновляем список чатов
      const chatIndex = state.chats.findIndex(chat => chat.id === action.payload.chat_id);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          last_message: action.payload.message.content.substring(0, 50),
          updated_at: action.payload.message.created_at
        };
      }
    },

    handleChatUpdated: (state, action: PayloadAction<{ chat_id: number; chat: Chat }>) => {
      if (state.currentChat?.id === action.payload.chat_id) {
        state.currentChat = action.payload.chat;
      }
    },
  },
  extraReducers: (builder) => {
    builder
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
      })
      // Create chat
      .addCase(createChat.fulfilled, (state, action: PayloadAction<Chat>) => {
        state.chats.unshift({
          id: action.payload.id,
          title: action.payload.title,
          created_at: action.payload.created_at,
          updated_at: action.payload.updated_at,
          last_message: action.payload.messages[0]?.content,
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
      });
  },
});

export const {
  setCurrentChat,
  addMessageToCurrentChat,
  updateMessageInCurrentChat,
  clearError,
  handleNewMessage,
  handleChatUpdated
} = chatSlice.actions;

// ДОЛЖНО БЫТЬ default export
export default chatSlice.reducer