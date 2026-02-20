import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  TextField,
  Paper,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { fetchChats, createChat } from '../../store/chatSlice';

export const ChatWindow: React.FC = () => {
  const dispatch = useAppDispatch();
  const { chats, currentChat } = useAppSelector((state) => state.chat);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    dispatch(fetchChats());
  }, [dispatch]);

  const handleCreateChat = async () => {
    await dispatch(createChat({}));
    setDrawerOpen(false);
  };

  const handleSendMessage = () => {
    if (message.trim()) {
      // TODO: Отправка сообщения
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Логика записи аудио
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 73px)' }}>
      {/* Drawer для истории чатов */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            backgroundColor: '#1e293b',
            borderRight: '1px solid #334155',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateChat}
            fullWidth
            sx={{
              mb: 2,
              background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
              },
            }}
          >
            New Chat
          </Button>

          <Typography variant="h6" sx={{ color: '#f1f5f9', mb: 2 }}>
            Chat History
          </Typography>

          <List>
            {chats.map((chat) => (
              <ListItem key={chat.id} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={currentChat?.id === chat.id}
                  sx={{
                    borderRadius: 1,
                    backgroundColor: currentChat?.id === chat.id ? '#334155' : 'transparent',
                    '&:hover': { backgroundColor: '#334155' },
                    '&.Mui-selected': { backgroundColor: '#334155' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ color: '#f1f5f9' }}>
                        {chat.title || 'New Chat'}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        {chat.last_message || 'No messages yet'}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Основное содержимое */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Панель инструментов */}
        <Box sx={{
          p: 2,
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#1e293b'
        }}>
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ color: '#f1f5f9', mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ color: '#f1f5f9', flex: 1 }}>
            {currentChat?.title || 'AI Chat Assistant'}
          </Typography>
        </Box>

        {/* Область сообщений */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto', backgroundColor: '#0f172a' }}>
          {currentChat ? (
            <Box>
              {/* TODO: Компонент списка сообщений */}
              <Typography variant="body1" sx={{ color: '#94a3b8', textAlign: 'center', mt: 4 }}>
                Start a conversation with AI
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <Typography variant="h5" sx={{ color: '#f1f5f9', mb: 2 }}>
                Welcome to AI Chat Assistant
              </Typography>
              <Typography variant="body1" sx={{ color: '#94a3b8', mb: 4 }}>
                Start a new conversation or select an existing chat
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateChat}
                sx={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                  },
                }}
              >
                Start New Chat
              </Button>
            </Box>
          )}
        </Box>

        {/* Поле ввода */}
        <Paper
          sx={{
            p: 2,
            borderTop: '1px solid #334155',
            backgroundColor: '#1e293b',
            borderRadius: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              variant="outlined"
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

            <IconButton
              onClick={toggleRecording}
              sx={{
                color: isRecording ? '#ef4444' : '#7C3AED',
                backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                '&:hover': {
                  backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(124, 58, 237, 0.2)',
                },
              }}
            >
              {isRecording ? <MicOffIcon /> : <MicIcon />}
            </IconButton>

            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!message.trim()}
              sx={{
                minWidth: 'auto',
                background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                },
                '&.Mui-disabled': {
                  background: 'rgba(124, 58, 237, 0.3)',
                },
              }}
            >
              <SendIcon />
            </Button>
          </Box>

          <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>
            Press Enter to send, Shift+Enter for new line
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};