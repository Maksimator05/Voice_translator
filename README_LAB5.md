# Лабораторная работа №5

## Тема
Комплексное тестирование клиентской и серверной частей веб-приложения `Intelligent Meeting Analyzer`.

## Что сделано

В проекте собрана полноценная тестовая инфраструктура для backend и frontend без изменения бизнес-логики MVP.

### 1. Сформирована тестовая модель приложения

Выделены критические сценарии:

- регистрация, вход, выход, refresh-токены и восстановление сессии;
- гостевой вход и переход в рабочий чат;
- разграничение доступа по ролям `guest / user / admin`;
- CRUD по чатам, фильтрация, сортировка и пагинация;
- отправка сообщений и AI-запросов;
- загрузка, получение и удаление файлов;
- работа со сторонним API публичных материалов;
- корректная реакция UI на loading / empty / error / session expired.

Зафиксированы ключевые ограничения:

- `guest` не может создавать полноценные чаты и работает в ограниченном режиме;
- `user` работает только со своими чатами и файлами;
- `admin` имеет доступ к административным endpoint'ам;
- refresh-токены ротируются и отзываются при logout;
- файлы проходят валидацию;
- внешний API оборачивается серверным адаптером с нормализацией ответа.

Области риска:

- аутентификация и восстановление сессии;
- роли и права доступа;
- файловое хранилище;
- внешняя интеграция;
- клиентская обработка ошибок и недоступности backend.

## Что добавлено в проект

### Backend

Добавлены и настроены:

- [pytest.ini](C:\Users\maksimator\PycharmProjects\Voice_translator\pytest.ini)
- [.coveragerc](C:\Users\maksimator\PycharmProjects\Voice_translator\.coveragerc)
- [requirements-test.txt](C:\Users\maksimator\PycharmProjects\Voice_translator\requirements-test.txt)
- [ruff.toml](C:\Users\maksimator\PycharmProjects\Voice_translator\ruff.toml)
- [tests/conftest.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\conftest.py) с изолированной in-memory SQLite БД, override `get_db`, моками внешних зависимостей и фикстурами ролей/чатов/файлов.

Добавлены backend-тесты:

- [tests/unit/test_auth_service.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\unit\test_auth_service.py)
- [tests/unit/test_chat_service.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\unit\test_chat_service.py)
- [tests/unit/test_external_resources_service.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\unit\test_external_resources_service.py)
- [tests/unit/test_storage_service.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\unit\test_storage_service.py)
- [tests/integration/test_auth_endpoints.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\integration\test_auth_endpoints.py)
- [tests/integration/test_chat_endpoints.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\integration\test_chat_endpoints.py)
- [tests/integration/test_admin_endpoints.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\integration\test_admin_endpoints.py)
- [tests/integration/test_file_endpoints.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\integration\test_file_endpoints.py)
- [tests/integration/test_external_resources_endpoints.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\integration\test_external_resources_endpoints.py)
- [tests/e2e/test_api_flows.py](C:\Users\maksimator\PycharmProjects\Voice_translator\tests\e2e\test_api_flows.py)

### Frontend

Добавлены и настроены:

- [fullstack-chat-frontend/.eslintrc.cjs](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\.eslintrc.cjs)
- [fullstack-chat-frontend/vite.config.ts](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\vite.config.ts) с Vitest coverage thresholds
- [fullstack-chat-frontend/src/test/setup.ts](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\setup.ts)
- [fullstack-chat-frontend/src/test/test-utils.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\test-utils.tsx)

Добавлены frontend-тесты:

- [fullstack-chat-frontend/src/test/unit/authSlice.unit.test.ts](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\unit\authSlice.unit.test.ts)
- [fullstack-chat-frontend/src/test/unit/useRBAC.unit.test.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\unit\useRBAC.unit.test.tsx)
- [fullstack-chat-frontend/src/test/integration/ProtectedRoute.integration.test.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\integration\ProtectedRoute.integration.test.tsx)
- [fullstack-chat-frontend/src/test/integration/AuthPage.integration.test.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\integration\AuthPage.integration.test.tsx)
- [fullstack-chat-frontend/src/test/integration/ResourcesPage.integration.test.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\integration\ResourcesPage.integration.test.tsx)
- [fullstack-chat-frontend/src/test/e2e/LandingPage.e2e.test.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\test\e2e\LandingPage.e2e.test.tsx)

## Точечные исправления в коде MVP

В процессе внедрения тестирования исправлены реальные технические дефекты:

- в [app/models/chat_schemas.py](C:\Users\maksimator\PycharmProjects\Voice_translator\app\models\chat_schemas.py) добавлено поле `audio_data`, которое уже ожидалось backend-логикой;
- исправлены lint-проблемы во frontend:
  - [RegisterForm.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\components\auth\RegisterForm.tsx)
  - [ChatFilters.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\components\chat\ChatFilters.tsx)
  - [Chats.tsx](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\pages\Chats.tsx)
  - [authSlice.ts](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\src\store\authSlice.ts)

