import sys
import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
import uuid
from fastapi.responses import JSONResponse

# Добавляем путь для импортов
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models import schemas
from app.models.meeting_models import MeetingAnalysisResult, KeyPoint
from app.services.file_service import FileService
from app.services.transcription_service import meeting_transcriber
from app.services.meeting_analyzer import ContentProcessor

# Импорты для аутентификации
from app.auth.service import get_current_active_user, create_access_token, authenticate_user, get_password_hash
from app.auth.schemas import UserCreate, UserLogin, Token, UserResponse
from app.auth.models import User
from app.database.connection import get_db, create_tables, engine, Base
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

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

content_processor = ContentProcessor()


def check_database_integrity() -> bool:
    """
    Проверяет целостность и существование базы данных
    Возвращает True если БД в порядке, False если нужно пересоздать
    """
    try:
        # Проверяем подключение к БД
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        # Проверяем существование таблиц
        inspector = inspect(engine)
        tables = inspector.get_table_names()

        # Должна быть как минимум таблица users
        if 'users' not in tables:
            logger.warning("❌ Таблица 'users' не найдена в базе данных")
            return False

        # Проверяем структуру таблицы users
        users_columns = [col['name'] for col in inspector.get_columns('users')]
        required_columns = ['id', 'email', 'username', 'hashed_password', 'is_active']

        for col in required_columns:
            if col not in users_columns:
                logger.warning(f"❌ Отсутствует обязательная колонка '{col}' в таблице users")
                return False

        logger.info("✅ База данных прошла проверку целостности")
        return True

    except Exception as e:
        logger.warning(f"❌ Ошибка проверки целостности БД: {e}")
        return False


def initialize_database():
    """Умная инициализация базы данных"""
    logger.info("🔍 Проверка целостности базы данных...")

    # Проверяем целостность существующей БД
    if check_database_integrity():
        logger.info("✅ Используется существующая база данных")
        return

    # Если БД повреждена или не существует, создаем заново
    logger.info("🔄 Создание/пересоздание базы данных...")

    try:
        # ЯВНО импортируем модели для регистрации в метаданных
        from app.auth.models import User
        logger.info("✅ Модели пользователей зарегистрированы")

        # Создаем все таблицы
        Base.metadata.create_all(bind=engine)

        # Проверяем создание
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logger.info(f"📋 Созданные таблицы: {tables}")

        logger.info("✅ База данных успешно инициализирована")

    except Exception as e:
        logger.error(f"❌ Критическая ошибка инициализации БД: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске"""
    logger.info("🔄 Инициализация Intelligent Meeting Analyzer...")

    # Создаем таблицы в БД
    try:
        from app.database import create_tables
        create_tables()
    except Exception as e:
        logger.error(f"❌ Не удалось инициализировать базу данных: {e}")
        # В продакшене здесь должна быть более сложная логика восстановления
        raise

    # Инициализация ML модели
    try:
        await meeting_transcriber.initialize_model()
        logger.info("✅ Система анализа встреч готова к работе")
    except Exception as e:
        logger.error(f"❌ Не удалось загрузить ML модель: {e}")
        # Продолжаем работу, но без транскрипции
        logger.warning("⚠️ Система будет работать в ограниченном режиме")



# ==================== ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ====================

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверяем, нет ли уже пользователя с таким email
    db_user_email = db.query(User).filter(User.email == user_data.email).first()
    if db_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    # Проверяем, нет ли уже пользователя с таким username
    db_user_username = db.query(User).filter(User.username == user_data.username).first()
    if db_user_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем уже существует"
        )

    # Создаем нового пользователя
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Создаем токен
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

    # Создаем токен
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


