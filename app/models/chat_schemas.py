from datetime import datetime
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar

from fastapi import UploadFile
from pydantic import BaseModel, Field

T = TypeVar("T")


class SessionType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    MEETING = "meeting"


class MessageType(str, Enum):
    TEXT = "text"
    AUDIO_TRANSCRIPT = "audio"


class ChatMessageBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    role: str
    message_type: MessageType = MessageType.TEXT
    audio_filename: Optional[str] = None
    audio_transcription: Optional[str] = None
    audio_data: Optional[str] = None


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageResponse(ChatMessageBase):
    id: int
    chat_session_id: int
    tokens_used: int = 0
    created_at: datetime
    audio_filename: Optional[str] = None
    audio_transcription: Optional[str] = None
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
    message: str = Field(..., min_length=1, max_length=50000)
    audio_data: Optional[UploadFile] = None


class DeleteChatResponse(BaseModel):
    success: bool
    message: str
    deleted_chat_id: int
    deleted_messages_count: int

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int
