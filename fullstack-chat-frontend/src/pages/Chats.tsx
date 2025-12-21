import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Button,
  TextField,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Send,
  Add,
  Search,
  MoreVert,
  Delete,
  Edit,
  AttachFile,
  SmartToy,
  Close,
  AudioFile,
  TextSnippet,
  Logout,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { logout } from '../store/authSlice';
import { fetchChats, createChat, askAI, fetchChat, deleteChat } from '../store/chatSlice';
import { longPollingService } from '../api/longpolling';

interface Chat {
  id: number;
  title: string;
  session_type: 'text' | 'audio' | 'meeting';
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
  user_id: number;
  messages?: Message[];
}

interface Message {
  id: number | string;
  content: string;
  role: 'user' | 'assistant';
  message_type: 'text' | 'audio';
  created_at: string;
  audio_filename?: string;
  audio_transcription?: string;
  chat_id?: number;
  is_user?: boolean;
}

// Ключ для localStorage кэша сообщений
const MESSAGES_CACHE_KEY = 'chat_messages_cache';

const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const { chats: storeChats, isLoading, isSending } = useAppSelector((state) => state.chat);

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('New Chat');
  const [newChatType, setNewChatType] = useState<'text' | 'audio' | 'meeting'>('text');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [error, setError] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingInitialized = useRef(false);
  const loadingChatIdRef = useRef<number | null>(null);

  // Проверка авторизации и загрузка чатов
  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }

    loadChats();

    // Восстанавливаем выбранный чат из localStorage при загрузке
    const savedSelectedChatId = localStorage.getItem('selected_chat_id');
    if (savedSelectedChatId && storeChats.length > 0) {
      const chat = storeChats.find(c => c.id === parseInt(savedSelectedChatId));
      if (chat) {
        handleSelectChat(chat);
      }
    }
  }, [token, navigate]);

  // Загрузка чатов из store
  useEffect(() => {
    if (storeChats.length > 0) {
      const typedChats = storeChats.map(chat => ({
        ...chat,
        session_type: chat.session_type || 'text',
        messages: chat.messages || [],
        message_count: chat.message_count || 0
      })) as Chat[];

      setChats(typedChats);

      // Автовыбор первого чата, если нет выбранного
      if (!selectedChat && typedChats.length > 0) {
        const firstChat = typedChats[0];
        handleSelectChat(firstChat);
      }
    }
  }, [storeChats]);

  // Long Polling инициализация
  useEffect(() => {
    if (!user || pollingInitialized.current) return;

    const initPolling = () => {
      console.log('Initializing polling for user:', user.id);
      longPollingService.startPolling(user.id);
      pollingInitialized.current = true;
    };

    const timer = setTimeout(initPolling, 1000);

    return () => {
      clearTimeout(timer);
      if (pollingInitialized.current) {
        console.log('Cleaning up polling');
        longPollingService.stopPolling();
        pollingInitialized.current = false;
      }
    };
  }, [user?.id]);

  // Обработка новых сообщений из polling
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (data: any) => {
      console.log('New message via Long Polling:', data);

      if (!data || !data.message) {
        console.error('Invalid polling data:', data);
        return;
      }

      const { message, chat_id } = data;

      // Нормализуем сообщение
      const normalizedMessage: Message = {
        id: message.id,
        content: message.content || '',
        role: message.role === 'user' ? 'user' : 'assistant',
        message_type: message.message_type || 'text',
        created_at: message.created_at || new Date().toISOString(),
        audio_filename: message.audio_filename,
        audio_transcription: message.audio_transcription,
        chat_id: chat_id || message.chat_id,
        is_user: message.role === 'user',
      };

      // Обновляем сообщения в текущем чате
      if (selectedChat?.id === normalizedMessage.chat_id) {
        setMessages(prev => {
          // Убираем временные сообщения
          const filtered = prev.filter(msg =>
            !(typeof msg.id === 'string' && msg.id.toString().startsWith('temp_'))
          );

          // Проверяем, нет ли уже такого сообщения
          const messageExists = filtered.some(msg =>
            msg.id === normalizedMessage.id
          );

          if (!messageExists) {
            const newMessages = [...filtered, normalizedMessage];
            // Сохраняем в кэш
            saveMessagesToCache(selectedChat.id, newMessages);
            return newMessages;
          }
          return filtered;
        });
      }

      // Обновляем список чатов
      setChats(prev => prev.map(chat => {
        if (chat.id === normalizedMessage.chat_id) {
          return {
            ...chat,
            last_message: normalizedMessage.content?.substring(0, 50) || 'New message',
            updated_at: normalizedMessage.created_at || new Date().toISOString(),
            message_count: (chat.message_count || 0) + 1
          };
        }
        return chat;
      }));
    };

    const handlePollingError = (error: any) => {
      console.error('Polling error:', error);
      setError('Connection error. Reconnecting...');
    };

    longPollingService.on('new_message', handleNewMessage);
    longPollingService.on('error', handlePollingError);

    return () => {
      longPollingService.off('new_message', handleNewMessage);
      longPollingService.off('error', handlePollingError);
    };
  }, [user, selectedChat]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }, 100);
  }, []);

  // Сохранение сообщений в кэш
  const saveMessagesToCache = (chatId: number, messages: Message[]) => {
    try {
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      cache[chatId] = messages;
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving messages to cache:', error);
    }
  };

  // Загрузка сообщений из кэша
  const loadMessagesFromCache = (chatId: number): Message[] => {
    try {
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      return cache[chatId] || [];
    } catch (error) {
      console.error('Error loading messages from cache:', error);
      return [];
    }
  };

  const loadChats = async () => {
    try {
      await dispatch(fetchChats());
    } catch (error: any) {
      console.error('Error loading chats:', error);
      setError(error.response?.data?.detail || 'Failed to load chats');
    }
  };

  const loadChatMessages = async (chatId: number) => {
    if (loadingChatIdRef.current === chatId) return;

    loadingChatIdRef.current = chatId;

    try {
      // Сначала загружаем из кэша для мгновенного отображения
      const cachedMessages = loadMessagesFromCache(chatId);
      if (cachedMessages.length > 0) {
        setMessages(cachedMessages);
      }

      // Затем загружаем с сервера
      const result = await dispatch(fetchChat(chatId)).unwrap();
      if (result && result.messages) {
        const serverMessages = result.messages as Message[];
        setMessages(serverMessages);
        // Сохраняем в кэш
        saveMessagesToCache(chatId, serverMessages);
      }
    } catch (error: any) {
      console.error('Error loading chat messages:', error);
      // Если не удалось загрузить с сервера, используем кэш
      const cachedMessages = loadMessagesFromCache(chatId);
      setMessages(cachedMessages);
    } finally {
      loadingChatIdRef.current = null;
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    // Сохраняем ID выбранного чата в localStorage
    localStorage.setItem('selected_chat_id', chat.id.toString());

    // Загружаем сообщения для этого чата
    await loadChatMessages(chat.id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      content: newMessage.trim(),
      role: 'user',
      message_type: 'text',
      created_at: new Date().toISOString(),
      chat_id: selectedChat.id,
      is_user: true,
    };

    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      saveMessagesToCache(selectedChat.id, newMessages);
      return newMessages;
    });

    const currentMessage = newMessage;
    setNewMessage('');

    try {
      await dispatch(askAI({
        chatId: selectedChat.id,
        message: currentMessage.trim(),
      })).unwrap();

      // Перезагружаем сообщения для обновления временных
      setTimeout(() => {
        loadChatMessages(selectedChat.id);
      }, 1000);

    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.response?.data?.detail || 'Failed to send message');
      // Удаляем оптимистичное сообщение при ошибке
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== optimisticMessage.id);
        saveMessagesToCache(selectedChat.id, filtered);
        return filtered;
      });
    }
  };

  const handleSendAudio = async (audioFile: File) => {
    if (!selectedChat || !user || !audioFile) return;

    setUploadingAudio(true);

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp_audio_${Date.now()}`,
      content: '[Audio message]',
      role: 'user',
      message_type: 'audio',
      created_at: new Date().toISOString(),
      chat_id: selectedChat.id,
      is_user: true,
    };

    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      saveMessagesToCache(selectedChat.id, newMessages);
      return newMessages;
    });

    try {
      await dispatch(askAI({
        chatId: selectedChat.id,
        audioFile,
      })).unwrap();

      // Перезагружаем сообщения
      setTimeout(() => {
        loadChatMessages(selectedChat.id);
      }, 1000);

      // Очищаем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('Error sending audio:', error);
      setError(error.response?.data?.detail || 'Failed to send audio');
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== optimisticMessage.id);
        saveMessagesToCache(selectedChat.id, filtered);
        return filtered;
      });
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateChat = async () => {
    try {
      const result = await dispatch(createChat(newChatTitle)).unwrap();
      if (result) {
        const newChat: Chat = {
          ...result,
          session_type: newChatType,
          messages: [],
          message_count: 0,
        };
        handleSelectChat(newChat);
        setCreateDialogOpen(false);
        setNewChatTitle('New Chat');
        setNewChatType('text');
        // Перезагружаем чаты для обновления списка
        await loadChats();

        // Очищаем кэш для нового чата
        const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
        cache[newChat.id] = [];
        localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error: any) {
      console.error('Error creating chat:', error);
      setError(error.response?.data?.detail || 'Failed to create chat');
    }
  };

  const handleDeleteChatClick = async (chatId: number) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    setChatToDelete(chat);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    setDeleting(true);
    try {
      await dispatch(deleteChat(chatToDelete.id)).unwrap();

      // Очищаем кэш сообщений для удаленного чата
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      delete cache[chatToDelete.id];
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));

      // Если удаляли выбранный чат, выбираем другой
      if (selectedChat?.id === chatToDelete.id) {
        const remainingChats = chats.filter(c => c.id !== chatToDelete.id);
        if (remainingChats.length > 0) {
          handleSelectChat(remainingChats[0]);
        } else {
          setSelectedChat(null);
          setMessages([]);
          localStorage.removeItem('selected_chat_id');
        }
      }

      setDeleteDialogOpen(false);
      setChatToDelete(null);

    } catch (error: any) {
      console.error('Error deleting chat:', error);
      setError(error.response?.data?.detail || 'Failed to delete chat');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    pollingInitialized.current = false;
    longPollingService.stopPolling();
    longPollingService.removeAllListeners();

    // Очищаем кэш при выходе
    localStorage.removeItem(MESSAGES_CACHE_KEY);
    localStorage.removeItem('selected_chat_id');

    await dispatch(logout());
    navigate('/auth', { replace: true });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Проверка типа файла
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (MP3, WAV, M4A, etc.)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Проверка размера файла (максимум 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('Audio file is too large. Maximum size is 50MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Автоматически отправляем файл
    handleSendAudio(file);
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case 'audio': return <AudioFile fontSize="small" />;
      case 'meeting': return <AttachFile fontSize="small" />;
      default: return <TextSnippet fontSize="small" />;
    }
  };

  const getChatTypeColor = (type: string) => {
    switch (type) {
      case 'audio': return '#EC4899';
      case 'meeting': return '#10B981';
      default: return '#7C3AED';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Just now';

      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (minutes < 1) return 'Just now';
      if (hours < 1) return `${minutes}m ago`;
      if (days < 1) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
      });
    } catch (e) {
      return 'Just now';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading && chats.length === 0) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#7C3AED', mb: 2 }} />
          <Typography sx={{ color: '#f1f5f9' }}>
            Loading chats...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#0f172a', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ pt: 2, pb: 4, height: 'calc(100vh - 32px)' }}>
        {/* Скрытый input для выбора файлов */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="audio/*"
          style={{ display: 'none' }}
        />

        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
          }}>
            AI Chat Assistant
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                fontWeight: 'bold'
              }}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ color: '#f1f5f9' }}>
                  {user?.username || 'User'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {user?.email || 'email@example.com'}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              startIcon={<Logout />}
              onClick={handleLogout}
              sx={{
                color: '#f1f5f9',
                borderColor: '#475569',
                '&:hover': {
                  borderColor: '#7C3AED',
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                },
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3} sx={{ height: 'calc(100% - 80px)' }}>
          {/* Chat List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 2,
            }}>
              <Box p={2} borderBottom="1px solid #334155">
                <Typography variant="h6" gutterBottom sx={{ color: '#f1f5f9' }}>
                  Chats ({chats.length})
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Search chats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#0f172a',
                      '& fieldset': {
                        borderColor: '#334155',
                      },
                      '&:hover fieldset': {
                        borderColor: '#475569',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#7C3AED',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: '#f1f5f9',
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box p={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateDialogOpen(true)}
                  sx={{
                    background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                    },
                  }}
                >
                  New Chat
                </Button>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                <List disablePadding>
                  {filteredChats.map((chat) => (
                    <React.Fragment key={`chat_${chat.id}_${chat.updated_at}`}>
                      <ListItem
                        selected={selectedChat?.id === chat.id}
                        onClick={() => handleSelectChat(chat)}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(124, 58, 237, 0.2)',
                            },
                          },
                          '&:hover': {
                            backgroundColor: 'rgba(124, 58, 237, 0.05)',
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            sx={{
                              bgcolor: getChatTypeColor(chat.session_type),
                            }}
                          >
                            {getChatTypeIcon(chat.session_type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                              <Typography variant="subtitle2" noWrap sx={{
                                flex: 1,
                                color: '#f1f5f9',
                                pr: 1
                              }}>
                                {chat.title}
                              </Typography>
                              <Typography variant="caption" sx={{
                                color: '#94a3b8',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatDate(chat.updated_at)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" sx={{
                              color: '#94a3b8',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {chat.last_message || 'No messages yet'}
                              {(chat.message_count || 0) > 0 && (
                                <span> • {chat.message_count} {chat.message_count === 1 ? 'message' : 'messages'}</span>
                              )}
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAnchorEl(e.currentTarget);
                              setSelectedChat(chat);
                            }}
                            sx={{ color: '#94a3b8' }}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" sx={{
                        borderColor: '#334155',
                        opacity: 0.5,
                        mx: 2
                      }} />
                    </React.Fragment>
                  ))}
                </List>
                {filteredChats.length === 0 && (
                  <Box p={4} textAlign="center">
                    <SmartToy sx={{ fontSize: 48, color: '#475569', mb: 2 }} />
                    <Typography variant="body1" sx={{ color: '#94a3b8' }}>
                      No chats found
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => setCreateDialogOpen(true)}
                      sx={{
                        mt: 2,
                        color: '#7C3AED',
                        borderColor: '#7C3AED',
                        '&:hover': {
                          borderColor: '#A78BFA',
                          backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        },
                      }}
                    >
                      Create first chat
                    </Button>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Chat Window */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 2,
            }}>
              {selectedChat ? (
                <>
                  <Box
                    p={2}
                    borderBottom="1px solid #334155"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
                  >
                    <Box display="flex" alignItems="center">
                      <Avatar
                        sx={{
                          bgcolor: getChatTypeColor(selectedChat.session_type),
                          mr: 2,
                        }}
                      >
                        {getChatTypeIcon(selectedChat.session_type)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#f1f5f9' }}>
                          {selectedChat.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {selectedChat.session_type === 'audio' ? 'Audio chat' :
                           selectedChat.session_type === 'meeting' ? 'Meeting analysis' : 'Text chat'}
                           {(selectedChat.message_count || 0) > 0 && (
                             <span> • {selectedChat.message_count} {selectedChat.message_count === 1 ? 'message' : 'messages'}</span>
                           )}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        title="Delete chat"
                        onClick={() => handleDeleteChatClick(selectedChat.id)}
                        sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: '#0f172a',
                      position: 'relative',
                    }}
                  >
                    {messages.length === 0 ? (
                      <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        p: 4
                      }}>
                        <SmartToy sx={{ fontSize: 64, color: '#475569', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#f1f5f9', mb: 2 }}>
                          No messages yet
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, maxWidth: 400 }}>
                          Start the conversation by sending a message or uploading an audio file
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        {messages.map((message, index) => {
                          // Защита от undefined
                          if (!message) return null;

                          // Создаем уникальный ключ
                          const messageKey = message.id
                            ? `msg_${message.id}_${message.created_at}`
                            : `msg_temp_${index}_${Date.now()}`;

                          return (
                            <Box
                              key={messageKey}
                              sx={{
                                display: 'flex',
                                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                                mb: 2,
                                animation: 'fadeIn 0.3s ease-in',
                              }}
                            >
                              <Box
                                sx={{
                                  maxWidth: '70%',
                                  p: 2,
                                  borderRadius: 2,
                                  bgcolor: message.role === 'user'
                                    ? 'rgba(124, 58, 237, 0.1)'
                                    : 'rgba(30, 41, 59, 0.5)',
                                  border: `1px solid ${
                                    message.role === 'user'
                                      ? 'rgba(124, 58, 237, 0.2)'
                                      : 'rgba(124, 58, 237, 0.1)'
                                  }`,
                                }}
                              >
                                <Box display="flex" alignItems="center" mb={0.5}>
                                  {message.role === 'assistant' && (
                                    <SmartToy fontSize="small" sx={{ mr: 0.5, color: '#7C3AED' }} />
                                  )}
                                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    {message.role === 'user' ? 'You' : 'AI Assistant'} • {formatDate(message.created_at)}
                                  </Typography>
                                </Box>
                                {message.message_type === 'audio' ? (
                                  <Box>
                                    <Box display="flex" alignItems="center" mb={1}>
                                      <AudioFile fontSize="small" sx={{ mr: 1, color: '#7C3AED' }} />
                                      <Typography variant="body1" sx={{ color: '#f1f5f9' }}>
                                        Audio message
                                      </Typography>
                                    </Box>
                                    {message.audio_transcription && (
                                      <Box sx={{
                                        mt: 1,
                                        p: 1.5,
                                        backgroundColor: 'rgba(30, 41, 59, 0.3)',
                                        borderRadius: 1,
                                        borderLeft: '3px solid #7C3AED'
                                      }}>
                                        <Typography variant="caption" sx={{
                                          color: '#94a3b8',
                                          display: 'block',
                                          mb: 0.5
                                        }}>
                                          Transcription:
                                        </Typography>
                                        <Typography variant="body2" sx={{
                                          color: '#cbd5e1',
                                          fontStyle: 'italic',
                                          whiteSpace: 'pre-wrap',
                                        }}>
                                          "{message.audio_transcription}"
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                ) : (
                                  <Typography variant="body1" sx={{
                                    color: '#f1f5f9',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                  }}>
                                    {message.content}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                        {(isSending || uploadingAudio) && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'flex-start',
                              mb: 2,
                            }}
                          >
                            <Box
                              sx={{
                                maxWidth: '70%',
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(124, 58, 237, 0.1)',
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={1}>
                                <CircularProgress size={16} sx={{ color: '#94a3b8' }} />
                                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                  {uploadingAudio ? 'Uploading audio...' : 'AI is thinking...'}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        )}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </Box>

                  <Box p={2} borderTop="1px solid #334155">
                    <Grid container spacing={1} alignItems="center">
                      <Grid size="grow">
                        <TextField
                          fullWidth
                          multiline
                          maxRows={4}
                          placeholder="Type your message or upload audio..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          size="small"
                          disabled={isSending || uploadingAudio}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: '#0f172a',
                              '& fieldset': {
                                borderColor: '#334155',
                              },
                              '&:hover fieldset': {
                                borderColor: '#475569',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#7C3AED',
                              },
                            },
                            '& .MuiInputBase-input': {
                              color: '#f1f5f9',
                            },
                          }}
                        />
                      </Grid>
                      <Grid>
                        <IconButton
                          onClick={handleAttachClick}
                          disabled={isSending || uploadingAudio}
                          sx={{
                            color: '#7C3AED',
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(124, 58, 237, 0.2)',
                            },
                            mr: 1,
                          }}
                          title="Upload audio file"
                        >
                          {uploadingAudio ? <CircularProgress size={20} sx={{ color: '#7C3AED' }} /> : <AttachFile />}
                        </IconButton>
                        <IconButton
                          color="primary"
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSending || uploadingAudio}
                          sx={{
                            bgcolor: '#7C3AED',
                            color: 'white',
                            '&:hover': {
                              bgcolor: '#5B21B6',
                            },
                            '&.Mui-disabled': {
                              bgcolor: 'rgba(124, 58, 237, 0.3)',
                            },
                          }}
                        >
                          {isSending ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <Send />}
                        </IconButton>
                      </Grid>
                    </Grid>
                    <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>
                      Press Enter to send • Click paperclip to upload audio (MP3, WAV, M4A, etc.)
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 4,
                  }}
                >
                  <SmartToy sx={{ fontSize: 64, color: '#475569', mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ color: '#f1f5f9' }}>
                    Select a chat or create a new one
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, textAlign: 'center', maxWidth: 500 }}>
                    Chat with AI assistant for meeting analysis, getting advice, and work assistance.
                    You can send text messages or upload audio files for transcription and analysis.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                      },
                    }}
                  >
                    Start new chat
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Create Chat Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          PaperProps={{
            sx: {
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 2,
            }
          }}
        >
          <DialogTitle sx={{ color: '#f1f5f9' }}>Create new chat</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Chat title"
              fullWidth
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  color: '#f1f5f9',
                  '& fieldset': {
                    borderColor: '#334155',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#7C3AED',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#94a3b8',
                },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#94a3b8' }}>Chat type</InputLabel>
              <Select
                value={newChatType}
                label="Chat type"
                onChange={(e) => setNewChatType(e.target.value as 'text' | 'audio' | 'meeting')}
                sx={{
                  color: '#f1f5f9',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#334155',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#475569',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#7C3AED',
                  },
                }}
              >
                <MenuItem value="text">
                  <Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}>
                    <TextSnippet sx={{ mr: 1 }} />
                    Text chat
                  </Box>
                </MenuItem>
                <MenuItem value="audio">
                  <Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}>
                    <AudioFile sx={{ mr: 1 }} />
                    Audio chat
                  </Box>
                </MenuItem>
                <MenuItem value="meeting">
                  <Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}>
                    <AttachFile sx={{ mr: 1 }} />
                    Meeting analysis
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setCreateDialogOpen(false)}
              sx={{ color: '#94a3b8' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChat}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                },
              }}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог подтверждения удаления */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleting && setDeleteDialogOpen(false)}
          PaperProps={{
            sx: {
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 2,
            }
          }}
        >
          <DialogTitle sx={{ color: '#f1f5f9' }}>
            Delete Chat
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ color: '#cbd5e1', mb: 2 }}>
              Are you sure you want to delete "{chatToDelete?.title}"?
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              This action cannot be undone. All messages in this chat will be permanently deleted.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              sx={{ color: '#94a3b8' }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteChat}
              disabled={deleting}
              variant="contained"
              color="error"
              sx={{
                backgroundColor: '#ef4444',
                '&:hover': {
                  backgroundColor: '#dc2626',
                },
              }}
            >
              {deleting ? (
                <CircularProgress size={24} sx={{ color: 'white' }} />
              ) : (
                'Delete'
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Меню для действий с чатом */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          PaperProps={{
            sx: {
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              '& .MuiMenuItem-root': {
                color: '#f1f5f9',
                '&:hover': {
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                },
              },
            },
          }}
        >
          <MenuItem onClick={() => {
            const newTitle = prompt('Enter new title:', selectedChat?.title);
            if (newTitle && selectedChat) {
              // TODO: Реализовать обновление заголовка через API
              setChats(chats.map(chat =>
                chat.id === selectedChat.id ? { ...chat, title: newTitle } : chat
              ));
            }
            setAnchorEl(null);
          }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Rename
          </MenuItem>
          <MenuItem onClick={() => {
            if (selectedChat) {
              setChatToDelete(selectedChat);
              setDeleteDialogOpen(true);
            }
            setAnchorEl(null);
          }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* CSS анимация */}
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      </Container>
    </Box>
  );
};

export default ChatsPage;