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
  ListItemButton,
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
  Chip,
  Tooltip,
  LinearProgress,
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
  AudioFile,
  TextSnippet,
  Logout,
  AdminPanelSettings,
  Lock,
  HourglassEmpty,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { logout } from '../store/authSlice';
import { fetchChats, createChat, askAI, fetchChat, deleteChat } from '../store/chatSlice';
import { longPollingService } from '../api/longpolling';
import { useRBAC, GUEST_TRANSCRIPTION_LIMIT } from '../hooks/useRBAC';
import type { Chat, Message } from '../types';

const MESSAGES_CACHE_KEY = 'chat_messages_cache';

const ROLE_CHIP_COLOR: Record<string, 'default' | 'primary' | 'error'> = {
  guest: 'default',
  user: 'primary',
  admin: 'error',
};

const ChatsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const { chats: storeChats, isLoading, isSending } = useAppSelector((state) => state.chat);

  const {
    canCreateChat,
    canDeleteOwnChat,
    canDeleteAnyChat,
    canSendMessages,
    isAdmin,
    isGuest,
    role,
    guestLimitReached,
    guestUsageCount,
    guestUsageLeft,
    incrementGuestUsage,
  } = useRBAC();

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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [menuChat, setMenuChat] = useState<Chat | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [error, setError] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingChatIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }
    loadChats();
  }, [token, navigate]);

  useEffect(() => {
    if (storeChats.length > 0) {
      const typedChats = storeChats.map((chat) => ({
        ...chat,
        session_type: chat.session_type || 'text',
        messages: [],
        message_count: chat.message_count || 0,
        user_id: (chat as any).user_id || 0,
      })) as Chat[];

      setChats(typedChats);

      if (!selectedChat && typedChats.length > 0) {
        handleSelectChat(typedChats[0]);
      }
    }
  }, [storeChats]);

  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (data: any) => {
      if (!data?.message) return;

      const { message, chat_id } = data;
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

      if (selectedChat?.id === normalizedMessage.chat_id) {
        setMessages((prev) => {
          const filtered = prev.filter(
            (msg) => !(typeof msg.id === 'string' && msg.id.toString().startsWith('temp_'))
          );
          if (filtered.some((msg) => msg.id === normalizedMessage.id)) return filtered;
          const newMessages = [...filtered, normalizedMessage];
          saveMessagesToCache(selectedChat!.id, newMessages);
          return newMessages;
        });
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === normalizedMessage.chat_id
            ? {
                ...chat,
                last_message: normalizedMessage.content?.substring(0, 50) || 'New message',
                updated_at: normalizedMessage.created_at || new Date().toISOString(),
                message_count: (chat.message_count || 0) + 1,
              }
            : chat
        )
      );
    };

    longPollingService.on('new_message', handleNewMessage);
    return () => {
      longPollingService.off('new_message', handleNewMessage);
    };
  }, [user, selectedChat]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, []);

  const saveMessagesToCache = (chatId: number, msgs: Message[]) => {
    try {
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      cache[chatId] = msgs;
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // игнорируем
    }
  };

  const loadMessagesFromCache = (chatId: number): Message[] => {
    try {
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      return cache[chatId] || [];
    } catch {
      return [];
    }
  };

  const loadChats = async () => {
    try {
      await dispatch(fetchChats());
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to load chats');
    }
  };

  const loadChatMessages = async (chatId: number) => {
    if (loadingChatIdRef.current === chatId) return;
    loadingChatIdRef.current = chatId;

    try {
      const cachedMessages = loadMessagesFromCache(chatId);
      if (cachedMessages.length > 0) setMessages(cachedMessages);

      const result = await dispatch(fetchChat(chatId)).unwrap();
      if (result?.messages) {
        const serverMessages = result.messages as Message[];
        setMessages(serverMessages);
        saveMessagesToCache(chatId, serverMessages);
      }
    } catch {
      setMessages(loadMessagesFromCache(chatId));
    } finally {
      loadingChatIdRef.current = null;
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    localStorage.setItem('selected_chat_id', chat.id.toString());
    await loadChatMessages(chat.id);
  };

  const handleSendMessage = async () => {
    if (!canSendMessages) {
      setError('Вы исчерпали лимит расшифровок. Зарегистрируйтесь для безлимитного доступа.');
      return;
    }
    if (!newMessage.trim() || !selectedChat || !user) return;

    // Увеличиваем счётчик для гостя
    if (isGuest) incrementGuestUsage();

    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      content: newMessage.trim(),
      role: 'user',
      message_type: 'text',
      created_at: new Date().toISOString(),
      chat_id: selectedChat.id,
      is_user: true,
    };

    setMessages((prev) => {
      const newMessages = [...prev, optimisticMessage];
      saveMessagesToCache(selectedChat.id, newMessages);
      return newMessages;
    });

    const currentMessage = newMessage;
    setNewMessage('');

    try {
      await dispatch(askAI({ chatId: selectedChat.id, message: currentMessage.trim() })).unwrap();
      setTimeout(() => loadChatMessages(selectedChat.id), 1000);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to send message');
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
        saveMessagesToCache(selectedChat.id, filtered);
        return filtered;
      });
    }
  };

  const handleSendAudio = async (audioFile: File) => {
    if (!canSendMessages) {
      setError('Вы исчерпали лимит расшифровок. Зарегистрируйтесь для безлимитного доступа.');
      return;
    }
    if (!selectedChat || !user || !audioFile) return;

    // Увеличиваем счётчик для гостя
    if (isGuest) incrementGuestUsage();

    setUploadingAudio(true);

    const optimisticMessage: Message = {
      id: `temp_audio_${Date.now()}`,
      content: '[Audio message]',
      role: 'user',
      message_type: 'audio',
      created_at: new Date().toISOString(),
      chat_id: selectedChat.id,
      is_user: true,
    };

    setMessages((prev) => {
      const newMessages = [...prev, optimisticMessage];
      saveMessagesToCache(selectedChat.id, newMessages);
      return newMessages;
    });

    try {
      await dispatch(askAI({ chatId: selectedChat.id, audioFile })).unwrap();
      setTimeout(() => loadChatMessages(selectedChat.id), 1000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to send audio');
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
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
      const result = await dispatch(
        createChat({ title: newChatTitle, session_type: newChatType })
      ).unwrap();
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
        await loadChats();
        saveMessagesToCache(newChat.id, []);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to create chat');
    }
  };

  const handleDeleteChatClick = (chatId: number) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    setChatToDelete(chat);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    setDeleting(true);
    try {
      await dispatch(deleteChat(chatToDelete.id)).unwrap();
      const cache = JSON.parse(localStorage.getItem(MESSAGES_CACHE_KEY) || '{}');
      delete cache[chatToDelete.id];
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(cache));

      if (selectedChat?.id === chatToDelete.id) {
        const remaining = chats.filter((c) => c.id !== chatToDelete.id);
        if (remaining.length > 0) {
          handleSelectChat(remaining[0]);
        } else {
          setSelectedChat(null);
          setMessages([]);
          localStorage.removeItem('selected_chat_id');
        }
      }
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to delete chat');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    longPollingService.stopPolling();
    longPollingService.removeAllListeners();
    localStorage.removeItem(MESSAGES_CACHE_KEY);
    localStorage.removeItem('selected_chat_id');
    await dispatch(logout());
    navigate('/auth', { replace: true });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (MP3, WAV, M4A, etc.)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Audio file is too large. Maximum size is 50MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    handleSendAudio(file);
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, chat: Chat) => {
    e.stopPropagation();
    setMenuChat(chat);
    setAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuChat(null);
  };

  const handleRenameOpen = () => {
    if (!menuChat) return;
    setRenameTitle(menuChat.title);
    setRenameDialogOpen(true);
    handleCloseMenu();
  };

  const handleRenameConfirm = () => {
    if (!menuChat || !renameTitle.trim()) return;
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === menuChat.id ? { ...chat, title: renameTitle.trim() } : chat
      )
    );
    if (selectedChat?.id === menuChat.id) {
      setSelectedChat((prev) => (prev ? { ...prev, title: renameTitle.trim() } : prev));
    }
    setRenameDialogOpen(false);
  };

  const canDeleteChat = (chat: Chat): boolean => {
    if (canDeleteAnyChat) return true;
    if (canDeleteOwnChat && chat.user_id === user?.id) return true;
    return false;
  };

  const filteredChats = chats.filter((chat) =>
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
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (minutes < 1) return 'Just now';
      if (hours < 1) return `${minutes}m ago`;
      if (days < 1) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
      });
    } catch {
      return 'Just now';
    }
  };

  if (isLoading && chats.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#7C3AED', mb: 2 }} />
          <Typography sx={{ color: '#f1f5f9' }}>Loading chats...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#0f172a', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ pt: 2, pb: 4, height: 'calc(100vh - 32px)' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*" style={{ display: 'none' }} />

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
            {/* Счётчик лимита для гостя */}
            {isGuest && (
              <Box sx={{
                px: 2, py: 0.5,
                backgroundColor: guestLimitReached ? 'rgba(239, 68, 68, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                border: `1px solid ${guestLimitReached ? 'rgba(239, 68, 68, 0.3)' : 'rgba(124, 58, 237, 0.3)'}`,
                borderRadius: 2,
                minWidth: 160,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <HourglassEmpty sx={{ fontSize: 14, color: guestLimitReached ? '#EF4444' : '#A78BFA' }} />
                  <Typography variant="caption" sx={{ color: guestLimitReached ? '#EF4444' : '#A78BFA' }}>
                    {guestLimitReached
                      ? 'Лимит исчерпан'
                      : `Осталось расшифровок: ${guestUsageLeft}`}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(guestUsageCount / GUEST_TRANSCRIPTION_LIMIT) * 100}
                  sx={{
                    height: 4, borderRadius: 2,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: guestLimitReached ? '#EF4444' : '#7C3AED',
                    }
                  }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)', fontWeight: 'bold' }}>
                {user?.username?.charAt(0).toUpperCase() || 'G'}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ color: '#f1f5f9' }}>
                  {user?.username || 'Гость'}
                </Typography>
                <Chip
                  label={role}
                  size="small"
                  color={ROLE_CHIP_COLOR[role] ?? 'default'}
                  sx={{ height: 16, fontSize: '0.6rem' }}
                />
              </Box>
            </Box>

            {isAdmin && (
              <Tooltip title="Панель администратора">
                <Button
                  variant="outlined"
                  startIcon={<AdminPanelSettings />}
                  onClick={() => navigate('/admin')}
                  sx={{
                    color: '#EF4444',
                    borderColor: '#EF4444',
                    '&:hover': { borderColor: '#DC2626', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
                  }}
                >
                  Admin
                </Button>
              </Tooltip>
            )}

            <Button
              variant="outlined"
              startIcon={<Logout />}
              onClick={handleLogout}
              sx={{
                color: '#f1f5f9',
                borderColor: '#475569',
                '&:hover': { borderColor: '#7C3AED', backgroundColor: 'rgba(124, 58, 237, 0.1)' },
              }}
            >
              Logout
            </Button>
          </Box>
        </Box>

        {/* Баннер для гостя при исчерпанном лимите */}
        {isGuest && guestLimitReached && (
          <Alert
            severity="warning"
            sx={{ mb: 2, backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            action={
              <Button color="inherit" size="small" onClick={() => navigate('/auth')}>
                Зарегистрироваться
              </Button>
            }
          >
            Вы использовали все {GUEST_TRANSCRIPTION_LIMIT} бесплатные расшифровки. Зарегистрируйтесь для безлимитного доступа.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
        )}

        <Grid container spacing={3} sx={{ height: 'calc(100% - 80px)' }}>
          {/* Chat List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 }}>
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
                      '& fieldset': { borderColor: '#334155' },
                      '&:hover fieldset': { borderColor: '#475569' },
                      '&.Mui-focused fieldset': { borderColor: '#7C3AED' },
                    },
                    '& .MuiInputBase-input': { color: '#f1f5f9' },
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
                {canCreateChat ? (
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                      '&:hover': { background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)' },
                    }}
                  >
                    New Chat
                  </Button>
                ) : (
                  <Tooltip title="Для создания чатов необходима регистрация">
                    <span>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Lock />}
                        disabled
                        sx={{ borderColor: '#334155', color: '#475569' }}
                      >
                        New Chat (недоступно)
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Box>

              <Box sx={{ flex: 1, overflow: 'auto', px: 1 }}>
                <List disablePadding>
                  {filteredChats.map((chat) => (
                    <React.Fragment key={`chat_${chat.id}`}>
                      <ListItem disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                          selected={selectedChat?.id === chat.id}
                          onClick={() => handleSelectChat(chat)}
                          sx={{
                            borderRadius: 1,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(124, 58, 237, 0.1)',
                              '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
                            },
                            '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.05)' },
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: getChatTypeColor(chat.session_type) }}>
                              {getChatTypeIcon(chat.session_type)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                <Typography variant="subtitle2" noWrap sx={{ flex: 1, color: '#f1f5f9', pr: 1 }}>
                                  {chat.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                  {formatDate(chat.updated_at)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" sx={{ color: '#94a3b8', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {chat.last_message || 'No messages yet'}
                                {(chat.message_count || 0) > 0 && (
                                  <span> • {chat.message_count} {chat.message_count === 1 ? 'msg' : 'msgs'}</span>
                                )}
                              </Typography>
                            }
                          />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={(e) => handleOpenMenu(e, chat)}
                              sx={{ color: '#94a3b8' }}
                            >
                              <MoreVert fontSize="small" />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItemButton>
                      </ListItem>
                      <Divider component="li" sx={{ borderColor: '#334155', opacity: 0.5, mx: 2 }} />
                    </React.Fragment>
                  ))}
                </List>

                {filteredChats.length === 0 && (
                  <Box p={4} textAlign="center">
                    <SmartToy sx={{ fontSize: 48, color: '#475569', mb: 2 }} />
                    <Typography variant="body1" sx={{ color: '#94a3b8' }}>No chats found</Typography>
                    {canCreateChat && (
                      <Button
                        variant="outlined"
                        onClick={() => setCreateDialogOpen(true)}
                        sx={{ mt: 2, color: '#7C3AED', borderColor: '#7C3AED', '&:hover': { borderColor: '#A78BFA', backgroundColor: 'rgba(124, 58, 237, 0.1)' } }}
                      >
                        Create first chat
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Chat Window */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 }}>
              {selectedChat ? (
                <>
                  {/* Chat header */}
                  <Box p={2} borderBottom="1px solid #334155" display="flex" alignItems="center" justifyContent="space-between" sx={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: getChatTypeColor(selectedChat.session_type), mr: 2 }}>
                        {getChatTypeIcon(selectedChat.session_type)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#f1f5f9' }}>{selectedChat.title}</Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          {selectedChat.session_type === 'audio' ? 'Audio chat' : selectedChat.session_type === 'meeting' ? 'Meeting analysis' : 'Text chat'}
                          {(selectedChat.message_count || 0) > 0 && ` • ${selectedChat.message_count} msgs`}
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      {canDeleteChat(selectedChat) && (
                        <IconButton
                          size="small"
                          title="Delete chat"
                          onClick={() => handleDeleteChatClick(selectedChat.id)}
                          sx={{ color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  {/* Messages */}
                  <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', backgroundColor: '#0f172a' }}>
                    {messages.length === 0 ? (
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 4 }}>
                        <SmartToy sx={{ fontSize: 64, color: '#475569', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#f1f5f9', mb: 2 }}>No messages yet</Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, maxWidth: 400 }}>
                          {canSendMessages
                            ? `Start the conversation${isGuest ? ` (осталось ${guestUsageLeft} из ${GUEST_TRANSCRIPTION_LIMIT})` : ''}`
                            : `Лимит исчерпан. Зарегистрируйтесь для безлимитного доступа.`}
                        </Typography>
                        {isGuest && guestLimitReached && (
                          <Button variant="contained" onClick={() => navigate('/auth')}
                            sx={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
                            Зарегистрироваться
                          </Button>
                        )}
                      </Box>
                    ) : (
                      <>
                        {messages.map((message, index) => {
                          if (!message) return null;
                          const messageKey = message.id ? `msg_${message.id}` : `msg_temp_${index}`;
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
                              <Box sx={{
                                maxWidth: '70%',
                                p: 2,
                                borderRadius: 2,
                                bgcolor: message.role === 'user' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(30, 41, 59, 0.5)',
                                border: `1px solid ${message.role === 'user' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)'}`,
                              }}>
                                <Box display="flex" alignItems="center" mb={0.5}>
                                  {message.role === 'assistant' && <SmartToy fontSize="small" sx={{ mr: 0.5, color: '#7C3AED' }} />}
                                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    {message.role === 'user' ? 'You' : 'AI Assistant'} • {formatDate(message.created_at)}
                                  </Typography>
                                </Box>
                                {message.message_type === 'audio' ? (
                                  <Box>
                                    <Box display="flex" alignItems="center" mb={1}>
                                      <AudioFile fontSize="small" sx={{ mr: 1, color: '#7C3AED' }} />
                                      <Typography variant="body1" sx={{ color: '#f1f5f9' }}>Audio message</Typography>
                                    </Box>
                                    {message.audio_transcription && (
                                      <Box sx={{ mt: 1, p: 1.5, backgroundColor: 'rgba(30, 41, 59, 0.3)', borderRadius: 1, borderLeft: '3px solid #7C3AED' }}>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 0.5 }}>Transcription:</Typography>
                                        <Typography variant="body2" sx={{ color: '#cbd5e1', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                                          "{message.audio_transcription}"
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                ) : (
                                  <Typography variant="body1" sx={{ color: '#f1f5f9', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {message.content}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                        {(isSending || uploadingAudio) && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                            <Box sx={{ maxWidth: '70%', p: 2, borderRadius: 2, bgcolor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(124, 58, 237, 0.1)' }}>
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

                  {/* Input area */}
                  <Box p={2} borderTop="1px solid #334155">
                    {guestLimitReached ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 1.5, px: 2, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 1, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Lock sx={{ color: '#EF4444', fontSize: 16 }} />
                          <Typography variant="body2" sx={{ color: '#EF4444' }}>
                            Лимит {GUEST_TRANSCRIPTION_LIMIT} расшифровок исчерпан
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" onClick={() => navigate('/auth')}
                          sx={{ color: '#7C3AED', borderColor: '#7C3AED', whiteSpace: 'nowrap' }}>
                          Зарегистрироваться
                        </Button>
                      </Box>
                    ) : (
                      <>
                        {isGuest && (
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>
                            Бесплатных расшифровок: {guestUsageLeft} из {GUEST_TRANSCRIPTION_LIMIT}
                          </Typography>
                        )}
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
                                  '& fieldset': { borderColor: '#334155' },
                                  '&:hover fieldset': { borderColor: '#475569' },
                                  '&.Mui-focused fieldset': { borderColor: '#7C3AED' },
                                },
                                '& .MuiInputBase-input': { color: '#f1f5f9' },
                              }}
                            />
                          </Grid>
                          <Grid>
                            <IconButton
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isSending || uploadingAudio}
                              sx={{
                                color: '#7C3AED',
                                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                                '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
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
                                '&:hover': { bgcolor: '#5B21B6' },
                                '&.Mui-disabled': { bgcolor: 'rgba(124, 58, 237, 0.3)' },
                              }}
                            >
                              {isSending ? <CircularProgress size={24} sx={{ color: 'white' }} /> : <Send />}
                            </IconButton>
                          </Grid>
                        </Grid>
                        <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>
                          Press Enter to send • Click paperclip to upload audio
                        </Typography>
                      </>
                    )}
                  </Box>
                </>
              ) : (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                  <SmartToy sx={{ fontSize: 64, color: '#475569', mb: 2 }} />
                  <Typography variant="h6" gutterBottom sx={{ color: '#f1f5f9' }}>
                    Select a chat or create a new one
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, textAlign: 'center', maxWidth: 500 }}>
                    Chat with AI assistant for meeting analysis, getting advice, and work assistance.
                  </Typography>
                  {canCreateChat && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => setCreateDialogOpen(true)}
                      sx={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', '&:hover': { background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)' } }}
                    >
                      Start new chat
                    </Button>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Диалог создания чата */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 } }}>
          <DialogTitle sx={{ color: '#f1f5f9' }}>Create new chat</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus margin="dense" label="Chat title" fullWidth
              value={newChatTitle} onChange={(e) => setNewChatTitle(e.target.value)}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { color: '#f1f5f9', '& fieldset': { borderColor: '#334155' }, '&.Mui-focused fieldset': { borderColor: '#7C3AED' } }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#94a3b8' }}>Chat type</InputLabel>
              <Select
                value={newChatType} label="Chat type"
                onChange={(e) => setNewChatType(e.target.value as 'text' | 'audio' | 'meeting')}
                sx={{ color: '#f1f5f9', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7C3AED' } }}
              >
                <MenuItem value="text"><Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}><TextSnippet sx={{ mr: 1 }} />Text chat</Box></MenuItem>
                <MenuItem value="audio"><Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}><AudioFile sx={{ mr: 1 }} />Audio chat</Box></MenuItem>
                <MenuItem value="meeting"><Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}><AttachFile sx={{ mr: 1 }} />Meeting analysis</Box></MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
            <Button onClick={handleCreateChat} variant="contained" sx={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>Create</Button>
          </DialogActions>
        </Dialog>

        {/* Диалог удаления чата */}
        <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 } }}>
          <DialogTitle sx={{ color: '#f1f5f9' }}>Delete Chat</DialogTitle>
          <DialogContent>
            <Typography sx={{ color: '#cbd5e1', mb: 2 }}>Are you sure you want to delete "{chatToDelete?.title}"?</Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>This action cannot be undone.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting} sx={{ color: '#94a3b8' }}>Cancel</Button>
            <Button onClick={confirmDeleteChat} disabled={deleting} variant="contained" color="error">
              {deleting ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Диалог переименования */}
        <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 } }}>
          <DialogTitle sx={{ color: '#f1f5f9' }}>Rename Chat</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus margin="dense" label="New title" fullWidth
              value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRenameConfirm()}
              sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', '& fieldset': { borderColor: '#334155' }, '&.Mui-focused fieldset': { borderColor: '#7C3AED' } }, '& .MuiInputLabel-root': { color: '#94a3b8' } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameDialogOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
            <Button onClick={handleRenameConfirm} variant="contained" sx={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>Rename</Button>
          </DialogActions>
        </Dialog>

        {/* Контекстное меню */}
        <Menu
          anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}
          PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', '& .MuiMenuItem-root': { color: '#f1f5f9', '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.1)' } } } }}
        >
          <MenuItem onClick={handleRenameOpen}><Edit fontSize="small" sx={{ mr: 1 }} />Rename</MenuItem>
          {menuChat && canDeleteChat(menuChat) && (
            <MenuItem onClick={() => { if (menuChat) handleDeleteChatClick(menuChat.id); handleCloseMenu(); }} sx={{ color: '#EF4444 !important' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} />Delete
            </MenuItem>
          )}
        </Menu>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </Container>
    </Box>
  );
};

export default ChatsPage;