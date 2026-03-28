import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicLayout from '../components/layout/PublicLayout';
import SeoHead from '../components/seo/SeoHead';
import { DEFAULT_DESCRIPTION, SITE_NAME, toAbsoluteUrl } from '../config/site';
import { resourcesApi } from '../api/resources';
import type { ExternalResourceItem, ExternalResourceResponse } from '../types/resources';

const fallbackResources: ExternalResourceItem[] = [
  {
    id: 'fallback-1',
    title: 'Sprint: How to Solve Big Problems and Test New Ideas in Just Five Days',
    authors: ['Jake Knapp'],
    description:
      'Практическая книга про быстрые воркшопы, принятие решений и согласование работы команды.',
    resource_url: 'https://books.google.com/',
    categories: ['Воркшопы', 'Продуктивность'],
    source: 'local_fallback',
  },
  {
    id: 'fallback-2',
    title: 'Crucial Conversations',
    authors: ['Kerry Patterson'],
    description:
      'Полезное руководство по сложным разговорам, переговорам и переводу обсуждений в конкретный результат.',
    resource_url: 'https://books.google.com/',
    categories: ['Коммуникация', 'Лидерство'],
    source: 'local_fallback',
  },
  {
    id: 'fallback-3',
    title: 'The Checklist Manifesto',
    authors: ['Atul Gawande'],
    description:
      'Хороший ориентир для команд, которым нужен повторяемый подход к подготовке и follow-up после встреч.',
    resource_url: 'https://books.google.com/',
    categories: ['Процессы', 'Операции'],
    source: 'local_fallback',
  },
];

