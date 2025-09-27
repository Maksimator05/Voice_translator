from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

class SpeakerRole(str, Enum):
    UNKNOWN = "unknown"
    MODERATOR = "moderator"
    PARTICIPANT = "participant"
    PRESENTER = "presenter"

class ContentType(str, Enum):
    INTRODUCTION = "introduction"
    DISCUSSION = "discussion"
    DECISION = "decision"
    TASK = "task"
    SUMMARY = "summary"
    OFF_TOPIC = "off_topic"

class SpeakerSegment(BaseModel):
    """Сегмент речи одного спикера"""
    speaker_id: str
    start_time: float
    end_time: float
    text: str
    confidence: float

class IdentifiedSpeaker(BaseModel):
    """Идентифицированный спикер"""
    speaker_id: str
    total_speaking_time: float
    segment_count: int
    detected_name: Optional[str] = None
    role: SpeakerRole = SpeakerRole.UNKNOWN

class TaskItem(BaseModel):
    """Задача из встречи"""
    description: str
    assigned_to: str  # speaker_id или имя
    deadline: Optional[str] = None
    context: str  # текст вокруг задачи
    confidence: float

class DecisionItem(BaseModel):
    """Принятое решение"""
    description: str
    participants: List[str]
    context: str

class KeyPoint(BaseModel):
    """Ключевой тезис"""
    text: str
    importance_score: float
    speakers: List[str]
    timestamp: float

class MeetingAnalysisResult(BaseModel):
    """Полный результат анализа встречи"""
    meeting_id: str
    original_filename: str
    duration_seconds: float
    total_speakers: int
    speakers: List[IdentifiedSpeaker]
    segments: List[SpeakerSegment]
    key_points: List[KeyPoint]
    tasks: List[TaskItem]
    decisions: List[DecisionItem]
    summary: str
    water_content_ratio: float  # процент "воды"
    processing_time: float
    created_at: datetime