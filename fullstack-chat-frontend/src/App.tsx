// src/App.tsx — обновлённая версия с ролевыми маршрутами

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from './store';
import AuthPage from './pages/AuthPage';
import ChatsPage from './pages/Chats';
import AdminPage from './pages/AdminPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { longPollingService } from './api/longpolling';
import { darkTheme } from './theme';
import { fetchCurrentUser } from './store/authSlice';

/** Редирект на /auth если нет токена */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: any) => state.auth.token);
  if (token) return <Navigate to="/chats" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  const { user, token } = useSelector((state: any) => state.auth);
  const dispatch = useDispatch();

  // Восстановление сессии из localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && !token) {
      try {
        if (storedUser) dispatch(fetchCurrentUser() as any);
      } catch (e) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
  }, [dispatch, token]);

  // Управление Long Polling
  useEffect(() => {
    if (user?.id && token) {
      longPollingService.startPolling(user.id);
    } else {
      longPollingService.stopPolling();
    }
    return () => longPollingService.stopPolling();
  }, [user?.id, token]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Routes>
        {/* Публичный маршрут — только для неавторизованных */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />

        {/* Приватный маршрут — любой авторизованный */}
        <Route
          path="/chats"
          element={
            <ProtectedRoute>
              <ChatsPage />
            </ProtectedRoute>
          }
        />

        {/* Административный маршрут — только admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
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