function buildStructuredData(items: ExternalResourceItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Публичные материалы | ${SITE_NAME}`,
    url: toAbsoluteUrl('/resources'),
    description: DEFAULT_DESCRIPTION,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.slice(0, 6).map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
        url: item.resource_url,
      })),
    },
  };
}

export default function ResourcesPage() {
  const [searchInput, setSearchInput] = useState('эффективные встречи');
  const deferredQuery = useDeferredValue(searchInput);
  const [resources, setResources] = useState<ExternalResourceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gracefulFallback, setGracefulFallback] = useState(false);

  const effectiveItems = useMemo(
    () => (resources?.items?.length ? resources.items : fallbackResources),
    [resources]
  );
  const structuredData = useMemo(() => buildStructuredData(effectiveItems), [effectiveItems]);

  const loadResources = async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await resourcesApi.searchBooks(query, 6);
      setResources(data);
      setGracefulFallback(false);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.detail ||
          'Внешний источник временно недоступен. Показываем локально подготовленную подборку материалов.'
      );
      setGracefulFallback(true);
      setResources(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResources(deferredQuery.trim() || 'эффективные встречи');
    }, 350);

    return () => window.clearTimeout(timer);
  }, [deferredQuery]);

  return (
    <PublicLayout>
      <SeoHead
        title="Публичные материалы про встречи и продуктивность"
        description="Подборка открытых материалов о фасилитации встреч, заметках, командной работе и продуктивности."
        canonicalPath="/resources"
        structuredData={structuredData}
      />

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box component="section" aria-labelledby="resources-title" sx={{ mb: 5 }}>
          <Typography
            component="h1"
            id="resources-title"
            variant="h3"
            sx={{ fontWeight: 800, mb: 1.5 }}
          >
            Публичная библиотека материалов для более эффективных встреч
          </Typography>
          <Typography variant="body1" sx={{ color: '#cbd5e1', maxWidth: 780, lineHeight: 1.75 }}>
            Эта страница демонстрирует интеграцию со сторонним API. Поисковые запросы проходят
            через FastAPI, где ответы нормализуются, кешируются, повторяются при временных сбоях
            и приводятся к формату, удобному для интерфейса.
          </Typography>
        </Box>

        <Paper
          component="section"
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 4,
            border: '1px solid rgba(148,163,184,0.14)',
            backgroundColor: 'rgba(30,41,59,0.78)',
          }}
        >
          <Typography component="h2" variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Поиск внешних материалов
          </Typography>
          <Stack
            component="form"
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault();
              void loadResources(searchInput);
            }}
          >
            <TextField
              fullWidth
              label="Тема"
              value={searchInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setSearchInput(nextValue);
                });
              }}
              helperText="Например: фасилитация встреч, продуктовые интервью, ведение заметок"
            />
            <Button
              type="submit"
              variant="contained"
              sx={{
                minWidth: 180,
                borderRadius: 999,
                background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
              }}
            >
              Найти материалы
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 2 }}>
            {['эффективные встречи', 'фасилитация', 'распознавание речи', 'ведение заметок'].map(
              (topic) => (
                <Chip
                  key={topic}
                  label={topic}
                  onClick={() => setSearchInput(topic)}
                  sx={{ color: '#e9d5ff', backgroundColor: 'rgba(124,58,237,0.16)' }}
                />
              )
            )}
          </Stack>
        </Paper>

        {error && (
          <Alert severity={gracefulFallback ? 'warning' : 'error'} sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="section" aria-labelledby="results-title">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography id="results-title" component="h2" variant="h4" sx={{ fontWeight: 800 }}>
                Результаты поиска
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                Запрос: {resources?.query || searchInput || 'эффективные встречи'}
              </Typography>
            </Box>
            {resources && (
              <Chip
                label={resources.cached ? 'Из кеша' : 'Свежий ответ провайдера'}
                sx={{ color: '#bfdbfe', backgroundColor: 'rgba(59,130,246,0.14)' }}
              />
            )}
          </Stack>

          {isLoading ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.14)',
                backgroundColor: 'rgba(30,41,59,0.72)',
                textAlign: 'center',
              }}
            >
              <CircularProgress sx={{ color: '#A78BFA', mb: 2 }} />
              <Typography variant="body1">Загружаем материалы...</Typography>
            </Paper>
          ) : effectiveItems.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.14)',
                backgroundColor: 'rgba(30,41,59,0.72)',
              }}
            >
              <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Ничего не найдено
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                Попробуйте более общий запрос, например «эффективные встречи» или «коммуникация в команде».
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              }}
            >
              {effectiveItems.map((item) => (
                <Paper
                  key={item.id}
                  component="article"
                  elevation={0}
                  sx={{
                    display: 'grid',
                    gap: 2,
                    p: 2.5,
                    borderRadius: 4,
                    border: '1px solid rgba(148,163,184,0.14)',
                    backgroundColor: 'rgba(30,41,59,0.72)',
                    gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' },
                  }}
                >
                  {item.thumbnail_url ? (
                    <Box
                      component="img"
                      src={item.thumbnail_url}
                      alt={`Обложка для ${item.title}`}
                      loading="lazy"
                      decoding="async"
                      sx={{
                        width: 120,
                        height: 170,
                        objectFit: 'cover',
                        borderRadius: 2,
                        backgroundColor: '#0f172a',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 120,
                        height: 170,
                        borderRadius: 2,
                        background:
                          'linear-gradient(180deg, rgba(124,58,237,0.24) 0%, rgba(15,23,42,0.88) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ddd6fe',
                        fontWeight: 700,
                      }}
                    >
                      Нет обложки
                    </Box>
                  )}

                  <Box>
                    <Typography component="h3" variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
                      {item.authors.join(', ') || 'Автор не указан'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.7, mb: 2 }}>
                      {item.description || 'Описание для этого материала недоступно.'}
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
                      {(item.categories || []).map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          size="small"
                          sx={{ backgroundColor: 'rgba(236,72,153,0.12)', color: '#f9a8d4' }}
                        />
                      ))}
                      {item.published_date && (
                        <Chip
                          label={item.published_date}
                          size="small"
                          sx={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}
                        />
                      )}
                    </Stack>

                    <Button
                      href={item.resource_url}
                      target="_blank"
                      rel="noreferrer"
                      endIcon={<OpenInNewIcon />}
                      variant="outlined"
                      sx={{ borderColor: '#7C3AED', color: '#e9d5ff', borderRadius: 999 }}
                    >
                      Открыть материал
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </PublicLayout>
  );
}
