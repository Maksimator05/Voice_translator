from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from datetime import datetime
from app.database.connection import Base
import enum


class UserRole(str, enum.Enum):
    """Роли пользователей в системе"""
    GUEST = "guest"   # Гость — только 3 бесплатные расшифровки, без создания чатов
    USER = "user"     # Авторизованный — неограниченное количество расшифровок
    ADMIN = "admin"   # Администратор — полный доступ + управление пользователями


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)