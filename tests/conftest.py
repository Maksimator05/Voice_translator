"""
Конфигурация тестов: изолированная in-memory SQLite БД,
тестовый FastAPI клиент, вспомогательные фикстуры.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.connection import Base, get_db

# In-memory SQLite для тестов (не трогает продакшн БД)
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function", autouse=False)
def client():
    """Тестовый HTTP-клиент с изолированной БД."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def registered_user(client):
    """Регистрирует тестового пользователя и возвращает данные ответа."""
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "TestPass123!",
    })
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def auth_headers(registered_user):
    """Заголовки авторизации для тестового пользователя."""
    token = registered_user["access_token"]
    return {"Authorization": f"Bearer {token}"}
