from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from enum import Enum

class SessionType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    MEETING = "meeting"

class MessageType(str, Enum):
    TEXT = "text"
    AUDIO_TRANSCRIPT = "audio_transcript"

class ChatMessageBase(BaseModel):
    content: str
    role: str
    message_type: MessageType = MessageType.TEXT

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessageResponse(ChatMessageBase):
    id: int
    chat_session_id: int
    tokens_used: int = 0
    created_at: datetime

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