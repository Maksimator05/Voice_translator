import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { fetchCurrentUser, logout } from '../store/authSlice';
import { ChatWindow } from '../components/chat/ChatWindow';
import { Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';

const ChatPage = () => {
  const { chatId } = useParams<{ chatId?: string }>();
  const dispatch = useDispatch();
  const { currentChat, isLoading } = useSelector((state: any) => state.chat);
  const { user } = useSelector((state: any) => state.auth);

   useEffect(() => {
    if (chatId) {
      dispatch(fetchChat(parseInt(chatId)));
    }
  }, [chatId, dispatch]);

  // Убедитесь, что polling запущен
  useEffect(() => {
    if (user?.id && !longPollingService.isActive()) {
      longPollingService.startPolling(user.id);
    }
  }, [user?.id]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header с кнопкой выхода */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{user.username}</h1>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>

          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
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
        </div>
      </header>

      <ChatWindow />
    </div>
  );
};