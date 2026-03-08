# Лабораторная работа №6
## Контейнеризация и автоматизация развертывания

---

## Цели работы

1. Контейнеризировать frontend и backend в отдельные образы
2. Настроить воспроизводимый запуск через Docker Compose
3. Автоматизировать сборку, тестирование и деплой через CI/CD (GitHub Actions)
4. Обеспечить безопасную конфигурацию и устойчивость к сбоям

---

## Теоретические основы

### Docker

**Docker** — платформа контейнеризации. Контейнер — изолированный процесс с собственной файловой системой, сетью и переменными окружения. В отличие от виртуальной машины, контейнер использует ядро хост-ОС → меньше накладных расходов.

**Ключевые понятия:**
- **Image** — неизменяемый слоистый снимок файловой системы. Строится по `Dockerfile`.
- **Container** — запущенный экземпляр образа.
- **Layer** — кэшируемый слой образа. Каждая инструкция `RUN/COPY/ADD` создаёт слой.
- **Volume** — персистентное хранилище, пережигающее перезапуск контейнера.
- **Network** — виртуальная сеть между контейнерами.

### Docker Compose

Оркестратор для запуска нескольких контейнеров одной командой. Описывает:
- Сервисы (services): образы, порты, volumes, env
- Сети (networks): изоляция и маршрутизация
- Тома (volumes): персистентность данных
- Порядок запуска (depends_on + healthcheck)

### Nginx как Reverse Proxy

Nginx принимает все запросы от браузера и:
- Раздаёт статику (React SPA) — `/` → `/usr/share/nginx/html`
- Проксирует API — `/api/` → `backend:8000/api/`

Это устраняет CORS-проблемы: браузер видит один origin (`http://localhost:3000`).

### Multi-stage Build

Разделение сборки на этапы позволяет:
1. **Этап Builder**: Node 20 + npm → компилирует React/TypeScript в статику
2. **Этап Serve**: nginx:alpine → только HTML/CSS/JS, без Node и исходников

Итоговый образ в ~10 раз меньше однослойного.

### CI/CD

**Continuous Integration** — автоматическая проверка кода при каждом push:
- Lint (статический анализ кода)
- Tests (автоматизированные тесты)
- Build (сборка образов)

**Continuous Deployment** — автоматический деплой при успешных проверках.

**GitHub Actions** — встроенный CI/CD в GitHub. Описывается YAML-файлами в `.github/workflows/`.

---

## Архитектура контейнеризации

```
                    Internet
                       │
                  ┌────▼────┐
                  │ Browser │
                  └────┬────┘
                       │ :3000
              ┌────────▼────────┐
              │    Frontend     │
              │  nginx:alpine   │
              │  /api/* → proxy │
              └────────┬────────┘
                       │ :8000 (app-network)
              ┌────────▼────────┐
              │    Backend      │
              │  python:3.11-slim│
              │  FastAPI + SQLite│
              └────────┬────────┘
                       │
           ┌───────────┴───────────┐
    ┌──────▼──────┐       ┌────────▼──────┐
    │ backend_data│       │backend_uploads│
    │  (volume)   │       │   (volume)    │
    └─────────────┘       └───────────────┘
```

### Сетевая схема

```
docker network: app-network (bridge)
├── backend  (hostname: backend, port: 8000)
└── frontend (hostname: frontend, port: 80 → host: 3000)
```

Контейнеры в одной сети обращаются друг к другу по имени сервиса: `http://backend:8000`.

---

## Файловая структура

```
Voice_translator/
├── Dockerfile                    # Backend образ
├── .dockerignore                 # Исключения для backend контекста
├── docker-compose.yml            # Оркестрация всех сервисов
├── .env.example                  # Шаблон переменных окружения
├── requirements.txt              # Python зависимости (prod)
├── requirements-dev.txt          # Dev зависимости (тесты, линтер)
│
├── fullstack-chat-frontend/
│   ├── Dockerfile                # Frontend multi-stage образ
│   ├── .dockerignore             # Исключения для frontend контекста
│   └── nginx.conf                # Конфигурация Nginx
│
├── tests/
│   ├── conftest.py               # Pytest фикстуры, тестовая БД
│   └── test_auth.py              # Тесты аутентификации и RBAC
│
└── .github/
    └── workflows/
        └── ci.yml                # GitHub Actions CI/CD pipeline
```

---

## Backend Dockerfile

```dockerfile
FROM python:3.11-slim

# Системные зависимости для аудио-обработки
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg gcc g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU-only PyTorch (значительно меньше GPU-версии)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
RUN mkdir -p /app/data /app/uploads

# Запускаем от непривилегированного пользователя (security)
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

**Ключевые решения:**
- `python:3.11-slim` — минимальный базовый образ
- `--no-install-recommends` — не ставить рекомендуемые пакеты
- `--no-cache-dir` — не кэшировать pip пакеты в образе
- `USER appuser` — принцип наименьших привилегий

---

## Frontend Dockerfile (Multi-stage)

```dockerfile
# Stage 1: Сборка React/Vite
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci                          # детерминированная установка
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build                   # → /app/dist

