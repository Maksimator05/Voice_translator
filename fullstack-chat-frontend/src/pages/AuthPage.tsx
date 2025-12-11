import React, { useState, useEffect } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { login, register, clearError } from '../store/authSlice';
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) {
      dispatch(clearError());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && formData.password !== formData.confirmPassword) {
      dispatch(clearError());
      // Можно добавить обработку ошибки несовпадения паролей
      return;
    }

    if (isLogin) {
      await dispatch(login({
        email: formData.email,
        password: formData.password,
      }));
    } else {
      // При регистрации отправляем только необходимые поля
      await dispatch(register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
      }));
    }
  };

  // Обработка успешной регистрации
  useEffect(() => {
    if (user && token && !isLogin) {
      // Показываем сообщение об успешной регистрации
      setSuccessMessage('Registration successful! Please sign in.');
      setShowSuccessSnackbar(true);

      // Переключаемся на форму логина
      setIsLogin(true);

      // Очищаем форму
      setFormData({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        full_name: '',
      });

      // Можно также очистить состояние пользователя чтобы не перенаправлять в чат
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  }, [user, token, isLogin]);

  // Обработка успешной авторизации - переход в чат
  useEffect(() => {
    if (user && token && isLogin) {
      // Перенаправляем в чат
      navigate('/chat', { replace: true });
    }
  }, [user, token, isLogin, navigate]);

  // Очищаем ошибку при переключении режима
  useEffect(() => {
    dispatch(clearError());
    setFormData({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      full_name: '',
    });
  }, [isLogin, dispatch]);

  const handleCloseSnackbar = () => {
    setShowSuccessSnackbar(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
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
              Intelligent chat with text and audio analysis
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
              Sign In
            </Button>
            <Button
              variant={!isLogin ? 'contained' : 'outlined'}
              onClick={() => setIsLogin(false)}
              sx={{ borderRadius: 2 }}
            >
              Sign Up
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
                label="Username"
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
              label="Password"
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
                label="Confirm Password"
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
              {isLoading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <Box mt={3} textAlign="center">
            <Link
              component="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormData({
                  email: '',
                  username: '',
                  password: '',
                  confirmPassword: '',
                  full_name: '',
                });
              }}
              sx={{
                color: 'primary.light',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                cursor: 'pointer',
              }}
            >
              {isLogin
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Link>
          </Box>

          {isLogin && (
            <Box mt={4} p={2} bgcolor="grey.900" borderRadius={2}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Demo credentials:
              </Typography>
              <Typography variant="body2" color="text.primary">
                Email: demo@example.com
              </Typography>
              <Typography variant="body2" color="text.primary">
                Password: demo123
              </Typography>
            </Box>
          )}

          <Box mt={4} textAlign="center">
            <Typography variant="caption" color="text.secondary">
              © 2024 AI Chat Assistant. All rights reserved.
            </Typography>
          </Box>
        </Paper>

        {/* Snackbar для успешной регистрации */}
        <Snackbar
          open={showSuccessSnackbar}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity="success"
            sx={{ width: '100%' }}
          >
            {successMessage}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

export default AuthPage;