from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.connection import Base


class FileAttachment(Base):
    __tablename__ = "file_attachments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    s3_key = Column(String(500), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
