from fastapi import UploadFile
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

class SessionType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    MEETING = "meeting"

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO_TRANSCRIPT = "audio"

class ChatMessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)  # 50k символов
    role: str
    message_type: MessageType = MessageType.TEXT  # Используйте Enum
    audio_filename: Optional[str] = None
    audio_transcription: Optional[str] = None

class ChatMessageCreate(ChatMessageBase):
    audio_filename: Optional[str] = None
    audio_transcription: Optional[str] = None

class ChatMessageResponse(ChatMessageBase):
    id: int
    chat_session_id: int
    tokens_used: int = 0
    created_at: datetime
    audio_filename: Optional[str] = None  # 🆕
    audio_transcription: Optional[str] = None  # 🆕
    audio_analysis: Optional[Dict[str, Any]] = None

class ChatSessionBase(BaseModel):
    title: str = "Новый чат"
    session_type: SessionType = SessionType.TEXT

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionResponse(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    messages: List[ChatMessageResponse] = []

class ChatSessionListResponse(BaseModel):
    id: int
    title: str
    session_type: SessionType
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None
    message_count: int = 0

class ChatAskRequest(BaseModel):
    """Схема для запроса к AI в чате"""
    message: str = Field(..., min_length=1, max_length=50000)  # 50k символов
    audio_data: Optional[UploadFile] = None