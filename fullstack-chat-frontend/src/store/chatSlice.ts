import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { chatApi } from '../api/chat';
import { Chat, ChatState, Message, ChatSessionListResponse } from '../types';

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
      return await chatApi.getChats();
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch chats');
    }
  }
);

export const fetchChat = createAsyncThunk(
  'chat/fetchChat',
  async (chatId: number, { rejectWithValue }) => {
    try {
      return await chatApi.getChat(chatId);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch chat');
    }
  }
);

export const createChat = createAsyncThunk(
  'chat/createChat',
  async (
    params: { title?: string; session_type?: 'text' | 'audio' | 'meeting' } | string = {},
    { rejectWithValue }
  ) => {
    try {
      // Поддерживаем вызов как со строкой (заголовок), так и с объектом
      const title = typeof params === 'string' ? params : params.title;
      const session_type = typeof params === 'string' ? 'text' : (params.session_type ?? 'text');
      return await chatApi.createChat(title, session_type);
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
    const tempMessage: Message = {
      id: Date.now(),
      chat_id: chatId,
      content,
      message_type: messageType,
      is_user: true,
      role: 'user',
      created_at: new Date().toISOString(),
      audio_url: null,
    };

    dispatch(addMessageToCurrentChat(tempMessage));

    try {
      const message = await chatApi.sendMessage(chatId, content, messageType);
      dispatch(updateMessageInCurrentChat(message));
      return { chatId, message };
    } catch (error: any) {
      dispatch(removeTempMessage(tempMessage.id as number));
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
      if (message) {
        const tempUserMessage: Message = {
          id: Date.now(),
          chat_id: chatId,
          content: message,
          message_type: 'text',
          is_user: true,
          role: 'user',
          created_at: new Date().toISOString(),
          audio_url: null,
        };
        dispatch(addMessageToCurrentChat(tempUserMessage));
      }

      const response = await chatApi.askAI(chatId, message, audioFile);

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

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentChat: (state, action: PayloadAction<Chat | null>) => {
      state.currentChat = action.payload;
    },

    addMessageToCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat) {
        const messageExists = state.currentChat.messages?.some(
          (msg) => msg.id === action.payload.id
        );
        if (!messageExists) {
          if (!state.currentChat.messages) state.currentChat.messages = [];
          state.currentChat.messages.push(action.payload);
          state.currentChat.updated_at = new Date().toISOString();
        }
      }
    },

    updateMessageInCurrentChat: (state, action: PayloadAction<Message>) => {
      if (state.currentChat?.messages) {
        const index = state.currentChat.messages.findIndex(
          (msg) => msg.id === action.payload.id
        );
        if (index !== -1) {
          state.currentChat.messages[index] = action.payload;
        } else {
          state.currentChat.messages.push(action.payload);
        }
        state.currentChat.updated_at = new Date().toISOString();
      }
    },

    removeTempMessage: (state, action: PayloadAction<number>) => {
      if (state.currentChat?.messages) {
        state.currentChat.messages = state.currentChat.messages.filter(
          (msg) => msg.id !== action.payload
        );
      }
    },

    clearError: (state) => {
      state.error = null;
    },

    addMessageFromPolling: (state, action: PayloadAction<Message>) => {
      const message = action.payload;

      const currentChat = state.currentChat;
      if (currentChat && currentChat.id === message.chat_id) {
        const messageExists = currentChat.messages?.some((msg) => msg.id === message.id);
        if (!messageExists) {
          if (!currentChat.messages) currentChat.messages = [];
          currentChat.messages.push(message);
          currentChat.updated_at = new Date().toISOString();
        }
      }

      const chatIndex = state.chats.findIndex((chat) => chat.id === message.chat_id);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          last_message: message.content.substring(0, 50),
          updated_at: message.created_at,
        };
      }
    },

    updateChatFromPolling: (state, action: PayloadAction<ChatSessionListResponse>) => {
      const updatedChat = action.payload;
      const index = state.chats.findIndex((chat) => chat.id === updatedChat.id);
      if (index !== -1) {
        state.chats[index] = updatedChat;
      } else {
        state.chats.push(updatedChat);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(deleteChat.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteChat.fulfilled, (state, action: PayloadAction<number>) => {
        state.isLoading = false;
        state.chats = state.chats.filter((chat) => chat.id !== action.payload);
        if (state.currentChat?.id === action.payload) {
          state.currentChat = null;
        }
      })
      .addCase(deleteChat.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
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
      .addCase(fetchChat.fulfilled, (state, action: PayloadAction<Chat>) => {
        state.currentChat = action.payload;
      })
      .addCase(createChat.fulfilled, (state, action: PayloadAction<Chat>) => {
        state.chats.unshift({
          id: action.payload.id,
          title: action.payload.title,
          session_type: action.payload.session_type,
          created_at: action.payload.created_at,
          updated_at: action.payload.updated_at,
          last_message: undefined,
          message_count: 0,
        });
        state.currentChat = action.payload;
      })
      .addCase(sendMessage.pending, (state) => {
        state.isSending = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.isSending = false;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSending = false;
        state.error = action.payload as string;
      })
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
  removeTempMessage,
  clearError,
  addMessageFromPolling,
  updateChatFromPolling,
} = chatSlice.actions;

export default chatSlice.reducer;
