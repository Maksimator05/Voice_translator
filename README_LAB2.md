# Лабораторная работа №2
## Аутентификация и авторизация на основе Access + Refresh токенов

---

## Цели работы

1. Реализовать безопасную схему двухтокенной аутентификации (access + refresh)
2. Отделить ответственность между слоями с применением архитектурных паттернов
3. Реализовать согласованную авторизацию на сервере и клиенте с учётом ролей
4. Обеспечить автоматическое обновление токенов без потери пользовательской сессии

---

## Теоретические основы

### JWT (JSON Web Token)

JWT — стандарт (RFC 7519) передачи данных в виде JSON-объекта, подписанного криптографически. Состоит из трёх частей, закодированных в Base64url и разделённых точкой:

```
HEADER.PAYLOAD.SIGNATURE
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJzdWIiOiJ1c2VybmFtZSIsImV4cCI6MTcwMDAwMDAwMH0
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Header** — алгоритм подписи (`HS256`).
**Payload** — claims: `sub` (subject/username), `exp` (expiration).
**Signature** — HMAC-SHA256 от header+payload с секретным ключом.

### Схема двух токенов

| Токен | Время жизни | Назначение | Хранение |
|-------|-------------|------------|----------|
| **Access Token** | 30 минут | Авторизация запросов к API (Bearer) | localStorage (frontend) |
| **Refresh Token** | 30 дней | Получение нового access token | localStorage + хэш в БД |

**Зачем два токена?**
- Короткий access token → даже при компрометации ущерб ограничен 30 минутами
- Длинный refresh token → удобство для пользователя (не нужно перелогиниваться)
- Refresh token можно отозвать на сервере → управляемый logout

### Token Rotation (ротация токенов)

При каждом обновлении access token:
1. Старый refresh token **отзывается** (is_revoked = True в БД)
2. Выдаётся **новая пара** access + refresh токенов

Преимущество: если refresh token украден, злоумышленник может использовать его только один раз. При следующем законном использовании старого токена — он уже отозван → обнаружение компрометации.

### Argon2 — хэширование паролей

Argon2 — победитель конкурса Password Hashing Competition (PHC). Устойчив к:
- Brute-force атакам (регулируемая вычислительная стоимость)
- GPU-атакам (требует много памяти)
- Time-space tradeoff атакам

Альтернативы: bcrypt, scrypt. MD5/SHA-1 — **не подходят** для паролей.

---

## Архитектурные и проектные паттерны

### 1. Layered Architecture (Слоистая архитектура)

```
┌─────────────────────────────────┐
│   API Layer (app/main.py)       │  ← HTTP endpoints, валидация запросов
├─────────────────────────────────┤
│   Service Layer (auth/service.py)│  ← бизнес-логика: токены, хэширование
├─────────────────────────────────┤
│   Repository Layer (SQLAlchemy) │  ← запросы к БД, изоляция данных
├─────────────────────────────────┤
│   Database (SQLite/PostgreSQL)  │  ← персистентность
└─────────────────────────────────┘
```

Каждый слой знает только об интерфейсе нижестоящего слоя, не об его реализации.

### 2. Dependency Injection (DI)

FastAPI реализует DI через `Depends()`. Это позволяет:
- Внедрять зависимости (БД, текущий пользователь) декларативно
- Подменять зависимости в тестах (mocking)
- Переиспользовать логику проверки прав

```python
# Фабрика зависимостей — создаёт зависимость с параметрами
def require_role(*allowed_roles: UserRole):
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(403, ...)
        return current_user
    return dependency

# Использование в endpoint'е
@app.get("/api/admin/users")
async def get_users(current_user: User = Depends(require_admin)):
    ...
```

### 3. Repository Pattern

Функции `create_refresh_token()`, `verify_refresh_token()`, `revoke_refresh_token()` в `service.py` инкапсулируют работу с БД — это паттерн Repository. Endpoint'ы не знают о деталях хранения токенов.

### 4. Token Hashing (безопасное хранение)

Refresh token хранится в БД **только в виде SHA-256 хэша**:

```python
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