# ОБЩИЕ ЭНДПОИНТЫ

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "Intelligent Meeting Analyzer API с аутентификацией работает!",
        "version": settings.VERSION,
        "status": "active",
        "authentication_required": True,
        "endpoints": {
            "auth": {
                "register": "/api/auth/register",
                "login": "/api/auth/login",
                "me": "/api/auth/me"
            },
            "analysis": {
                "analyze_meeting": "/api/analyze-meeting",
                "transcribe_simple": "/api/transcribe-simple"
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
    return {
        "status": "healthy",
        "model_loaded": meeting_transcriber.model_loaded,
        "database": "connected",
        "authentication": "enabled",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/info")
async def api_info():
    """Информация о API"""
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "description": settings.DESCRIPTION,
        "features": [
            "Аутентификация пользователей",
            "Транскрипция аудио (Whisper)",
            "Анализ встреч и лекций",
            "Структурирование контента",
            "Определение водности текста"
        ],
        "models": {
            "transcription": f"Whisper {settings.WHISPER_MODEL_SIZE}",
            "authentication": "JWT + bcrypt"
        }
    }


#ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ АНАЛИЗА

@app.post("/api/analyze-meeting", response_model=schemas.AnalysisResponse)
async def analyze_meeting(
        file: UploadFile = File(..., description="Аудио или видео файл для анализа"),
        current_user: User = Depends(get_current_active_user)
):
    """
    Интеллектуальный анализ встречи: транскрипция, анализ содержания, генерация конспекта.
    Требуется аутентификация.
    """
    logger.info(f"🎯 Запрос на анализ от пользователя: {current_user.username} - {file.filename}")

    # Валидация файла
    FileService.validate_voice_file(file)
    analysis_id = f"meeting_{uuid.uuid4().hex[:8]}"
    temp_file_path = None

    try:
        # Сохраняем файл
        temp_file_path = await FileService.save_temporary_file(file, analysis_id)
        logger.info(f"📁 Файл сохранен для пользователя {current_user.username}")

        # Транскрипция встречи
        start_time = datetime.now()
        transcription_result = await meeting_transcriber.transcribe_meeting(temp_file_path)
        logger.info(f"✅ Транскрипция завершена для пользователя {current_user.username}")

        # Анализ содержания
        analysis_data = await content_processor.process_meeting_content(
            transcription_result["text"],
            transcription_result["duration"]
        )

        # Создаем результат анализа
        result = MeetingAnalysisResult(
            meeting_id=analysis_id,
            original_filename=file.filename,
            duration_seconds=transcription_result["duration"],
            total_speakers=1,
            speakers=[],
            segments=[],
            key_points=[KeyPoint(
                text=f"Анализ выполнен пользователем: {current_user.username}",
                importance_score=0.9,
                speakers=["system"],
                timestamp=0.0
            )],
            tasks=[],
            decisions=[],
            summary=analysis_data["summary"],
            water_content_ratio=analysis_data["water_content"],
            processing_time=(datetime.now() - start_time).total_seconds(),
            created_at=datetime.now()
        )

        logger.info(f"🎉 Анализ завершен успешно для пользователя {current_user.username}")

        return schemas.AnalysisResponse(
            analysis_id=analysis_id,
            status="completed",
            result=result,
            processing_time=result.processing_time
        )

    except Exception as e:
        logger.error(f"❌ Ошибка анализа встречи {analysis_id} для пользователя {current_user.username}: {e}")
        return schemas.AnalysisResponse(
            analysis_id=analysis_id,
            status="error",
            error_message=str(e),
            processing_time=0
        )
    finally:
        if temp_file_path:
            FileService.cleanup_temp_file(temp_file_path)


@app.post("/api/transcribe-simple", response_model=schemas.SimpleTranscriptionResponse)
async def transcribe_simple(
        file: UploadFile = File(..., description="Аудио файл для простой транскрипции"),
        current_user: User = Depends(get_current_active_user)
):
    """
    Упрощенная транскрипция аудио файла.
    Требуется аутентификация.
    """
    logger.info(f"🎵 Запрос на транскрипцию от пользователя: {current_user.username}")

    FileService.validate_voice_file(file)
    transcription_id = FileService.generate_transcription_id()
    temp_file_path = None

    try:
        temp_file_path = await FileService.save_temporary_file(file, transcription_id)
        result = await meeting_transcriber.transcribe_meeting(temp_file_path)

        logger.info(f"✅ Простая транскрипция завершена для пользователя {current_user.username}")

        return schemas.SimpleTranscriptionResponse(
            transcription_id=transcription_id,
            original_filename=file.filename,
            raw_text=result["text"],
            detected_language=result["language"],
            processing_time=result["processing_time"],
            created_at=datetime.now()
        )
    except Exception as e:
        logger.error(f"❌ Ошибка транскрипции для пользователя {current_user.username}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка транскрипции: {str(e)}")
    finally:
        if temp_file_path:
            FileService.cleanup_temp_file(temp_file_path)


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

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )