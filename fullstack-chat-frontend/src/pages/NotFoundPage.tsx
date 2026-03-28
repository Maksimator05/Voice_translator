import { Box, Button, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import SeoHead from '../components/seo/SeoHead';

export default function NotFoundPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Страница не найдена"
        description="Запрошенная страница отсутствует в Intelligent Meeting Analyzer."
        canonicalPath="/404"
        robots="noindex,nofollow"
      />

      <Container maxWidth="md" sx={{ py: 12 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography component="h1" variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
            404
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
            Страница не найдена
          </Typography>
          <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 4 }}>
            Такой адрес не соответствует публичной странице или доступному разделу приложения.
          </Typography>
          <Button
            component={RouterLink}
            to="/"
            variant="contained"
            sx={{
              borderRadius: 999,
              px: 3.5,
              background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            }}
          >
            На главную
          </Button>
        </Box>
      </Container>
    </PublicLayout>
  );
}
