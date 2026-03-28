import { Suspense, lazy, useEffect } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './hooks/useRedux';
import { fetchCurrentUser } from './store/authSlice';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { longPollingService } from './api/longpolling';
import { darkTheme } from './theme';
import PageLoader from './components/ui/PageLoader';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ChatsPage = lazy(() => import('./pages/Chats'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage'));

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const token = useAppSelector((state) => state.auth.token);

  if (token) {
    return <Navigate to="/chats" replace />;
  }

  return children;
}

function AppRoutes() {
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser && !token) {
      void dispatch(fetchCurrentUser());
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (user?.id && token) {
      longPollingService.startPolling(user.id);
      return () => {
        longPollingService.stopPolling();
      };
    }

    longPollingService.stopPolling();
    return undefined;
  }, [token, user?.id]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route
            path="/auth"
            element={
              <PublicOnlyRoute>
                <AuthPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/sign-in" element={<Navigate to="/auth" replace />} />
          <Route path="/sign-up" element={<Navigate to="/auth" replace />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route
            path="/chats"
            element={
              <ProtectedRoute>
                <ChatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        <AppRoutes />
      </Router>
    </Provider>
  );
}
