# Настройка GitHub Actions CI/CD — Пошаговая инструкция

## Что происходит автоматически

При каждом `git push` в ветки `main` или `dev` GitHub запускает pipeline из 4 этапов:

```
push/PR
  │
  ▼
[1] Lint          — проверка стиля кода (ruff + TypeScript)
  │ (только если lint прошёл)
  ▼
[2] Backend Tests — запуск pytest тестов
  │ (только если тесты прошли)
  ▼
[3] Build Images  — сборка Docker образов backend + frontend
  │ (только при push в main)
  ▼
[4] Integration   — поднимает docker compose, проверяет endpoints
```

---

## Шаг 1 — Залить проект на GitHub

Если репозиторий ещё не создан:

```bash
# На github.com нажмите "New repository", создайте репозиторий (например voice-translator)
# Затем в папке проекта:

git remote add origin https://github.com/ВАШ_ЛОГИН/voice-translator.git
git branch -M main
git push -u origin main
```

Если репозиторий уже есть — просто убедитесь что ветки `main` и `dev` существуют:

```bash
git push origin main
git push origin dev   # если ветка dev есть локально
```

---

## Шаг 2 — Убедиться что файл workflow в репозитории

Файл `.github/workflows/ci.yml` уже создан в проекте. После `git push` GitHub автоматически его найдёт.

Проверьте что файл закоммичен:

```bash
git status
# Должно показать: .github/workflows/ci.yml

git add .github/workflows/ci.yml
git commit -m "add CI/CD pipeline"
git push
```

---

## Шаг 3 — Настроить GitHub Secrets

GitHub Actions не должен знать реальные секреты через код. Секреты хранятся в настройках репозитория.

### Как добавить секрет:

1. Откройте ваш репозиторий на github.com
2. Нажмите **Settings** (вкладка в верхнем меню репозитория)
3. В левом меню: **Secrets and variables** → **Actions**
4. Нажмите **New repository secret**

### Какие секреты добавить:

| Имя секрета | Значение | Зачем |
|-------------|----------|-------|
| `SECRET_KEY` | сгенерированная строка (см. ниже) | JWT подпись токенов |

**Как сгенерировать SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
# Пример вывода: a3f9c2d1e8b7a4f6c3d9e2b5a8f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5
```

Скопируйте вывод — это и есть значение секрета.

> **Важно:** Секрет виден только внутри GitHub Actions. Даже вы не сможете его прочитать после сохранения — только перезаписать.

---

## Шаг 4 — Обновить ci.yml для использования секрета (опционально)

Текущий `ci.yml` использует тестовый ключ для unit-тестов — это нормально. Если хотите использовать настоящий `SECRET_KEY` из Secrets для integration теста, обновите шаг в файле:

```yaml
# В секции integration → steps → "Create .env for integration test"
# Было:
run: |
  echo "SECRET_KEY=ci-integration-secret-key-change-in-prod" > .env

# Станет:
run: |
  echo "SECRET_KEY=${{ secrets.SECRET_KEY }}" > .env
```

Для этого отредактируйте `.github/workflows/ci.yml` строку 129 на `${{ secrets.SECRET_KEY }}`.

---

## Шаг 5 — Проверить что Actions включены

1. Перейдите в репозиторий на github.com
2. Нажмите вкладку **Actions**
3. Если Actions отключены — нажмите **"I understand my workflows, go ahead and enable them"**

---

## Шаг 6 — Запустить первый pipeline

```bash
# Сделайте любое изменение и запушьте
git add .
git commit -m "trigger CI pipeline"
git push origin main
```

Затем откройте вкладку **Actions** в репозитории — вы увидите запущенный pipeline.

---

## Как читать результаты

### Зелёная галочка ✅
Все этапы прошли успешно. Код готов к деплою.

### Красный крест ❌
Один из этапов упал. Нажмите на pipeline → на упавший job → разверните шаг со стрелкой → читайте лог ошибки.

### Жёлтый круг 🟡
Pipeline запущен, ждёт завершения.

---

## Типичные ошибки и решения

### Ошибка: `SECRET_KEY must be set`
```
Error: SECRET_KEY must be set in .env
```
**Решение:** Добавьте секрет `SECRET_KEY` в Settings → Secrets (Шаг 3).

---

### Ошибка: линтер ruff
```
app/main.py:15:1: F401 'os' imported but unused
```
**Решение:** Исправьте указанную строку в коде, закоммитьте и запушьте.

---

### Ошибка: TypeScript tsc
```
src/api/index.ts(45,3): error TS2345: ...
```
**Решение:** Исправьте TypeScript ошибку, пересоберите локально:
```bash
cd fullstack-chat-frontend
npx tsc --noEmit
```

---

### Ошибка: тест упал
```
FAILED tests/test_auth.py::TestRefreshToken::test_refresh_success
```
**Решение:** Запустите тесты локально, найдите причину:
```bash
pip install -r requirements-dev.txt
pytest tests/test_auth.py::TestRefreshToken::test_refresh_success -v
```

---

### Ошибка: Docker build упал
```
ERROR [backend 4/6] RUN pip install torch ...
```
**Решение:** Обычно проблема с сетью в CI — pipeline перезапустится автоматически. Если нет — нажмите **Re-run jobs** в интерфейсе Actions.

---

### Integration тест не запускается
Integration тест запускается **только при push в `main`** (не в `dev`). Это намеренно — тяжёлый тест только для финального кода.

---

## Структура файлов CI/CD

```
.github/
└── workflows/
    └── ci.yml          ← главный файл pipeline
```

```yaml
# Краткая структура ci.yml:

on:
  push:
    branches: [main, dev]   # когда срабатывает
  pull_request:
    branches: [main]

jobs:
  lint:           # 1. Проверка стиля
    runs-on: ubuntu-latest

  test-backend:   # 2. Тесты
    needs: lint   # запускается только после lint

  build:          # 3. Сборка Docker
    needs: test-backend

  integration:    # 4. Полный запуск
    needs: build
    if: github.ref == 'refs/heads/main'   # только main
```

---

## Просмотр логов pipeline

1. GitHub → ваш репозиторий → **Actions**
2. Выберите нужный workflow run
3. Нажмите на job (например `Backend Tests`)
4. Разверните нужный шаг кликом на название

Для скачивания артефактов (если добавите `upload-artifact`) — кнопка **Artifacts** внизу страницы run.

---

## Локальная проверка перед push

Чтобы не ждать CI — проверяйте локально:

```bash
# Python линтинг
pip install ruff
ruff check app/ tests/ --ignore E501

# TypeScript проверка
cd fullstack-chat-frontend
npx tsc --noEmit

# Тесты
cd ..
pip install -r requirements-dev.txt
pytest tests/ -v

# Docker сборка
docker compose build

# Проверка конфига compose
docker compose config
```

---

## Бейджи статуса (по желанию)

Добавьте в основной `README.md` бейдж состояния pipeline:

```markdown
![CI/CD](https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ/actions/workflows/ci.yml/badge.svg)
```

Пример: `![CI/CD](https://github.com/maksimator/voice-translator/actions/workflows/ci.yml/badge.svg)`

Бейдж будет зелёным если последний pipeline прошёл, красным — если упал.
