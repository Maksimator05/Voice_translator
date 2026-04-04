# Лабораторная работа №5

## Тема
Комплексное тестирование клиентской и серверной частей веб-приложения `Intelligent Meeting Analyzer`.

## Что было сделано

В рамках лабораторной в проекте была собрана полноценная тестовая инфраструктура для backend и frontend, без изменения основной бизнес-логики MVP.

### 1. Сформирована тестовая модель приложения

Выделены критические пользовательские сценарии:

- регистрация, вход, выход, refresh-токены и восстановление сессии;
- гостевой вход и переход в рабочий чат;
- ролевой доступ `guest / user / admin`;
- создание, чтение, фильтрация, сортировка, пагинация и удаление чатов;
- отправка сообщений в чат и AI-запросов;
- загрузка, получение и удаление файлов;
- работа со сторонним API публичных материалов;
- корректная реакция UI на загрузку, ошибки и недоступность внешнего сервиса.

Ключевые бизнес-правила и ограничения:

- `guest` не может создавать чаты и имеет ограниченный сценарий использования;
- `user` может работать только со своими чатами и файлами;
- `admin` имеет доступ к админским endpoint’ам и управлению пользователями;
- refresh-токены ротируются и отзываются при logout;
- файлы проходят валидацию по размеру и MIME-типу;
- внешний API должен обрабатываться через серверный адаптер с нормализацией и защитой от сбоев.

Области повышенного риска:

- аутентификация и refresh/logout;
- разграничение доступа по ролям;
- файловое хранилище;
- интеграция со сторонним API;
- фронтендовая обработка ошибок и session-expired сценариев.

## Что добавлено в проект

### Backend

Добавлены и настроены:

- `pytest.ini` с разделением тестов по маркерам `unit`, `integration`, `e2e`;
- `.coveragerc` с минимальным порогом backend coverage;
- `requirements-test.txt` для отдельного тестового окружения;
- `ruff.toml` для легкого backend-линтинга по критичным правилам;
- новый `tests/conftest.py` с:
  - изолированной in-memory SQLite БД;
  - override `get_db`;
  - отключением тяжелого startup-поведения;
  - моками LLM/audio частей;
  - фикстурами пользователей, ролей, чатов и storage.

Добавлены backend-тесты:

- `tests/unit/test_auth_service.py`
- `tests/unit/test_chat_service.py`
- `tests/unit/test_external_resources_service.py`
- `tests/unit/test_storage_service.py`
- `tests/integration/test_auth_endpoints.py`
- `tests/integration/test_chat_endpoints.py`
- `tests/integration/test_admin_endpoints.py`
- `tests/integration/test_file_endpoints.py`
- `tests/integration/test_external_resources_endpoints.py`
- `tests/e2e/test_api_flows.py`

### Frontend

Добавлены и настроены:

- `fullstack-chat-frontend/.eslintrc.cjs`
- обновленный `fullstack-chat-frontend/package.json` со script-командами для тестов;
- обновленный `fullstack-chat-frontend/vite.config.ts` с конфигом Vitest и coverage thresholds;
- `fullstack-chat-frontend/src/test/setup.ts`
- `fullstack-chat-frontend/src/test/test-utils.tsx`

Добавлены frontend-тесты:

- `fullstack-chat-frontend/src/test/unit/authSlice.unit.test.ts`
- `fullstack-chat-frontend/src/test/unit/useRBAC.unit.test.tsx`
- `fullstack-chat-frontend/src/test/integration/ProtectedRoute.integration.test.tsx`
- `fullstack-chat-frontend/src/test/integration/AuthPage.integration.test.tsx`
- `fullstack-chat-frontend/src/test/integration/ResourcesPage.integration.test.tsx`
- `fullstack-chat-frontend/src/test/e2e/LandingPage.e2e.test.tsx`

## Точечные исправления в коде MVP

Чтобы тесты отражали реальную работоспособность приложения, были внесены минимальные корректировки:

