import type { ReactNode } from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { SITE_NAME } from '../../config/site';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { guestLogin } from '../../store/authSlice';

interface PublicLayoutProps {
  children: ReactNode;
}

const navLinkSx = {
  color: '#cbd5e1',
  textDecoration: 'none',
  fontWeight: 500,
  '&:hover': {
    color: '#ffffff',
  },
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { token, isLoading } = useAppSelector((state) => state.auth);

  const handleStart = async () => {
    if (token) {
      navigate('/chats');
      return;
    }

    try {
      await dispatch(guestLogin()).unwrap();
      navigate('/chats');
    } catch {
      navigate('/auth');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          backdropFilter: 'blur(18px)',
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.82) 100%)',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{
              textDecoration: 'none',
              color: '#f8fafc',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {SITE_NAME}
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography component={RouterLink} to="/" sx={navLinkSx}>
              Главная
            </Typography>
            <Typography component={RouterLink} to="/resources" sx={navLinkSx}>
              Материалы
            </Typography>
            {token ? (
              <Button
                component={RouterLink}
                to="/chats"
                variant="contained"
                sx={{
                  borderRadius: 999,
                  px: 2.5,
                  background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                }}
              >
                Открыть рабочее пространство
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button component={RouterLink} to="/auth" color="inherit">
                  Войти
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleStart();
                  }}
                  disabled={isLoading}
                  sx={{
                    borderRadius: 999,
                    px: 2.5,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                  }}
                >
                  {isLoading ? 'Подключение...' : 'Начать работу'}
                </Button>
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>

      <Box component="main">{children}</Box>

      <Box
        component="footer"
        sx={{
          borderTop: '1px solid rgba(148, 163, 184, 0.16)',
          mt: 8,
          py: 4,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            {SITE_NAME} объединяет AI-чат, транскрибацию аудио, анализ встреч и историю работы в
            одном приложении.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
