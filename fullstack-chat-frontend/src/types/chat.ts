export interface Message {
  id: number | string;
  content: string;
  role: 'user' | 'assistant';
  message_type: 'text' | 'audio';
  created_at: string;
  audio_filename?: string;
  audio_transcription?: string;
  chat_session_id?: number;
}

export interface Chat {
  id: number;
  title: string;
  session_type: 'text' | 'audio' | 'meeting';
  created_at: string;
  updated_at: string;
  messages?: Message[];
  user_id: number;
  last_message?: string;
  message_count?: number;
}

export interface ChatSessionListResponse {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
  session_type: 'text' | 'audio' | 'meeting';
}

export interface ChatState {
  chats: ChatSessionListResponse[];
  currentChat: Chat | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
}

// Тип для ответа от askAI эндпоинта
export interface AIResponse {
  user_message: Message;
  ai_response: Message;
  chat_id: number;
  audio_transcription?: string;
}