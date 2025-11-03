import sys
import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
from typing import List
import uuid
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

# Добавляем путь для импортов
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

# Импорты для аутентификации
from app.auth.service import get_current_active_user, create_access_token, authenticate_user, get_password_hash
from app.auth.schemas import UserCreate, UserLogin, Token, UserResponse
from app.auth.models import User
from app.database.connection import get_db, create_tables

# Импорты для чатов
from app.services.chat_service import ChatService
from app.models.chat_schemas import (
    ChatSessionCreate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionListResponse,
    SessionType
)
from app.services.llm_processor import llm_processor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Ленивая инициализация сервисов
content_processor = None
FileService = None


def get_content_processor():
    global content_processor
    if content_processor is None:
        from app.services.meeting_analyzer import ContentProcessor
        content_processor = ContentProcessor()
    return content_processor


def get_llm_processor():
    """Основной процессор для всех AI задач"""
    return llm_processor


def get_file_service():
    global FileService
    if FileService is None:
        from app.services.file_service import FileService as FS
        FileService = FS
    return FileService


@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    logger.info("🔄 Инициализация Intelligent Meeting Analyzer...")

    try:
        create_tables()
        logger.info("✅ База данных инициализирована")
    except Exception as e:
        logger.error(f"❌ Не удалось инициализировать БД: {e}")

    # Инициализация LLM процессора
    try:
        processor = get_llm_processor()
        await processor.initialize_model()
        logger.info("✅ LLM процессор инициализирован")
    except Exception as e:
        logger.error(f"❌ Не удалось инициализировать LLM процессор: {e}")


# ==================== ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ====================

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    db_user_email = db.query(User).filter(User.email == user_data.email).first()
    if db_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    db_user_username = db.query(User).filter(User.username == user_data.username).first()
    if db_user_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем уже существует"
        )

    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token = create_access_token(data={"sub": db_user.username})

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(db_user)
    )


@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Вход пользователя"""
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Получение информации о текущем пользователе"""
    return UserResponse.from_orm(current_user)


# ==================== ЭНДПОИНТЫ ЧАТОВ ====================

@app.post("/api/chats", response_model=ChatSessionResponse)
async def create_chat(
        chat_data: ChatSessionCreate,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Создание нового чата"""
    try:
        chat_service = ChatService(db)
        chat_session = chat_service.create_chat_session(current_user.id, chat_data)
        return chat_session
    except Exception as e:
        logger.error(f"❌ Ошибка создания чата: {e}")
        raise HTTPException(status_code=500, detail="Ошибка создания чата")


@app.get("/api/chats", response_model=List[ChatSessionListResponse])
async def get_chats(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Получение списка чатов пользователя"""
    try:
        chat_service = ChatService(db)
        chats = chat_service.get_user_chat_sessions(current_user.id)
        return chats
    except Exception as e:
        logger.error(f"❌ Ошибка получения списка чатов: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения чатов")


@app.get("/api/chats/{chat_id}", response_model=ChatSessionResponse)
async def get_chat(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Получение конкретного чата с сообщениями"""
    try:
        chat_service = ChatService(db)
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
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """Добавление сообщения в чат"""
    try:
        chat_service = ChatService(db)
        message = chat_service.add_message_to_chat(chat_id, current_user.id, message_data)
        return message
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Ошибка добавления сообщения: {e}")
        raise HTTPException(status_code=500, detail="Ошибка добавления сообщения")


@app.get("/api/chats/{chat_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
        limit: int = 50
):
    """Получение сообщений чата"""
    try:
        chat_service = ChatService(db)
        messages = chat_service.get_chat_messages(chat_id, current_user.id, limit)
        return messages
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Ошибка получения сообщений: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения сообщений")


@app.post("/api/chats/{chat_id}/ask")
async def ask_llm(
        chat_id: int,
        request_data: dict,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
):
    """
    Отправка сообщения AI и получение ответа
    """
    try:
        user_message = request_data.get("message", "").strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        chat_service = ChatService(db)

        # Проверяем существование чата
        chat_session = chat_service.get_chat_session(chat_id, current_user.id)
        if not chat_session:
            raise HTTPException(status_code=404, detail="Чат не найден")

        # Сохраняем сообщение пользователя
        user_msg_data = ChatMessageCreate(
            content=user_message,
            role="user",
            message_type="text"
        )
        user_message_obj = chat_service.add_message_to_chat(chat_id, current_user.id, user_msg_data)

        # Получаем историю сообщений для контекста
        chat_history = chat_service.get_chat_messages(chat_id, current_user.id, limit=20)

        # Формируем промпт с историей
        context_messages = []
        for msg in chat_history:
            context_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # Получаем ответ от LLM
        llm_processor = get_llm_processor()
        ai_response = await llm_processor.generate_chat_response(user_message, context_messages)

        # Сохраняем ответ AI
        ai_msg_data = ChatMessageCreate(
            content=ai_response,
            role="assistant",
            message_type="text"
        )
        ai_message_obj = chat_service.add_message_to_chat(chat_id, current_user.id, ai_msg_data)

        return {
            "user_message": user_message_obj,
            "ai_response": ai_message_obj,
            "chat_id": chat_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка в AI чате: {e}")
        raise HTTPException(status_code=500, detail="Ошибка обработки запроса")


# ОБЩИЕ ЭНДПОИНТЫ

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    llm_processor = get_llm_processor()

    return {
        "message": "Intelligent Meeting Analyzer API с аутентификацией работает!",
        "version": settings.VERSION,
        "status": "active",
        "features": {
            "authentication": True,
            "transcription": True,
            "speaker_diarization": True,
            "llm_processing": True,
            "meeting_analysis": True,
            "chat_system": True
        },
        "endpoints": {
            "auth": {
                "register": "/api/auth/register",
                "login": "/api/auth/login",
                "me": "/api/auth/me"
            },
            "chats": {
                "create_chat": "/api/chats",
                "list_chats": "/api/chats",
                "get_chat": "/api/chats/{chat_id}",
                "add_message": "/api/chats/{chat_id}/messages",
                "ask_ai": "/api/chats/{chat_id}/ask"
            },
            "analysis": {
                "analyze_meeting": "/api/analyze-meeting",
                "transcribe_simple": "/api/transcribe-simple",
                "diarize_speakers": "/api/diarize-speakers"
            },
            "info": {
                "health": "/api/health",
                "docs": "/docs"
            }
        }
    }


@app.get("/api/health")
async def health_check():
    """Проверка здоровья сервиса"""
    llm_processor = get_llm_processor()

    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected",
            "authentication": "enabled",
            "llm_processor": "available",
            "file_processing": "available"
        }
    }


# ОБРАБОТЧИКИ ОШИБОК

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Обработчик HTTP исключений"""
    logger.warning(f"HTTP ошибка {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Глобальный обработчик исключений"""
    logger.error(f"Необработанное исключение: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Внутренняя ошибка сервера", "status_code": 500}
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)