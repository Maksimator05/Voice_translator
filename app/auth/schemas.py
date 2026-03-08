from pydantic import BaseModel, EmailStr
from pydantic import ConfigDict
from datetime import datetime
from typing import Optional
from app.auth.models import UserRole


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    role: UserRole
    created_at: datetime
    is_superuser: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Ответ при успешной аутентификации: оба токена + данные пользователя."""
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    username: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    """Тело запроса для обновления access token."""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Тело запроса для выхода из системы."""
    refresh_token: str


# Схема для изменения роли пользователя (только для admin)
class UserRoleUpdate(BaseModel):
    role: UserRole