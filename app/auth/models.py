from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from datetime import datetime
from app.database.connection import Base
import enum


class UserRole(str, enum.Enum):
    """Роли пользователей в системе"""
    GUEST = "guest"       # Только чтение, без создания чатов
    USER = "user"         # Обычный пользователь — создаёт/удаляет свои чаты
    MODERATOR = "moderator"  # Может просматривать все чаты, удалять любые
    ADMIN = "admin"       # Полный доступ + управление ролями


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # Новое поле: роль пользователя (по умолчанию — user)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)