from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from .meeting_schemas import MeetingAnalysisResult

class HealthResponse(BaseModel):
    service: str = "Intelligent Meeting Analyzer"
    status: str
    model_loaded: bool
    timestamp: datetime

class AnalysisRequest(BaseModel):
    """Запрос на анализ встречи"""
    detect_speakers: bool = True
    extract_tasks: bool = True
    generate_summary: bool = True
    language: Optional[str] = "auto"

class AnalysisResponse(BaseModel):
    """Ответ анализа встречи"""
    analysis_id: str
    status: str
    result: Optional[MeetingAnalysisResult] = None
    error_message: Optional[str] = None
    processing_time: float

class SimpleTranscriptionResponse(BaseModel):
    """Упрощенный ответ для 1-й лабораторной"""
    transcription_id: str
    original_filename: str
    raw_text: str
    detected_language: str
    processing_time: float
    created_at: datetime