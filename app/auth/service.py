from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.auth.models import User, UserRole
from app.auth.schemas import TokenData
from app.database.connection import get_db

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
security = HTTPBearer()

# Лимит бесплатных расшифровок для гостя (проверяется на бэкенде)
GUEST_TRANSCRIPTION_LIMIT = 3


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверные учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Неактивный пользователь")
    return current_user


# ==================== RBAC ЗАВИСИМОСТИ ====================

def require_role(*allowed_roles: UserRole):
    """
    Фабрика зависимостей: проверяет, что у текущего пользователя
    есть одна из допустимых ролей. При нарушении возвращает 403.
    """
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Доступ запрещён. Требуется роль: {', '.join(r.value for r in allowed_roles)}"
            )
        return current_user
    return dependency


# Готовые зависимости
require_admin = require_role(UserRole.ADMIN)
require_user_or_above = require_role(UserRole.USER, UserRole.ADMIN)