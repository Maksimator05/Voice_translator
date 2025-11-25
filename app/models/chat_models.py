from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.sql import func
from app.database.connection import Base


class ChatSession(Base):
    """Сессия чата пользователя"""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255), default="Новый чат")
    session_type = Column(String(50), default="text")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)


class ChatMessage(Base):
    """Сообщение в чате"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String(50))
    content = Column(Text)
    message_type = Column(String(50), default="text")
    audio_filename = Column(String(255), nullable=True)  # 🆕 Путь к аудио файлу
    audio_transcription = Column(Text, nullable=True)  # 🆕 Транскрипция аудио
    audio_analysis = Column(JSON, nullable=True)  # 🆕 Анализ аудио
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())