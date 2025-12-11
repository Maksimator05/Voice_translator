import React, { useState, useEffect, useRef } from 'react';
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
  Mic,
  SmartToy,
  Close,
  AudioFile,
  TextSnippet,
  Logout,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { logout } from '../store/authSlice';
import { fetchChats, createChat, sendMessage, askAI } from '../store/chatSlice';

interface Chat {
  id: number;
  title: string;
  session_type: 'text' | 'audio' | 'meeting';
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count?: number;
  user_id: number;
  messages?: any[];
}

interface Message {
  id: number | string;
  content: string;
  role: 'user' | 'assistant';
  message_type: 'text' | 'audio';
  created_at: string;
  audio_filename?: string;
  audio_transcription?: string;
}

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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Проверка авторизации
  useEffect(() => {
    if (!token) {
      navigate('/auth');
      return;
    }

    loadChats();
  }, [token, navigate, dispatch]);

  // Загрузка чатов
  useEffect(() => {
    if (storeChats.length > 0) {
      const typedChats = storeChats.map(chat => ({
        ...chat,
        session_type: chat.session_type || 'text'
      })) as Chat[];

      setChats(typedChats);

      if (!selectedChat && typedChats.length > 0) {
        setSelectedChat(typedChats[0]);
        if (typedChats[0].messages) {
          setMessages(typedChats[0].messages);
        }
      }
    }
  }, [storeChats, selectedChat]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      await dispatch(fetchChats());
    } catch (error: any) {
      console.error('Error loading chats:', error);
      setError(error.response?.data?.detail || 'Failed to load chats');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      content: newMessage,
      role: 'user',
      message_type: 'text',
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    const currentMessage = newMessage;
    setNewMessage('');

    try {
      // Отправляем сообщение
      const result = await dispatch(askAI({
        chatId: selectedChat.id,
        message: currentMessage.trim(),
      }));

      // Обновляем чаты
      await loadChats();

    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.response?.data?.detail || 'Failed to send message');
      // Удаляем оптимистичное сообщение при ошибке
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
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
      const result = await dispatch(createChat(newChatTitle));
      if (createChat.fulfilled.match(result)) {
        setSelectedChat(result.payload);
        setMessages(result.payload.messages || []);
        setCreateDialogOpen(false);
        setNewChatTitle('New Chat');
      }
    } catch (error: any) {
      console.error('Error creating chat:', error);
      setError(error.response?.data?.detail || 'Failed to create chat');
    }
  };

  const handleDeleteChat = async (chatId: number) => {
    if (!window.confirm('Delete this chat?')) return;
    try {
      // TODO: Реализовать удаление через API
      setChats(chats.filter(chat => chat.id !== chatId));
      if (selectedChat?.id === chatId) {
        setSelectedChat(chats.length > 1 ? chats.find(c => c.id !== chatId) || null : null);
      }
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      setError(error.response?.data?.detail || 'Failed to delete chat');
    }
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/auth', { replace: true });
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case 'audio': return <Mic fontSize="small" />;
      case 'meeting': return <AudioFile fontSize="small" />;
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
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US');
    }
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
          <Grid item xs={12} md={4}>
            <Paper sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
            }}>
              <Box p={2} borderBottom="1px solid #334155">
                <Typography variant="h6" gutterBottom sx={{ color: '#f1f5f9' }}>
                  Chats
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
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List>
                  {filteredChats.map((chat) => (
                    <React.Fragment key={chat.id}>
                      <ListItem
                        button
                        selected={selectedChat?.id === chat.id}
                        onClick={() => {
                          setSelectedChat(chat);
                          setMessages(chat.messages || []);
                        }}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(124, 58, 237, 0.2)',
                            },
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
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="subtitle2" noWrap sx={{ flex: 1, color: '#f1f5f9' }}>
                                {chat.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                {formatDate(chat.updated_at)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: '#94a3b8' }} noWrap>
                              {chat.last_message || 'No messages'}
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
                            }}
                            sx={{ color: '#94a3b8' }}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" sx={{ borderColor: '#334155' }} />
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
          <Grid item xs={12} md={8}>
            <Paper sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
            }}>
              {selectedChat ? (
                <>
                  <Box
                    p={2}
                    borderBottom="1px solid #334155"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
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
                        </Typography>
                      </Box>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        title="Delete chat"
                        onClick={() => handleDeleteChat(selectedChat.id)}
                        sx={{ color: '#94a3b8' }}
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
                    }}
                  >
                    {messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                          mb: 2,
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
                                <Mic fontSize="small" sx={{ mr: 1, color: '#7C3AED' }} />
                                <Typography variant="body1" sx={{ color: '#f1f5f9' }}>
                                  Audio message
                                </Typography>
                              </Box>
                              {message.audio_transcription && (
                                <Typography variant="body2" sx={{
                                  fontStyle: 'italic',
                                  color: '#cbd5e1',
                                  mt: 1,
                                  p: 1,
                                  backgroundColor: 'rgba(30, 41, 59, 0.3)',
                                  borderRadius: 1,
                                }}>
                                  "{message.audio_transcription}"
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body1" sx={{ color: '#f1f5f9' }}>
                              {message.content}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                    {isSending && (
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
                          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                            AI is typing...
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    <div ref={messagesEndRef} />
                  </Box>

                  <Box p={2} borderTop="1px solid #334155">
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs>
                        <TextField
                          fullWidth
                          multiline
                          maxRows={4}
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          size="small"
                          disabled={isSending}
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
                      <Grid item>
                        <IconButton
                          color="primary"
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || isSending}
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
                      Press Enter to send, Shift+Enter for new line
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
                  <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3, textAlign: 'center' }}>
                    Chat with AI assistant for meeting analysis, getting advice, and work assistance
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
                    Text
                  </Box>
                </MenuItem>
                <MenuItem value="audio">
                  <Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}>
                    <Mic sx={{ mr: 1 }} />
                    Audio
                  </Box>
                </MenuItem>
                <MenuItem value="meeting">
                  <Box display="flex" alignItems="center" sx={{ color: '#f1f5f9' }}>
                    <AudioFile sx={{ mr: 1 }} />
                    Meeting
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

        {/* Chat Actions Menu */}
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
              handleDeleteChat(selectedChat.id);
            }
            setAnchorEl(null);
          }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      </Container>
    </Box>
  );
};

export default ChatsPage;