# В БД: token_hash = "5d41402abc4b2a76b9719d911017c592"
# У клиента: raw token = "uBJ7Pz2K..."
```

Если БД скомпрометирована — злоумышленник получает только хэши, не токены.

### 5. Queue Pattern (на фронтенде)

При одновременных 401 от нескольких запросов — только **один** делает refresh, остальные ждут в очереди:

```typescript
let isRefreshing = false;
let failedQueue: Array<{resolve, reject}> = [];

// Если уже идёт refresh — добавляем в очередь
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  }).then(newToken => retry with newToken);
}
```

---

## Реализация

### Backend

#### Модель RefreshToken (`app/auth/models.py`)

```python
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    token_hash = Column(String, unique=True, index=True)  # SHA-256
    expires_at = Column(DateTime)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Сервисные функции (`app/auth/service.py`)

| Функция | Описание |
|---------|----------|
| `create_refresh_token(db, user_id)` | Генерирует токен, сохраняет хэш в БД |
| `verify_refresh_token(db, token)` | Ищет по хэшу, проверяет expiry + revoked |
| `revoke_refresh_token(db, token)` | Помечает is_revoked=True |
| `revoke_all_user_refresh_tokens(db, user_id)` | Принудительный выход с всех устройств |

#### Endpoints аутентификации

| Endpoint | Метод | Auth | Назначение |
|----------|-------|------|------------|
| `/api/auth/register` | POST | — | Регистрация → access + refresh |
| `/api/auth/login` | POST | — | Вход → access + refresh |
| `/api/auth/refresh` | POST | — | Обновление access token (ротация) |
| `/api/auth/logout` | POST | Bearer | Отзыв refresh token в БД |
| `/api/auth/me` | GET | Bearer | Данные текущего пользователя |
| `/api/auth/guest-login` | POST | — | Гостевой вход |

#### RBAC

```
GUEST (0) → USER (1) → ADMIN (2)
              │              │
              └─ create chat └─ manage users
                 send messages  view all chats
                                change roles
```

### Frontend

#### Авто-рефреш interceptor (`src/api/index.ts`)

```
Request → 401 ←──────────────────────────────────┐
    │                                             │
    ▼ (если есть refresh_token)                  │
POST /auth/refresh                               │
    │                                            │
    ├─ Success → сохранить новые токены          │
    │            повторить оригинальный запрос ──┘
    │
    └─ Failure → clearAuth() → /auth
```

#### Хранение состояния (`src/store/authSlice.ts`)

```
Действие          localStorage            Redux state
─────────────────────────────────────────────────────
login()      →    access_token             user
                  refresh_token            token
                  user
logout()     →    (clear all)              null, null
401 + no RT  →    (clear all)              null, null
```

---

## Конфигурация

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Время жизни access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 30 | Время жизни refresh token |
| `SECRET_KEY` | — | HMAC ключ для подписи JWT |
| `ALGORITHM` | HS256 | Алгоритм подписи |

---

## Проверка работы

### 1. Регистрация

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","username":"user1","password":"Pass123!"}'

# Ответ:
{
  "access_token": "eyJ...",
  "refresh_token": "uBJ7Pz2K...",
  "token_type": "bearer",
  "user": {"id": 1, "role": "user", ...}
}
```

### 2. Обновление access token

```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "uBJ7Pz2K..."}'

# Ответ: новая пара токенов (старый refresh отозван)
```

### 3. Выход

```bash
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "uBJ7Pz2K..."}'

# Ответ: {"message": "Выход выполнен успешно"}
```

### 4. Попытка обновить после logout

```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -d '{"refresh_token": "uBJ7Pz2K..."}'

# Ответ: 401 Unauthorized — "Refresh token недействителен"
```

### 5. Запуск тестов

```bash
pip install -r requirements-dev.txt
pytest tests/test_auth.py -v
```

---

## Безопасность

| Угроза | Защита |
|--------|--------|
| Перехват access token | Короткое время жизни (30 мин) |
| Компрометация БД с токенами | Хранение SHA-256 хэша, не сырого токена |
| XSS кража токенов | HttpOnly cookies (улучшение); пока localStorage |
| Повторное использование RT | Token rotation — каждый RT одноразовый |
| Brute-force паролей | Argon2 + rate limiting |
| Использование чужих ресурсов | RBAC на каждом endpoint |
