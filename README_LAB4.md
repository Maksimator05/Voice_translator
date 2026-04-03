# SEO-оптимизация — Памятка для защиты лабораторной

## Обзор

В проект добавлена базовая SEO-оптимизация на двух уровнях:
- **Backend (FastAPI)** — `app/main.py`, `app/config.py`
- **Frontend (HTML)** — `fullstack-chat-frontend/index.html`

---

## 1. Backend — `app/config.py`

Добавлены три новые настройки, связанные с SEO:

| Параметр | Значение по умолчанию | Назначение |
|---|---|---|
| `SITE_NAME` | `"Intelligent Meeting Analyzer"` | Название сайта для мета-тегов |
| `SITE_URL` | `http://localhost:3000` | Базовый URL — используется для формирования абсолютных ссылок в sitemap и robots.txt |
| `DEFAULT_OG_IMAGE` | `http://localhost:3000/og-cover.svg` | Путь к изображению для Open Graph (превью в соцсетях) |

Значения берутся из переменных окружения, что позволяет менять их без изменения кода.

---

## 2. Backend — `app/main.py`

### 2.1. Вспомогательные функции

```python
def build_absolute_site_url(path: str) -> str:
    return f"{settings.SITE_URL}{path}"
```
Формирует полный URL из базового адреса сайта и относительного пути. Используется в sitemap и robots.txt.

---

### 2.2. Sitemap (`/sitemap.xml`)

```python
PUBLIC_SITEMAP_ROUTES = (
    ("/", "weekly", "1.0"),
    ("/resources", "weekly", "0.8"),
)
```

Список публичных маршрутов сайта с параметрами:
- **changefreq** — как часто обновляется страница (`weekly`)
- **priority** — приоритет индексации (от 0.0 до 1.0)

Функция `build_sitemap_xml()` генерирует XML по стандарту [sitemaps.org](https://www.sitemaps.org/schemas/sitemap/0.9), включая:
- `<loc>` — полный URL страницы
- `<lastmod>` — дата последнего изменения (текущая дата)
- `<changefreq>` — частота обновления
- `<priority>` — приоритет

**Эндпоинт:** `GET /sitemap.xml` — возвращает XML с Content-Type `application/xml`.

---

### 2.3. Robots.txt (`/robots.txt`)

Функция `build_robots_txt()` возвращает файл в формате:

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /chats
Disallow: /sign-in
Disallow: /sign-up
Disallow: /auth
Disallow: /forbidden
Sitemap: https://<SITE_URL>/sitemap.xml
```

**Логика:**
- Все боты (`User-agent: *`) допускаются на публичные страницы
- Закрыты от индексации: API, административные разделы, авторизационные страницы, личные данные пользователей
- В конце — ссылка на sitemap для поисковых роботов

**Эндпоинт:** `GET /robots.txt` — возвращает plain text.

---

### 2.4. Корневой эндпоинт `/`

В ответ добавлен SEO-блок:

```json
{
  "seo": {
    "robots": "https://<SITE_URL>/robots.txt",
    "sitemap": "https://<SITE_URL>/sitemap.xml"
  }
}
```

Это позволяет API-клиентам программно узнать ссылки на SEO-файлы.

---

## 3. Frontend — `fullstack-chat-frontend/index.html`

### 3.1. Базовые мета-теги

```html
<meta name="description" content="Intelligent Meeting Analyzer помогает командам расшифровывать встречи..." />
<meta name="robots" content="index,follow" />
<meta name="theme-color" content="#0f172a" />
```

| Тег | Назначение |
|---|---|
| `description` | Описание страницы в поисковой выдаче (сниппет) |
| `robots` | Разрешение поисковикам индексировать и переходить по ссылкам |
| `theme-color` | Цвет адресной строки браузера на мобильных устройствах |

---

### 3.2. Open Graph (OG) — превью в соцсетях

```html
<meta property="og:title" content="Intelligent Meeting Analyzer" />
<meta property="og:description" content="Расшифровывайте встречи, фиксируйте решения..." />
<meta property="og:type" content="website" />
<meta property="og:image" content="/og-cover.svg" />
```

Open Graph — стандарт разметки, который используют Facebook, VK, Telegram, LinkedIn и другие соцсети для формирования карточки при публикации ссылки.

| Тег | Назначение |
|---|---|
| `og:title` | Заголовок карточки |
| `og:description` | Описание в карточке |
| `og:type` | Тип контента (`website`) |
| `og:image` | Превью-изображение карточки |

---

### 3.3. Twitter Card

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="/og-cover.svg" />
```

Аналог Open Graph для Twitter/X. Тип `summary_large_image` — большое горизонтальное изображение в карточке твита.

---

### 3.4. Иконка сайта

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

SVG-фавиконка — современный формат, масштабируется без потери качества на любых экранах.

---

## Итоговая структура SEO

```
Проект
├── Backend (FastAPI)
│   ├── GET /robots.txt          ← Управление индексацией
│   ├── GET /sitemap.xml         ← Карта сайта для поисковиков
│   ├── GET /                    ← Ссылки на SEO-файлы в ответе API
│   └── app/config.py            ← SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE
└── Frontend (HTML)
    └── index.html
        ├── <meta name="description">   ← Сниппет в поиске
        ├── <meta name="robots">        ← Директивы для ботов
        ├── <meta name="theme-color">   ← Мобильный браузер
        ├── og:title / og:description   ← Превью в соцсетях
        ├── og:image                    ← Картинка карточки
        ├── twitter:card                ← Twitter/X карточка
        └── favicon.svg                 ← Иконка сайта
```

---

## Как проверить

| Что проверить | Как |
|---|---|
| Sitemap | `GET http://localhost:8000/sitemap.xml` |
| Robots.txt | `GET http://localhost:8000/robots.txt` |
| Open Graph | [opengraph.xyz](https://opengraph.xyz) или расширение для браузера |
| Twitter Card | [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) |
| Мета-теги | DevTools → Elements → `<head>` |