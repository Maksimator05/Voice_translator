import { Box, Button, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import PublicLayout from '../components/layout/PublicLayout';
import SeoHead from '../components/seo/SeoHead';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, toAbsoluteUrl } from '../config/site';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { guestLogin } from '../store/authSlice';

const featureCards = [
  {
    title: 'Быстрая расшифровка аудио',
    description:
      'Преобразуйте записи встреч в текст с поиском, чтобы команда могла быстро возвращаться к нужным моментам.',
  },
  {
    title: 'Структура итогов встречи',
    description:
      'Получайте краткое summary, решения, задачи и ключевые договоренности в удобном и понятном виде.',
  },
  {
    title: 'Единое рабочее пространство',
    description:
      'Храните чаты, файлы и аудиосессии в одном приложении с разграничением доступа по ролям.',
  },
];

const workflowSteps = [
  'Загрузите аудиофайл или начните новую чат-сессию.',
  'Дождитесь автоматической транскрибации и анализа содержимого.',
  'Просмотрите решения, задачи и материалы в одном месте.',
];

export default function LandingPage() {
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

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: toAbsoluteUrl('/'),
    image: DEFAULT_OG_IMAGE,
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <PublicLayout>
      <SeoHead
        title="AI-анализ встреч и транскрибация аудио"
        description={DEFAULT_DESCRIPTION}
        canonicalPath="/"
        structuredData={structuredData}
      />

      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top left, rgba(124,58,237,0.22), transparent 32%), radial-gradient(circle at 80% 20%, rgba(236,72,153,0.18), transparent 30%)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
          <Box
            sx={{
              display: 'grid',
              gap: 5,
              alignItems: 'center',
              gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' },
            }}
          >
            <Box component="section" aria-labelledby="hero-title">
              <Chip
                label="Публичная главная страница"
                sx={{ mb: 2, backgroundColor: 'rgba(124,58,237,0.16)', color: '#c4b5fd' }}
              />
              <Typography
                id="hero-title"
                component="h1"
                variant="h2"
                sx={{ fontWeight: 800, lineHeight: 1.05, maxWidth: 760, mb: 2 }}
              >
                Анализируйте встречи, расшифровывайте аудио и храните решения в удобной системе.
              </Typography>
              <Typography
                variant="h5"
                sx={{ color: '#cbd5e1', maxWidth: 680, lineHeight: 1.55, mb: 4 }}
              >
                Intelligent Meeting Analyzer помогает превращать диалоги и записи встреч в
                структурированные итоги, задачи и повторно используемые знания команды.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => {
                    void handleStart();
                  }}
                  disabled={isLoading}
                  sx={{
                    borderRadius: 999,
                    px: 3.5,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
                  }}
                >
                  {isLoading ? 'Подключение...' : token ? 'Открыть чаты' : 'Начать работу'}
                </Button>
                <Button
                  component={RouterLink}
                  to="/resources"
                  variant="outlined"
                  size="large"
                  sx={{ borderRadius: 999, px: 3.5, borderColor: '#7C3AED', color: '#e9d5ff' }}
                >
                  Посмотреть материалы
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Box>
                  <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                    3 формата работы
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Текстовый чат, работа с аудио и анализ встреч.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
                    Быстрый гостевой вход
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                    Начните пользоваться приложением сразу, даже без отдельной регистрации.
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 5,
                background:
                  'linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)',
                border: '1px solid rgba(148,163,184,0.16)',
              }}
            >
              <Box
                component="img"
                src="/hero-meeting.svg"
                alt="Иллюстрация панели с чатами, транскрибацией и сводкой по встрече"
                sx={{ width: '100%', borderRadius: 3 }}
              />
            </Paper>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box
          component="section"
          aria-labelledby="features-title"
          sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}
        >
          <Box sx={{ gridColumn: '1 / -1', mb: 1 }}>
            <Typography id="features-title" component="h2" variant="h4" sx={{ fontWeight: 800 }}>
              Почему эта страница подходит для главной
            </Typography>
            <Typography variant="body1" sx={{ color: '#94a3b8', maxWidth: 760, mt: 1 }}>
              Главная страница объясняет ценность продукта, а раздел с материалами дает
              индексируемый контент про встречи, расшифровку и организацию совместной работы.
            </Typography>
          </Box>

          {featureCards.map((feature) => (
            <Paper
              key={feature.title}
              component="article"
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.14)',
                backgroundColor: 'rgba(30,41,59,0.72)',
              }}
            >
              <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                {feature.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.7 }}>
                {feature.description}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Box
          component="section"
          aria-labelledby="workflow-title"
          sx={{ mt: 8, display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
        >
          <Box>
            <Typography id="workflow-title" component="h2" variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
              Как это работает в MVP
            </Typography>
            <Stack spacing={2}>
              {workflowSteps.map((step, index) => (
                <Paper
                  key={step}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: '1px solid rgba(148,163,184,0.14)',
                    backgroundColor: 'rgba(30,41,59,0.68)',
                  }}
                >
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Шаг {index + 1}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                    {step}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Paper
            component="section"
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: 4,
              border: '1px solid rgba(148,163,184,0.14)',
              backgroundColor: 'rgba(15,23,42,0.85)',
            }}
          >
            <Typography component="h2" variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
              Частые вопросы
            </Typography>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Какие страницы индексируются?
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
              Публичная главная и библиотека материалов предназначены для индексации. Страницы
              авторизации, чатов, админки и ограниченного доступа специально помечены как `noindex`.
            </Typography>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Можно ли начать без регистрации?
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2 }}>
              Да. Кнопка «Начать работу» выполняет гостевой вход и сразу открывает чат.
            </Typography>
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Где посмотреть внешнюю интеграцию?
            </Typography>
            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
              Откройте раздел с материалами: там данные приходят через серверный адаптер,
              который работает с внешним API и нормализует ответы для интерфейса.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </PublicLayout>
  );
}
