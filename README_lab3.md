# Лабораторная работа №3 — Фильтрация, управление данными и объектное хранилище

## Теоретическая база

### Фильтрация, сортировка и пагинация на сервере
При работе с большими наборами данных важно передавать параметры отбора на сервер, а не тянуть всё на клиент. Сервер принимает их как **query-параметры** HTTP-запроса: `GET /api/chats?search=hello&session_type=audio&page=2&page_size=10`. Это снижает нагрузку на сеть и базу данных. FastAPI позволяет объявить такие параметры прямо в сигнатуре эндпоинта с автоматической валидацией через `Query(...)`.

### Сохранение состояния фильтров через URL
Чтобы состояние фильтров сохранялось при навигации и обновлении страницы, оно хранится в **query-параметрах URL** (`?search=foo&session_type=audio`). React Router предоставляет хук `useSearchParams`, который читает и записывает эти параметры без перезагрузки страницы. При каждом изменении фильтра компонент обновляет URL (`setSearchParams`), а `useEffect`, зависящий от `searchParams`, отправляет запрос к API.

### Объектное хранилище (S3)
**Объектное хранилище** — способ хранения файлов в виде объектов (файл + метаданные + уникальный ключ). **Amazon S3** — де-факто стандарт API для таких хранилищ. **MinIO** — self-hosted S3-совместимое хранилище, которое поднимается в Docker без внешних зависимостей.

Ключевые понятия:
- **Bucket** — логический контейнер для файлов (аналог корневой папки).
- **S3 Key** — уникальный путь к объекту внутри bucket, например `chats/42/abc123.pdf`.
- **Pre-signed URL** — временная подписанная ссылка (по умолчанию 1 час), дающая доступ к файлу без раскрытия credentials. Генерируется сервером по запросу авторизованного пользователя. Клиент открывает ссылку напрямую, минуя бэкенд.

### RBAC и файлы
Права доступа к файлам должны согласовываться с ролевой моделью: загружать может `user`/`admin`, скачивать и удалять — только **владелец** или **admin**.

---

## Что реализовано

### 1. Фильтрация, поиска, сортировка и пагинация чатов

#### Бэкенд — `app/services/chat_service.py`

Методы `get_user_chat_sessions()` и `get_all_chat_sessions()` расширены параметрами фильтрации:

```python
def get_user_chat_sessions(
    self,
    user_id: int,
    search: Optional[str] = None,        # поиск по заголовку (ILIKE)
    session_type: Optional[str] = None,  # text | audio | meeting
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = "created_at",         # created_at | updated_at | title
    sort_order: str = "desc",            # asc | desc
    page: int = 1,
    page_size: int = 10,
    paginate: bool = False,              # True → вернуть PaginatedResponse
):
```

Вспомогательные методы:

```python
def _apply_filters(self, query, search, session_type, date_from, date_to):
    if search:
        query = query.filter(ChatSession.title.ilike(f"%{search}%"))
    if session_type:
        query = query.filter(ChatSession.session_type == session_type)
    if date_from:
        query = query.filter(ChatSession.created_at >= date_from)
    if date_to:
        query = query.filter(ChatSession.created_at <= date_to)
    return query

def _apply_sort(self, query, sort_by: str, sort_order: str):
    sort_column_map = {
        "created_at": ChatSession.created_at,
        "updated_at": ChatSession.updated_at,
        "title": ChatSession.title,
    }
    column = sort_column_map.get(sort_by, ChatSession.created_at)
    return query.order_by(asc(column) if sort_order == "asc" else desc(column))
```

При `paginate=True` возвращается `PaginatedResponse`:

```python
# app/models/chat_schemas.py
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int
```

#### Бэкенд — `app/main.py`, `GET /api/chats`

```python
@app.get("/api/chats")
async def get_chats(
    search: Optional[str] = Query(None),
    session_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    paginate: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    # Валидация sort_by и sort_order на месте
    if sort_by not in ("created_at", "updated_at", "title"):
        sort_by = "created_at"
    if sort_order not in ("asc", "desc"):
        sort_order = "desc"
    # admin видит все чаты
    if current_user.role == UserRole.ADMIN:
        return chat_service.get_all_chat_sessions(**kwargs)
    return chat_service.get_user_chat_sessions(current_user.id, **kwargs)
```

#### Фронтенд — `src/components/chat/ChatFilters.tsx`

Панель фильтров с 6 параметрами, синхронизированными с URL:

| Элемент UI | Параметр URL | Описание |
|---|---|---|
| TextField (поиск) | `search` | Поиск по заголовку чата |
| Select | `session_type` | Фильтр по типу (All/Text/Audio/Meeting) |
| Select | `sort_by` | Поле сортировки |
| ToggleButtonGroup | `sort_order` | Направление (↑ asc / ↓ desc) |
| TextField type=date | `date_from` | Нижняя граница даты создания |
| TextField type=date | `date_to` | Верхняя граница даты создания |

```tsx
// Читаем все фильтры из URL
const [searchParams, setSearchParams] = useSearchParams();
const filters: FilterState = {
    search: searchParams.get('search') ?? '',
    session_type: searchParams.get('session_type') ?? '',
    // ...
};

// При изменении обновляем URL (без перезагрузки)
const update = (patch: Partial<FilterState>) => {
    const params = new URLSearchParams();
    // Пишем только непустые/нестандартные значения
    if (next.search) params.set('search', next.search);
    // ...
    setSearchParams(params, { replace: true });
};
```

Кнопка «Clear filters» появляется только когда активен хотя бы один фильтр.

#### Фронтенд — `src/pages/Chats.tsx` (пагинация)

```tsx
// Слушаем изменения URL → перезапрашиваем список
useEffect(() => {
    const filters = {
        search: searchParams.get('search') || undefined,
        session_type: searchParams.get('session_type') || undefined,
        // ...
        page: currentPage,
        page_size: 10,
        paginate: true,
    };
    dispatch(fetchChats(filters));
}, [searchParams, currentPage]);

// MUI Pagination под списком чатов
{pagination && pagination.pages > 1 && (
    <Pagination
        count={pagination.pages}
        page={currentPage}
        onChange={(_, p) => setCurrentPage(p)}
    />
)}
```

---

### 2. Объектное хранилище (MinIO/S3)

#### Инфраструктура — `docker-compose.yml`

```yaml
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # Web-консоль MinIO
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 10s
    retries: 3
  networks:
    - app-network
```

Backend в `depends_on` ждёт healthcheck MinIO перед стартом.

Переменные среды для бэкенда:
```
S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=voice-translator
```

#### Бэкенд — `app/services/storage_service.py`

Сервис работает с MinIO через boto3 (S3-совместимый API):

```python
class StorageService:
    ALLOWED_CONTENT_TYPES = {
        "image/jpeg", "image/png", "image/gif",
        "application/pdf", "text/plain",
        "audio/mpeg", "audio/wav",
    }
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    def validate_file(self, file_size: int, content_type: str) -> Optional[str]:
        """Возвращает сообщение об ошибке или None."""
        if file_size > MAX_FILE_SIZE:
            return "File is too large. Maximum allowed size is 10 MB."
        if content_type not in ALLOWED_CONTENT_TYPES:
            return f"File type '{content_type}' is not allowed."
        return None

    def upload_file(self, file_bytes: bytes, s3_key: str, content_type: str) -> bool:
        client = self._get_client()
        client.put_object(Bucket=self._bucket, Key=s3_key,
                          Body=file_bytes, ContentType=content_type)

    def get_presigned_url(self, s3_key: str, expires: int = 3600) -> str:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": s3_key},
            ExpiresIn=expires,
        )

    def delete_file(self, s3_key: str) -> bool:
        client.delete_object(Bucket=self._bucket, Key=s3_key)
```

Клиент создаётся лениво при первом обращении. Bucket автоматически создаётся при инициализации, если не существует.

#### Бэкенд — модель `FileAttachment` (`app/models/file_models.py`)

```python
class FileAttachment(Base):
    __tablename__ = "file_attachments"

    id              = Column(Integer, primary_key=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    original_filename = Column(String(255), nullable=False)
    content_type    = Column(String(100), nullable=False)
    file_size       = Column(Integer, nullable=False)  # байты
    s3_key          = Column(String(500), nullable=False, unique=True)  # путь в MinIO
    created_at      = Column(DateTime, default=datetime.utcnow)
```

`s3_key` формируется как `chats/{chat_id}/{uuid}{ext}` — уникален для каждого файла.