## Отдельно исправлено для стабильной CI/сборки

После появления конфликта `npm ci` были синхронизированы frontend-зависимости:

- в [package.json](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\package.json) зафиксирован совместимый стек `vite@^7.3.1` + `@vitejs/plugin-react@^4.7.0`;
- обновлен [package-lock.json](C:\Users\maksimator\PycharmProjects\Voice_translator\fullstack-chat-frontend\package-lock.json);
- повторно проверен чистый путь установки через `npm ci`.

Для Docker стабилизирован frontend healthcheck:

- в [docker-compose.yml](C:\Users\maksimator\PycharmProjects\Voice_translator\docker-compose.yml)
- и [docker-compose.prod.yml](C:\Users\maksimator\PycharmProjects\Voice_translator\docker-compose.prod.yml)

healthcheck переведен на shell-проверку наличия `index.html` и процесса `nginx`, чтобы не зависеть от наличия `wget` в базовом образе.

## Как устроено тестирование

### Backend

- unit: сервисный слой, токены, фильтрация, storage, внешний API;
- integration: реальные FastAPI endpoint'ы, коды ответа, структура данных, ошибки доступа и валидации;
- e2e: целостные API-сценарии пользователя и гостя.

### Frontend

- unit: `authSlice`, `useRBAC`;
- integration: auth-экран, protected routes, публичная страница ресурсов, ошибки и fallback;
- e2e: переход с публичной главной в рабочий чат через гостевой сценарий.

## Команды запуска и проверки

### Backend

```powershell
.\.venv1\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv1\Scripts\python.exe -m ruff check app tests
.\.venv1\Scripts\python.exe -m pytest -m unit
.\.venv1\Scripts\python.exe -m pytest -m integration
.\.venv1\Scripts\python.exe -m pytest -m e2e
.\.venv1\Scripts\python.exe -m pytest --cov=app --cov-report=term
```

### Frontend

```powershell
cd fullstack-chat-frontend
npm ci
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test
npm run test:coverage
npm run build
```

### Docker

```powershell
docker compose up --build -d backend frontend
docker compose ps
```

Smoke-check:

```powershell
(Invoke-WebRequest http://localhost:8000/api/health -UseBasicParsing).Content
(Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).Content
(Invoke-WebRequest http://localhost:3000/robots.txt -UseBasicParsing).Content
```

## Итоговые результаты проверки

### Backend

- `ruff check app tests` проходит
- `pytest --cov=app --cov-report=term` проходит
- `54 passed`
- итоговое backend coverage: `50.84%`
- минимальный backend threshold: `50%`

### Frontend

- `npm ci` проходит
- `npm run lint` проходит
- `npm run test:coverage` проходит
- `npm run build` проходит
- `24 passed`
- frontend coverage:
  - statements: `85.47%`
  - lines: `85.39%`
  - branches: `71.77%`
  - functions: `84.28%`
- минимальные frontend thresholds:
  - statements: `85%`
  - lines: `85%`
  - branches: `70%`
  - functions: `65%`

### Docker / smoke-check

- `docker compose up --build -d backend frontend` успешно отработал на обновленных образах;
- backend health endpoint отвечает `{"status":"healthy", ...}`;
- фронтенд на `http://localhost:3000/` отдает актуальный SEO HTML с `Intelligent Meeting Analyzer`;
- `http://localhost:3000/robots.txt` отдается корректно.

Примечание:

После обнаружения, что frontend-контейнер мог помечаться как `unhealthy` из-за healthcheck, compose-конфиг был дополнительно исправлен. Повторная локальная рекреация контейнера после этого последнего правочного шага уперлась в нестабильность Docker Desktop pipe (`dockerDesktopLinuxEngine`) вне кода проекта. Само приложение и HTTP smoke-check при этом уже были рабочими.

## Что закрывает лабораторная

Реализованы и подтверждены:

- тестовая модель приложения;
- backend unit / integration / e2e;
- frontend unit / integration / e2e;
- отдельное тестовое окружение;
- изолированная тестовая БД;
- мокирование внешних зависимостей;
- разделение тестов по типам;
- контролируемые метрики покрытия;
- проверка ролей и прав доступа;
- проверка работы внешнего API и отказов;
- проверка файловых сценариев;
- воспроизводимый набор команд для локальной и CI-проверки.

## Остаточные замечания

В проекте есть legacy-предупреждения, которые не ломают лабораторную, но видны в логах:

- deprecated `FastAPI on_event`;
- deprecated `Pydantic from_orm / class Config`;
- часть backend-кода все еще использует `datetime.utcnow()`.

Это не мешает прохождению линтеров, тестов и сборки, но может быть вынесено в отдельную техническую доработку.
