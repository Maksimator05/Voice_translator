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
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    username: Optional[str] = None


# Схема для изменения роли пользователя (только для admin)
class UserRoleUpdate(BaseModel):
    role: UserRole