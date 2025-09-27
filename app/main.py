import sys
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
import uuid

# Добавляем путь для импортов
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.models import schemas
from app.models.meeting_models import MeetingAnalysisResult, KeyPoint
from app.services.file_service import FileService
from app.services.transcription_service import meeting_transcriber
from app.services.meeting_analyzer import ContentProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",  # Явно указываем URL для документации
    redoc_url="/redoc"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

content_processor = ContentProcessor()

@app.on_event("startup")
async def startup_event():
    """Инициализация сервисов анализа встреч"""
    logger.info("Инициализация Intelligent Meeting Analyzer...")

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    logger.info(f"Папка для загрузок: {os.path.abspath(upload_dir)}")

    await meeting_transcriber.initialize_model()
    logger.info("Система анализа встреч готова к работе")

@app.get("/")
async def root():
    """Корневой эндпоинт для проверки работы API"""
    return {
        "message": "Intelligent Meeting Analyzer API работает!",
        "version": settings.VERSION,
        "status": "operational",
        "endpoints": {
            "health_check": "/api/health",
            "analyze_meeting": "/api/analyze-meeting",
            "transcribe_simple": "/api/transcribe-simple",
            "documentation": "/docs"
        }
    }

@app.get("/api/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "model_loaded": meeting_transcriber.model_loaded,
        "timestamp": datetime.now()
    }

@app.get("/api/info")
async def api_info():
    """Информация о API"""
    return {
        "name": settings.APP_NAME,
        "description": settings.DESCRIPTION,
        "version": settings.VERSION,
        "models": {
            "transcription": f"Whisper {settings.WHISPER_MODEL_SIZE}"
        }
    }

def create_dummy_key_points(text: str) -> list:
    """Создает тестовые ключевые пункты для 1-й лабораторной"""
    return [KeyPoint(
        text=f"Транскрибировано: {len(text)} символов",
        importance_score=0.9,
        speakers=["speaker_0"],
        timestamp=0.0
    )]

@app.post("/api/analyze-meeting", response_model=schemas.AnalysisResponse)
async def analyze_meeting(file: UploadFile = File(...)):
    """
    Интеллектуальный анализ встречи: транскрипция, разделение спикеров,
    извлечение задач и решений, генерация конспекта
    """
    logger.info(f"Запрос на анализ встречи: {file.filename}")

    FileService.validate_voice_file(file)
    analysis_id = f"meeting_{uuid.uuid4().hex[:8]}"
    temp_file_path = None

    try:
        # Сохранение файла
        temp_file_path = await FileService.save_temporary_file(file, analysis_id)

        # Транскрипция встречи
        start_time = datetime.now()
        transcription_result = await meeting_transcriber.transcribe_meeting(temp_file_path)

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
            key_points=create_dummy_key_points(transcription_result["text"]),
            tasks=[],
            decisions=[],
            summary=analysis_data["summary"],
            water_content_ratio=analysis_data["water_content"],
            processing_time=(datetime.now() - start_time).total_seconds(),
            created_at=datetime.now()
        )

        return schemas.AnalysisResponse(
            analysis_id=analysis_id,
            status="completed",
            result=result,
            processing_time=result.processing_time
        )

    except Exception as e:
        logger.error(f"Ошибка анализа встречи {analysis_id}: {e}")
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
async def transcribe_simple(file: UploadFile = File(...)):
    """
    Упрощенная транскрипция (для обратной совместимости и тестирования)
    """
    FileService.validate_voice_file(file)
    transcription_id = FileService.generate_transcription_id()
    temp_file_path = None

    try:
        temp_file_path = await FileService.save_temporary_file(file, transcription_id)
        result = await meeting_transcriber.transcribe_meeting(temp_file_path)

        return schemas.SimpleTranscriptionResponse(
            transcription_id=transcription_id,
            original_filename=file.filename,
            raw_text=result["text"],
            detected_language=result["language"],
            processing_time=result["processing_time"],
            created_at=datetime.now()
        )
    finally:
        if temp_file_path:
            FileService.cleanup_temp_file(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)