#### Бэкенд — эндпоинты файлов (`app/main.py`)

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| POST | `/api/chats/{id}/files` | user, admin | Загрузка файла (multipart/form-data) |
| GET | `/api/chats/{id}/files` | авторизован | Список файлов чата |
| GET | `/api/files/{id}/url` | владелец, admin | Pre-signed URL для скачивания |
| DELETE | `/api/files/{id}` | владелец, admin | Удаление файла из S3 + БД |

**Загрузка файла:**
```python
@app.post("/api/chats/{chat_id}/files", response_model=FileAttachmentResponse)
async def upload_file(
    chat_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_user_or_above),
    db: Session = Depends(get_db),
):
    file_bytes = await file.read()
    content_type = file.content_type or "application/octet-stream"

    # Валидация типа и размера
    error = storage_service.validate_file(len(file_bytes), content_type)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # Уникальный ключ в S3
    s3_key = f"chats/{chat_id}/{uuid4().hex}{ext}"
    storage_service.upload_file(file_bytes, s3_key, content_type)

    # Сохранение метаданных в БД
    attachment = FileAttachment(user_id=current_user.id, ...)
    db.add(attachment)
    db.commit()
    return attachment
```

**Pre-signed URL — безопасное скачивание:**
```python
@app.get("/api/files/{file_id}/url", response_model=FileDownloadResponse)
async def get_file_url(file_id: int, current_user: User = Depends(...)):
    # Только владелец или admin
    if attachment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Нет доступа к файлу")

    url = storage_service.get_presigned_url(attachment.s3_key)  # истекает через 1 час
    return FileDownloadResponse(url=url)
```

**Удаление — сначала S3, потом БД:**
```python
@app.delete("/api/files/{file_id}", status_code=204)
async def delete_file(file_id: int, ...):
    # Права: владелец или admin
    try:
        storage_service.delete_file(attachment.s3_key)
    except RuntimeError as e:
        # Если файл уже удалён из S3 — не падаем, всё равно чистим БД
        logger.warning(f"Could not delete from S3: {e}")
    db.delete(attachment)
    db.commit()
```

---

### 3. Клиентская часть работы с файлами

#### `src/api/files.ts`

```typescript
export const filesApi = {
    uploadFile: (chatId: number, file: File): Promise<FileAttachment> => {
        const form = new FormData();
        form.append('file', file);
        return api.post(`/chats/${chatId}/files`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }).then(r => r.data);
    },
    getChatFiles: (chatId: number): Promise<FileAttachment[]> =>
        api.get(`/chats/${chatId}/files`).then(r => r.data),
    getFileUrl: (fileId: number): Promise<FileDownloadResponse> =>
        api.get(`/files/${fileId}/url`).then(r => r.data),
    deleteFile: (fileId: number): Promise<void> =>
        api.delete(`/files/${fileId}`).then(r => r.data),
};
```

#### `src/components/chat/FileUpload.tsx`

Компонент загрузки файла встроен в область ввода чата:

1. **Кнопка с иконкой скрепки** (`AttachFile`) — открывает скрытый `<input type="file">`.
2. **Предварительный просмотр** — после выбора показывает `Chip` с именем и размером файла.
3. **Клиентская валидация** — проверяет MIME-тип и размер до отправки на сервер, выводит `Alert` с ошибкой.
4. **Кнопка Upload + LinearProgress** — после нажатия показывает прогресс-бар.
5. **Сброс** — крестик на Chip снимает выбор файла.

```tsx
const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!ALLOWED_TYPES.has(file.type)) {
        setError(`File type "${file.type}" is not allowed.`);
        return;
    }
    if (file.size > MAX_SIZE) {
        setError(`File is too large (${formatBytes(file.size)}). Maximum is 10 MB.`);
        return;
    }
    setSelectedFile(file);
};

const handleUpload = async () => {
    setUploading(true);
    setProgress(30);
    const attachment = await filesApi.uploadFile(chatId, selectedFile);
    setProgress(100);
    onUploaded?.(attachment);  // обновляем список файлов
};
```

#### `src/components/chat/FileAttachments.tsx`

Список файлов чата, отображается под сообщениями:

