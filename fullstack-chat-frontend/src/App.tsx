// src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from './store';
import AuthPage from './pages/AuthPage';
import ChatsPage from './pages/Chats';
import { longPollingService } from './api/longpolling';
import { darkTheme } from './theme';
import { fetchCurrentUser } from './store/authSlice';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: any) => state.auth.token);

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: any) => state.auth.token);

  if (token) {
    return <Navigate to="/chats" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { user, token } = useSelector((state: any) => state.auth);
  const dispatch = useDispatch();

  // Восстановление пользователя при загрузке приложения
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && !token) {
      // Если есть токен в localStorage, но нет в Redux
      try {
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        if (parsedUser) {
          dispatch(fetchCurrentUser());
        }
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
  }, [dispatch, token]);

  // Управление Long Polling
  useEffect(() => {
    if (user?.id && token) {
      console.log('Starting Long Polling for user:', user.id);
      longPollingService.startPolling(user.id);
    } else {
      console.log('Stopping Long Polling - no user or token');
      longPollingService.stopPolling();
    }

    return () => {
      console.log('AppRoutes unmounting - stopping polling');
      longPollingService.stopPolling();
    };
  }, [user?.id, token]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Routes>
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/chats"
          element={
            <PrivateRoute>
              <ChatsPage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </Provider>
  );
}

export default App;