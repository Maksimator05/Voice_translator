from sqlalchemy import Column, Integer, String, DateTime, Float, Text, JSON, ForeignKey
from app.database.connection import Base
from datetime import datetime

class AnalysisResult(Base):
    """Модель для хранения результатов анализа встреч"""
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    analysis_id = Column(String, unique=True, index=True)
    original_filename = Column(String)
    file_size_bytes = Column(Integer)
    duration_seconds = Column(Float)
    transcript_text = Column(Text)
    summary = Column(Text)
    water_content_ratio = Column(Float)
    key_points = Column(JSON)
    tasks = Column(JSON)
    decisions = Column(JSON)
    processing_time = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<AnalysisResult(id={self.id}, filename={self.original_filename})>"