- в `app/models/chat_schemas.py` добавлено поле `audio_data`, так как backend endpoint `/api/chats/{chat_id}/messages` уже ожидал его в логике;
- исправлены lint-проблемы во frontend:
  - `src/components/auth/RegisterForm.tsx`
  - `src/components/chat/ChatFilters.tsx`
  - `src/pages/Chats.tsx`
  - `src/store/authSlice.ts`

Эти изменения не меняют бизнес-смысл приложения, а устраняют реальные технические дефекты и шум линтера.

## Как устроено тестирование

### Backend unit

Проверяется изолированная логика сервисов:

- refresh-token lifecycle;
- фильтрация, пагинация и удаление чатов;
- rate limit, retry, cache и normalizer внешнего API;
- базовая валидация файлов.

### Backend integration

Проверяются реальные FastAPI endpoint’ы:

- auth endpoints;
- chat endpoints;
- admin endpoints;
- file endpoints;
- external resources endpoints.

### Backend e2e

Проверяются цельные бизнес-сценарии:

- полный пользовательский путь от логина до CRUD и logout;
- гостевой сценарий;
- доступ к внешнему API и ограничения по ролям.

### Frontend unit

Проверяются:

- `authSlice`;
- `useRBAC`.

### Frontend integration

Проверяются:

- защита маршрутов;
- auth-экран;
- публичная страница ресурсов;
- состояния loading / error / graceful fallback.

### Frontend e2e

Проверяется сквозной UI-flow:

- переход с публичной главной в чат через гостевой вход.

## Команды запуска и проверки

### Backend

Установка test-зависимостей:

```powershell
.\.venv1\Scripts\python.exe -m pip install -r requirements-test.txt
```

Линтер:

```powershell
.\.venv1\Scripts\python.exe -m ruff check app tests
```

Unit-тесты:

```powershell
.\.venv1\Scripts\python.exe -m pytest -m unit
```

Integration-тесты:

```powershell
.\.venv1\Scripts\python.exe -m pytest -m integration
```

E2E-тесты:

```powershell
.\.venv1\Scripts\python.exe -m pytest -m e2e
```

Полный backend-прогон с покрытием:

```powershell
.\.venv1\Scripts\python.exe -m pytest --cov=app --cov-report=term
```

### Frontend

Установка зависимостей:

```powershell
cd fullstack-chat-frontend
npm install
```

Линтер:

```powershell
npm run lint
```

Unit:

```powershell
npm run test:unit
```

Integration:

```powershell
npm run test:integration
```

E2E:

```powershell
npm run test:e2e
```

Полный прогон:

```powershell
npm run test
```

Покрытие:

```powershell
npm run test:coverage
```

Production build:

```powershell
npm run build
```

## Итоговые результаты проверки

### Backend

- `ruff check app tests` — проходит;
- `pytest` — `54 passed`;
- итоговое покрытие backend: `50.84%`;
- минимальный порог backend coverage: `50%`.

### Frontend

- `npm run lint` — проходит;
- `npm run test` — `16 passed`;
- `npm run build` — проходит;
- покрытие frontend:
  - statements: `90.92%`
  - lines: `90.92%`
  - branches: `77.95%`
  - functions: `69.69%`
- минимальные пороги frontend coverage:
  - statements: `85%`
  - lines: `85%`
  - branches: `70%`
  - functions: `65%`

## Что именно проверяется по заданию лабораторной

Закрыты пункты задания:

- тестовая модель приложения;
- модульные тесты backend;
- интеграционные тесты backend;
- модульные и сценарные тесты frontend;
- сквозные проверки ключевых сценариев;
- отдельная test-infra;
- изолированная тестовая БД;
- мокирование внешних зависимостей;
- разделение `unit / integration / e2e`;
- контролируемые метрики покрытия;
- проверка ролей и прав доступа;
- проверка работы внешнего API и отказов;
- проверка файловых сценариев.

## Ограничения и замечания

В проекте остались технические предупреждения, которые не ломают прохождение лабораторной, но относятся к накопленному legacy-коду:

- deprecated `FastAPI on_event`;
- deprecated `Pydantic from_orm / class Config`;
- часть backend-кода все еще использует `datetime.utcnow()`.

Они не мешают прохождению тестов и сборки, но могут быть вынесены в отдельную техническую доработку позже.