- **Иконка по типу**: изображение → зелёная `Image`, PDF → красная `PictureAsPdf`, аудио → розовая `AudioFile`, прочее → серая `InsertDriveFile`.
- **Кнопка скачивания** — запрашивает pre-signed URL → `window.open(url, '_blank')`.
- **Кнопка удаления** — показывает диалог подтверждения, затем удаляет через API.
- **Права** — кнопка удаления рендерится только если `file.user_id === currentUserId` или `isAdmin`.
- **refreshToken** — prop, который меняется после загрузки нового файла, вызывая `useEffect` с повторным fetch.

```tsx
const canDelete = (file: FileAttachment) =>
    isAdmin || file.user_id === currentUserId;

const handleDownload = async (file: FileAttachment) => {
    const { url } = await filesApi.getFileUrl(file.id);
    window.open(url, '_blank', 'noopener,noreferrer');
};
```

---

## Структура изменённых файлов

```
Voice_translator/
├── app/
│   ├── config.py                      # + S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME
│   ├── main.py                        # + file endpoints, updated GET /api/chats
│   ├── models/
│   │   ├── chat_schemas.py            # + PaginatedResponse[T]
│   │   ├── file_models.py             # NEW — FileAttachment ORM
│   │   └── file_schemas.py            # NEW — FileAttachmentResponse, FileDownloadResponse
│   ├── services/
│   │   ├── chat_service.py            # + filtering, sorting, pagination
│   │   └── storage_service.py         # NEW — MinIO/S3 integration
│   └── database/
│       └── connection.py              # + import file_models (auto table creation)
├── fullstack-chat-frontend/src/
│   ├── api/
│   │   ├── chat.ts                    # + ChatFilters params
│   │   └── files.ts                   # NEW — uploadFile, getChatFiles, getFileUrl, deleteFile
│   ├── components/chat/
│   │   ├── ChatFilters.tsx            # NEW — filter panel + URL sync
│   │   ├── FileAttachments.tsx        # NEW — file list with download/delete
│   │   └── FileUpload.tsx             # NEW — upload button + progress
│   ├── pages/
│   │   └── Chats.tsx                  # + ChatFilters, Pagination, FileUpload, FileAttachments
│   ├── store/
│   │   └── chatSlice.ts               # + pagination state in fetchChats
│   └── types/
│       └── files.ts                   # NEW — FileAttachment, FileDownloadResponse
├── docker-compose.yml                 # + minio service + minio_data volume
├── requirements.txt                   # + boto3==1.38.0
└── .env                               # + S3_* variables
```

---

## Запуск

```bash
# Поднять всё (бэкенд + фронтенд + MinIO)
docker compose up --build

# MinIO web-консоль — http://localhost:9001
# Логин: minioadmin / minioadmin

# API docs — http://localhost:8000/docs
# Приложение — http://localhost:3000
```

### Локальный запуск без Docker

```bash
# 1. MinIO (отдельно)
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# 2. Бэкенд
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Фронтенд
cd fullstack-chat-frontend
npm install
npm run dev
```

---

## Проверка функциональности

### Фильтрация и пагинация
1. Открыть `/chats` — в боковой панели появится форма фильтров.
2. Ввести текст в поиск → список чатов фильтруется в реальном времени, URL обновляется (`?search=hello`).
3. Выбрать тип "Audio" → показываются только аудио-чаты.
4. Установить диапазон дат → только чаты за период.
5. Нажать ↑/↓ и выбрать "Title" → список пересортируется.
6. Обновить страницу → фильтры восстановятся из URL.
7. При более 10 чатах внизу появится пагинация.

### Работа с файлами
1. Открыть любой чат.
2. Нажать иконку скрепки (`📎`) рядом с полем ввода.
3. Выбрать файл. Если тип/размер не соответствуют — появится ошибка.
4. Нажать Upload → прогресс-бар → файл появится в секции "Attachments" под сообщениями.
5. Нажать ↓ (скачать) → браузер откроет файл по pre-signed URL.
6. Нажать 🗑️ (удалить) → диалог подтверждения → файл исчезает из списка.

### Ограничения доступа
- Гость (`guest`) не может загружать файлы (endpoint требует роль `user`).
- Пользователь видит только свои файлы и не может удалить чужие.
- Admin может скачивать и удалять файлы любого пользователя.
- Попытка получить pre-signed URL чужого файла возвращает `403 Forbidden`.
