import os
from typing import List
from datetime import timedelta

class Settings:
    """Конфигурация Intelligent Meeting Analyzer"""
    APP_NAME: str = "Intelligent Meeting Analyzer"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "AI система для структурированного анализа встреч и лекций"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Модели
    WHISPER_MODEL_SIZE: str = "base"

    # Настройки анализа
    MIN_SPEECH_DURATION: float = 1.0
    SUMMARY_SENTENCES: int = 5
    KEY_POINTS_COUNT: int = 10

    # Ключевые слова для детекции решений и задач
    TASK_KEYWORDS: List[str] = [
        "подготовить", "сделать", "исправить", "написать", "отправить",
        "создать", "разработать", "проверить", "проанализировать", "составить"
    ]
    DECISION_KEYWORDS: List[str] = [
        "решили", "договорились", "постановили", "утвердили", "приняли"
    ]

    # Настройки файлов
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 500

    ALLOWED_AUDIO_TYPES: List[str] = [
        'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'
    ]
    ALLOWED_VIDEO_TYPES: List[str] = [
        'video/mp4', 'video/mpeg', 'video/quicktime'
    ]

    # НАСТРОЙКИ АУТЕНТИФИКАЦИИ
    SECRET_KEY: str = "your-secret-key-for-jwt-tokens-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 дней

    # Настройки базы данных
    DATABASE_URL: str = "sqlite:///./meeting_analyzer.db"

    @property
    def allowed_content_types(self) -> List[str]:
        return self.ALLOWED_AUDIO_TYPES + self.ALLOWED_VIDEO_TYPES


settings = Settings()