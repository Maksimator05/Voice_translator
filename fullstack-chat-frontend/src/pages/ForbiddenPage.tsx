import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import SeoHead from '../components/seo/SeoHead';

export default function ForbiddenPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Доступ запрещен"
        description="Этот раздел ограничен ролевой моделью доступа."
        canonicalPath="/forbidden"
        robots="noindex,nofollow"
      />

      <Container maxWidth="md" sx={{ py: 12 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            Доступ запрещен
          </Typography>
          <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 4 }}>
            У вашей учетной записи нет прав для открытия этого раздела. Публичные страницы
            остаются доступными, а закрытые разделы исключаются из индексации.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              component={RouterLink}
              to="/"
              variant="outlined"
              sx={{ borderRadius: 999, borderColor: '#7C3AED', color: '#e9d5ff' }}
            >
              Открыть главную
            </Button>
            <Button
              component={RouterLink}
              to="/auth"
              variant="contained"
              sx={{
                borderRadius: 999,
                px: 3.5,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
              }}
            >
              Войти снова
            </Button>
          </Stack>
        </Box>
      </Container>
    </PublicLayout>
  );
}
