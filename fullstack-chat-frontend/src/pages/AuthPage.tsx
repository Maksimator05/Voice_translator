import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  ThemeProvider,
  Snackbar,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import SeoHead from '../components/seo/SeoHead';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { login, register, clearError, guestLogin } from '../store/authSlice';
import { darkTheme } from '../theme';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, token, isLoading, error } = useAppSelector((state) => state.auth);

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) dispatch(clearError());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && formData.password !== formData.confirmPassword) {
      dispatch(clearError());
      return;
    }

    if (isLogin) {
      await dispatch(login({ email: formData.email, password: formData.password }));
    } else {
      await dispatch(register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      }));
    }
  };

  const handleGuestLogin = async () => {
    await dispatch(guestLogin() as any);
  };

  useEffect(() => {
    if (user && token && !isLogin) {
      setSuccessMessage('Регистрация прошла успешно. Теперь войдите в аккаунт.');
      setShowSuccessSnackbar(true);
      setIsLogin(true);
      setFormData({ email: '', username: '', password: '', confirmPassword: '', full_name: '' });
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  }, [user, token, isLogin]);

  useEffect(() => {
    if (user && token && (isLogin || user.role === 'guest')) {
      navigate('/chats', { replace: true });
    }
  }, [user, token, isLogin, navigate]);

  useEffect(() => {
    dispatch(clearError());
    setFormData({ email: '', username: '', password: '', confirmPassword: '', full_name: '' });
  }, [isLogin, dispatch]);

  return (
    <ThemeProvider theme={darkTheme}>
      <SeoHead
        title="Вход и регистрация"
        description="Закрытая страница авторизации для рабочего пространства анализа встреч."
        canonicalPath="/auth"
        robots="noindex,nofollow"
      />
      <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
        <Paper
          elevation={8}
          sx={{
            p: 4,
            background: 'linear-gradient(145deg, #1E293B 0%, #334155 100%)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: 3,
          }}
          className="fade-in"
        >
          <Box textAlign="center" mb={4}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                mb: 1,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 700,
              }}
            >
              AI Chat Assistant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Интеллектуальный чат с текстовым и аудиоанализом
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#94a3b8' }}>
              Публичная страница: <Link component={RouterLink} to="/resources" sx={{ color: '#c4b5fd' }}>материалы</Link>
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box display="flex" justifyContent="center" mb={3}>
            <Button
              variant={isLogin ? 'contained' : 'outlined'}
              onClick={() => setIsLogin(true)}
              sx={{ mr: 2, borderRadius: 2 }}
            >
              Вход
            </Button>
            <Button
              variant={!isLogin ? 'contained' : 'outlined'}
              onClick={() => setIsLogin(false)}
              sx={{ borderRadius: 2 }}
            >
              Регистрация
            </Button>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {!isLogin && (
              <TextField
                fullWidth
                label="Имя пользователя"
                name="username"
                value={formData.username}
                onChange={handleChange}
                margin="normal"
                required
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person color="primary" />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            )}

            <TextField
              fullWidth
              label="Пароль"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={isLoading}
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {!isLogin && (
              <TextField
                fullWidth
                label="Подтвердите пароль"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                margin="normal"
                required
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="primary" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        disabled={isLoading}
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            )}

            {isLogin ? (
              <Box display="flex" gap={1} mt={3}>
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={isLoading}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                    },
                  }}
                >
                  {isLoading ? 'Загрузка...' : 'Войти'}
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  type="button"
                  disabled={isLoading}
                  onClick={handleGuestLogin}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    color: '#94a3b8',
                    borderColor: '#475569',
                    '&:hover': {
                      borderColor: '#7C3AED',
                      color: '#A78BFA',
                      backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    },
                  }}
                >
                  {isLoading ? '...' : 'Гость'}
                </Button>
              </Box>
            ) : (
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={isLoading}
                sx={{
                  mt: 3,
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)',
                  },
                }}
              >
                {isLoading ? 'Загрузка...' : 'Зарегистрироваться'}
              </Button>
            )}
          </form>

          <Box mt={3} textAlign="center">
            <Link
              component="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormData({ email: '', username: '', password: '', confirmPassword: '', full_name: '' });
              }}
              sx={{
                color: 'primary.light',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                cursor: 'pointer',
              }}
            >
              {isLogin
                ? 'Нет аккаунта? Зарегистрируйтесь'
                : 'Уже есть аккаунт? Войти'}
            </Link>
          </Box>

          {isLogin && (
            <Box mt={4} p={2} bgcolor="grey.900" borderRadius={2}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Данные администратора:
              </Typography>
              <Typography variant="body2" color="text.primary">
                Email: max@example.com
              </Typography>
              <Typography variant="body2" color="text.primary">
                Пароль: 1234
              </Typography>
            </Box>
          )}

          <Box mt={4} textAlign="center">
            <Typography variant="caption" color="text.secondary">
              © 2024 AI Chat Assistant. All rights reserved.
            </Typography>
          </Box>
        </Paper>

        <Snackbar
          open={showSuccessSnackbar}
          autoHideDuration={6000}
          onClose={() => setShowSuccessSnackbar(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setShowSuccessSnackbar(false)} severity="success" sx={{ width: '100%' }}>
            {successMessage}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

export default AuthPage;
