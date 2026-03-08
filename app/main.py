import asyncio
import base64
import tempfile
import os

from fastapi import FastAPI, Depends, status, UploadFile, File, HTTPException, Form
from datetime import datetime
import logging
from typing import List, Optional, Dict
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from app.models.chat_models import ChatMessage
from app.config import settings
from app.auth.service import (
    get_current_active_user,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
    authenticate_user,
    get_password_hash,
    require_admin,
    require_user_or_above,
)
from app.auth.schemas import (
    UserCreate, UserLogin, Token, UserResponse, UserRoleUpdate,
    RefreshTokenRequest, LogoutRequest,
)
from app.auth.models import User, UserRole
from app.database.connection import get_db, create_tables
from app.services.chat_service import ChatService
from app.models.chat_schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionListResponse,
    DeleteChatResponse,
)
from app.services.llm_processor import LLMProcessor
from app.services.audio_processor import audio_processor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    max_request_size=50 * 1024 * 1024,
)

# Long polling: словарь очередей для каждого пользователя
long_polling_connections: Dict[int, List[asyncio.Queue]] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)

llm_processor = LLMProcessor()


@app.on_event("startup")
async def startup_event():
    logger.info("🔄 Инициализация Intelligent Meeting Analyzer...")
    try:
        create_tables()
        logger.info("✅ База данных инициализирована")
    except Exception as e:
        logger.error(f"❌ Не удалось инициализировать БД: {e}")

    # ── Создаём аккаунт администратора при первом запуске ──────────────────
    try:
        db = next(get_db())
        admin_email = "max@example.com"
        if not db.query(User).filter(User.email == admin_email).first():
            admin_user = User(
                email=admin_email,
                username="max",
                hashed_password=get_password_hash("1234"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            logger.info("✅ Администратор max@example.com создан (пароль: 1234)")
        else:
            logger.info("ℹ️  Администратор max@example.com уже существует")
        db.close()
    except Exception as e:
        logger.error(f"❌ Ошибка создания администратора: {e}")
    # ───────────────────────────────────────────────────────────────────────

    try:
        await llm_processor.initialize_model()
        logger.info("✅ LLM процессор инициализирован")
    except Exception as e:
        logger.error(f"❌ Не удалось инициализировать LLM процессор: {e}")


# ==================== ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ====================

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Регистрация нового пользователя.
    Возвращает access token (30 мин) и refresh token (30 дней).
    Паттерн: Service Layer — логика хэширования и генерации токенов вынесена в service.py.
    """
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")

    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=UserRole.USER,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token = create_access_token(data={"sub": db_user.username})
    refresh_token = create_refresh_token(db, db_user.id)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(db_user),
    )


@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Вход в систему.
    Возвращает access token (30 мин) и refresh token (30 дней).
    Пароль проверяется через Argon2 (устойчив к GPU-атакам).
    """
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

    access_token = create_access_token(data={"sub": user.username})
    refresh_token = create_refresh_token(db, user.id)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(user),
    )


@app.post("/api/auth/refresh", response_model=Token)
async def refresh_token_endpoint(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Обновление access token через refresh token.
    Реализует ротацию токенов (Token Rotation):
    - старый refresh token отзывается
    - выдаётся новая пара access + refresh токенов
    Защита: если refresh token отозван или истёк — 401.
    """
    db_token = verify_refresh_token(db, body.refresh_token)
    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token недействителен или истёк",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Пользователь не найден или деактивирован")

    # Ротация: отзываем старый refresh token
    revoke_refresh_token(db, body.refresh_token)

    # Выдаём новую пару токенов
    new_access_token = create_access_token(data={"sub": user.username})
    new_refresh_token = create_refresh_token(db, user.id)

    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(user),
    )


@app.post("/api/auth/logout")
async def logout(
    body: LogoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Выход из системы: отзывает refresh token в БД.
    После этого /auth/refresh с этим токеном вернёт 401.
    Access token остаётся валидным до истечения (30 мин) — stateless JWT.
    """
    revoke_refresh_token(db, body.refresh_token)
    return {"message": "Выход выполнен успешно"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return UserResponse.from_orm(current_user)


@app.post("/api/auth/guest-login", response_model=Token)
async def guest_login(db: Session = Depends(get_db)):
    """
    Вход как гость — без регистрации.
    Создаёт временного пользователя с ролью GUEST.
    Гость может сделать не более 3 расшифровок аудио (счётчик в localStorage фронтенда).
    """
    import uuid
    guest_id = str(uuid.uuid4())[:8]
    guest_email = f"guest_{guest_id}@example.com"
    guest_username = f"guest_{guest_id}"

    guest_user = User(
        email=guest_email,
        username=guest_username,
        hashed_password=get_password_hash(guest_id),
        role=UserRole.GUEST,
        is_active=True,
    )
    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)

    # Автоматически создаём чат для гостя чтобы он мог делать расшифровки
    try:
        chat_service = ChatService(db)
        chat_data = ChatSessionCreate(title="Guest Chat", session_type="audio")
        chat_service.create_chat_session(guest_user.id, chat_data)
    except Exception as e:
        logger.warning(f"Не удалось создать чат для гостя: {e}")

    access_token = create_access_token(data={"sub": guest_user.username})
    refresh_token = create_refresh_token(db, guest_user.id)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.from_orm(guest_user),
    )


# ==================== ЭНДПОИНТЫ ЧАТОВ ====================

@app.post("/api/chats", response_model=ChatSessionResponse)
async def create_chat(
    chat_data: ChatSessionCreate,
    current_user: User = Depends(require_user_or_above),
    db: Session = Depends(get_db),
):
    """Создание нового чата. Доступно: user, admin."""
    try:
        chat_service = ChatService(db)
        return chat_service.create_chat_session(current_user.id, chat_data)
    except Exception as e:
        logger.error(f"❌ Ошибка создания чата: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания чата")


@app.get("/api/chats", response_model=List[ChatSessionListResponse])
async def get_chats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Получение списка чатов. Admin видит все чаты."""
    try:
        chat_service = ChatService(db)
        if current_user.role == UserRole.ADMIN:
            return chat_service.get_all_chat_sessions()
        return chat_service.get_user_chat_sessions(current_user.id)
    except Exception as e:
        logger.error(f"❌ Ошибка получения списка чатов: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения чатов")


@app.get("/api/chats/{chat_id}", response_model=ChatSessionResponse)
async def get_chat(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Получение чата. Admin может смотреть чужие чаты."""
    try:
        chat_service = ChatService(db)
        if current_user.role == UserRole.ADMIN:
            chat_session = chat_service.get_chat_session_by_id(chat_id)
        else:
            chat_session = chat_service.get_chat_session(chat_id, current_user.id)

        if not chat_session:
            raise HTTPException(status_code=404, detail="Чат не найден")
        return chat_session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка получения чата: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения чата")


@app.post("/api/chats/{chat_id}/messages", response_model=ChatMessageResponse)
async def add_message(
    chat_id: int,
    message_data: ChatMessageCreate,
    current_user: User = Depends(require_user_or_above),
    db: Session = Depends(get_db),
):
    """Отправка сообщения. Доступно: user, admin."""
    try:
        chat_service = ChatService(db)

        audio_file_path = None
        if message_data.audio_data:
            try:
                audio_bytes = base64.b64decode(message_data.audio_data.split(",")[1])
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                    temp_file.write(audio_bytes)
                    audio_file_path = temp_file.name
            except Exception as e:
                logger.error(f"❌ Ошибка обработки аудио: {e}")
                raise HTTPException(status_code=400, detail="Неверный формат аудио")

        message = await chat_service.add_message_to_chat(
            chat_id, current_user.id, message_data, audio_file_path
        )

        if audio_file_path and os.path.exists(audio_file_path):
            os.unlink(audio_file_path)

        update_data = {
            "type": "new_message",
            "data": {
                "chat_id": chat_id,
                "message": {
                    "id": message.id,
                    "content": message.content,
                    "role": message.role,
                    "message_type": message.message_type,
                    "created_at": message.created_at.isoformat(),
                    "audio_filename": message.audio_filename,
                    "audio_transcription": message.audio_transcription,
                },
            },
        }
        await broadcast_update(current_user.id, update_data)

        return message
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Ошибка добавления сообщения: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления сообщения")


@app.post("/api/chats/{chat_id}/ask")
async def ask_llm(
    chat_id: int,
    message: str = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_user_or_above),
    db: Session = Depends(get_db),
):
    """Запрос к AI. Доступно: user, admin."""
    try:
        if not message and not audio_file:
            raise HTTPException(status_code=400, detail="Нужно сообщение или аудио")

        chat_service = ChatService(db)

        # Admin может отправлять запросы в любой чат
        if current_user.role == UserRole.ADMIN:
            chat = chat_service.get_chat_session_by_id(chat_id)
        else:
            chat = chat_service.get_chat_session(chat_id, current_user.id)

        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        audio_transcription = None
        if audio_file and audio_file.filename:
            audio_transcription = await audio_processor.process_audio_file(audio_file, llm_processor)

        message_content = message or ""
        if audio_transcription and not message_content:
            message_content = "[Аудиосообщение]"

        message_data = ChatMessageCreate(
            content=message_content,
            role="user",
            message_type="audio" if audio_file else "text",
            audio_filename=audio_file.filename if audio_file else None,
            audio_transcription=audio_transcription,
        )

        # Для admin используем owner_id чата, а не current_user.id
        owner_id = chat.user_id
        user_message_obj = await chat_service.add_message_to_chat(chat_id, owner_id, message_data)

        ai_prompt = message or ""
        if audio_transcription and audio_transcription not in (
            "[Транскрипция не удалась]", "[Транскрипция пустая]"
        ) and not audio_transcription.startswith("[Ошибка:"):
            ai_prompt = (ai_prompt + f"\n\nТранскрипция аудио: {audio_transcription}").strip()

        try:
            chat_history = chat_service.get_chat_messages(chat_id, owner_id, limit=10)
        except Exception as e:
            logger.error(f"❌ Ошибка получения истории: {e}")
            chat_history = []

        context_messages = [{"role": m.role, "content": m.content} for m in chat_history]
        ai_response = await llm_processor.generate_chat_response(ai_prompt, context_messages)

        ai_msg_data = ChatMessageCreate(content=ai_response, role="assistant", message_type="text")
        ai_message_obj = await chat_service.add_message_to_chat(chat_id, owner_id, ai_msg_data)

        return {
            "user_message": user_message_obj,
            "ai_response": ai_message_obj,
            "chat_id": chat_id,
            "audio_transcription": audio_transcription,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка в AI чате: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки запроса")


@app.delete("/api/chats/{chat_id}", response_model=DeleteChatResponse)
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Удаление чата. Admin может удалить любой чат."""
    try:
        chat_service = ChatService(db)

        if current_user.role == UserRole.ADMIN:
            chat = chat_service.get_chat_session_by_id(chat_id)
        else:
            chat = chat_service.get_chat_session(chat_id, current_user.id)

        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        messages_count = db.query(ChatMessage).filter(
            ChatMessage.chat_session_id == chat_id
        ).count()

        await chat_service.delete_chat_session(chat_id, chat.user_id)

        return DeleteChatResponse(
            success=True,
            message="Чат успешно удалён",
            deleted_chat_id=chat_id,
            deleted_messages_count=messages_count,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Ошибка удаления чата {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка удаления чата")


# ==================== ЭНДПОИНТЫ АДМИНИСТРАТОРА ====================

@app.get("/api/admin/users", response_model=List[UserResponse])
async def get_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Список всех пользователей. Только admin."""
    users = db.query(User).all()
    return [UserResponse.from_orm(u) for u in users]


@app.patch("/api/admin/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Изменение роли пользователя. Только admin. Нельзя менять свою роль."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя изменить собственную роль")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.role = role_data.role
    db.commit()
    db.refresh(user)

    logger.info(f"Admin {current_user.username} изменил роль {user.username} на {role_data.role}")
    return UserResponse.from_orm(user)


@app.patch("/api/admin/users/{user_id}/activate", response_model=UserResponse)
async def toggle_user_active(
    user_id: int,
    is_active: bool,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Активация/деактивация пользователя. Только admin."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return UserResponse.from_orm(user)


@app.delete("/api/admin/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Удаление пользователя. Только admin. Нельзя удалить самого себя."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    db.delete(user)
    db.commit()
    logger.info(f"Admin {current_user.username} удалил пользователя {user.username}")
    return None


# ==================== LONG POLLING ====================

@app.get("/api/longpolling/updates")
async def get_updates(
    user_id: int,
    since: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    since_time = datetime.fromisoformat(since.replace("Z", "+00:00"))
    updates_queue: asyncio.Queue = asyncio.Queue()

    if user_id not in long_polling_connections:
        long_polling_connections[user_id] = []
    long_polling_connections[user_id].append(updates_queue)

    try:
        immediate_updates = await check_immediate_updates(user_id, since_time, db)
        if immediate_updates:
            long_polling_connections[user_id].remove(updates_queue)
            return {"updates": immediate_updates, "last_update": datetime.now().isoformat()}

        try:
            update = await asyncio.wait_for(updates_queue.get(), timeout=25)
            long_polling_connections[user_id].remove(updates_queue)
            return {"updates": [update], "last_update": datetime.now().isoformat()}
        except asyncio.TimeoutError:
            long_polling_connections[user_id].remove(updates_queue)
            return {"updates": [], "last_update": since}

    except Exception as e:
        if user_id in long_polling_connections and updates_queue in long_polling_connections[user_id]:
            long_polling_connections[user_id].remove(updates_queue)
        raise HTTPException(status_code=500, detail=str(e))


async def check_immediate_updates(user_id: int, since_time: datetime, db: Session):
    try:
        updates = []
        chat_service = ChatService(db)
        user_chats = chat_service.get_user_chat_sessions(user_id)

        for chat in user_chats:
            new_messages = (
                db.query(ChatMessage)
                .filter(
                    ChatMessage.chat_session_id == chat.id,
                    ChatMessage.created_at > since_time,
                )
                .order_by(ChatMessage.created_at.desc())
                .limit(10)
                .all()
            )
            for message in new_messages:
                updates.append({
                    "type": "new_message",
                    "data": {
                        "chat_id": chat.id,
                        "message": {
                            "id": message.id,
                            "content": message.content,
                            "role": message.role,
                            "message_type": message.message_type,
                            "created_at": message.created_at.isoformat(),
                            "audio_filename": message.audio_filename,
                            "audio_transcription": message.audio_transcription,
                        },
                    },
                })
        return updates
    except Exception as e:
        logger.error(f"Ошибка при проверке немедленных обновлений: {e}")
        return []


async def broadcast_update(user_id: int, update_data: dict):
    if user_id not in long_polling_connections:
        return
    for queue in long_polling_connections[user_id][:]:
        try:
            await queue.put(update_data)
        except Exception as e:
            logger.error(f"Ошибка трансляции для пользователя {user_id}: {e}")
            long_polling_connections[user_id].remove(queue)


# ==================== ОБЩИЕ ЭНДПОИНТЫ ====================

@app.get("/")
async def root():
    return {
        "message": "Intelligent Meeting Analyzer API с RBAC работает!",
        "version": settings.VERSION,
        "status": "active",
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected",
            "authentication": "enabled",
            "rbac": "enabled",
            "llm_processor": "available",
        },
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.warning(f"HTTP ошибка {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Необработанное исключение: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Внутренняя ошибка сервера", "status_code": 500},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)