# Stage 2: Раздача через Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Размеры образов:**
- Однослойный (с Node): ~1.2 GB
- Multi-stage (только nginx + dist): ~35 MB

---

## Docker Compose

### Структура `docker-compose.yml`

```yaml
services:
  backend:
    build: { context: ., dockerfile: Dockerfile }
    environment:
      SECRET_KEY: ${SECRET_KEY:?SECRET_KEY must be set}  # :? = обязательное
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES:-30}  # :- = дефолт
    networks: [app-network]
    healthcheck:
      test: ["CMD", "python", "-c", "...urlopen('http://localhost:8000/api/health')"]
      interval: 30s
      retries: 3
      start_period: 40s  # время на инициализацию

  frontend:
    depends_on:
      backend:
        condition: service_healthy  # ждём healthy backend, не просто started
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:80/"]

networks:
  app-network:
    driver: bridge

volumes:
  backend_data:    # SQLite БД
  backend_uploads: # загруженные файлы
```

### `depends_on` с `condition: service_healthy`

Обычный `depends_on` ждёт только **запуска** контейнера. С `condition: service_healthy` — ждёт пока healthcheck вернёт healthy (backend полностью инициализирован).

---

## Конфигурация и секреты

### .env.example

Шаблон с плейсхолдерами вместо реальных значений:
```ini
SECRET_KEY=CHANGE_ME_generate_with_secrets_token_hex_32
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

### Принципы безопасной конфигурации

1. `.env` исключён из git через `.gitignore` и `.dockerignore`
2. `.env.example` коммитится — только шаблон без секретов
3. `${SECRET_KEY:?...}` в compose → ошибка при старте если SECRET_KEY не задан
4. В CI — секреты через GitHub Secrets, не в коде

---

## CI/CD Pipeline (GitHub Actions)

### Этапы

```
push to main/dev
       │
  ┌────▼────┐
  │  Lint   │  ruff (Python) + tsc (TypeScript)
  └────┬────┘
       │
  ┌────▼──────┐
  │  Backend  │  pytest tests/ -v
  │   Tests   │
  └────┬──────┘
       │
  ┌────▼────┐
  │  Build  │  docker build (backend + frontend)
  │ Images  │  docker compose config
  └────┬────┘
       │  (только main)
  ┌────▼────────┐
  │ Integration │  docker compose up
  │    Test     │  smoke test auth endpoints
  └─────────────┘
```

### Кэширование образов

```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha   # читаем из кэша GitHub Actions
    cache-to: type=gha,mode=max  # пишем в кэш
```

Повторная сборка с неизменившимися слоями — секунды вместо минут.

---

## Запуск

### Локальная разработка (без Docker)

```bash
# Backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd fullstack-chat-frontend
npm install
npm run dev  # :5173
```

### Запуск через Docker Compose

```bash
# 1. Настройка окружения
cp .env.example .env
# Отредактируйте .env: обязательно смените SECRET_KEY

# 2. Сборка и запуск
docker compose up --build

# 3. Проверка
curl http://localhost:8000/api/health
open http://localhost:3000

# Остановка
docker compose down

# Полная очистка (включая volumes с БД)
docker compose down -v
```

### Запуск тестов

```bash
pip install -r requirements-dev.txt

# Все тесты
pytest tests/ -v

# Только auth тесты
pytest tests/test_auth.py -v

# С покрытием
pytest tests/ --cov=app --cov-report=html
```

---

## Healthchecks

| Сервис | Команда | Интервал | Старт |
|--------|---------|---------|-------|
| backend | `urllib.request.urlopen('/api/health')` | 30s | 40s |
| frontend | `wget -q --spider localhost:80` | 30s | 15s |

Backend получает 40 секунд на старт (инициализация Whisper/LLM).

---

## Устойчивость к сбоям

| Сценарий | Поведение |
|----------|-----------|
| Backend упал | `restart: unless-stopped` → автоперезапуск |
| Frontend упал | Аналогично |
| БД повреждена | Volume `backend_data` сохраняется при перезапуске |
| LM Studio недоступен | Backend стартует, LLM запросы вернут 500 (graceful degradation) |
| Неуспешная миграция | create_tables() логирует ошибку, не останавливает сервер |
| Frontend стартовал раньше backend | `depends_on: condition: service_healthy` предотвращает это |

---

## Безопасность контейнеров

| Мера | Где |
|------|-----|
| Non-root USER | Backend Dockerfile |
| Минимальные образы (slim/alpine) | Оба Dockerfile |
| `--no-install-recommends` | Backend Dockerfile |
| Секреты через env (не в образе) | docker-compose + .env |
| .dockerignore (исключает .env, БД) | Корень и frontend |
| `SECRET_KEY:?` — обязательная переменная | docker-compose.yml |
