import os
from collections.abc import Callable, Generator
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SITE_URL", "http://testserver")

import app.main as main_module
from app.auth.models import User, UserRole
from app.database.connection import Base, get_db
from app.services.external_resources_service import external_resources_service


TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_shared_state() -> Generator[None, None, None]:
    external_resources_service._cache.clear()
    external_resources_service._request_log.clear()
    main_module.long_polling_connections.clear()
    yield
    external_resources_service._cache.clear()
    external_resources_service._request_log.clear()
    main_module.long_polling_connections.clear()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    from app.auth.models import RefreshToken  # noqa: F401
    from app.models.chat_models import ChatMessage, ChatSession  # noqa: F401
    from app.models.file_models import FileAttachment  # noqa: F401
    from app.models.meeting_models import AnalysisResult  # noqa: F401

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session: Session, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    app = main_module.app

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(main_module, "get_db", override_get_db)
    monkeypatch.setattr(main_module, "create_tables", lambda: None)
    monkeypatch.setattr(main_module.llm_processor, "initialize_model", AsyncMock(return_value=None))
    monkeypatch.setattr(
        main_module.audio_processor,
        "process_audio_file",
        AsyncMock(return_value="Test transcription"),
    )
    monkeypatch.setattr(
        main_module.llm_processor,
        "generate_chat_response",
        AsyncMock(return_value="Test AI response"),
    )

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def user_factory(client: TestClient, db_session: Session) -> Callable[..., dict[str, Any]]:
    counter = 0

    def factory(
        *,
        role: str = "user",
        email: str | None = None,
        username: str | None = None,
        password: str = "TestPass123!",
        is_active: bool = True,
    ) -> dict[str, Any]:
        nonlocal counter
        counter += 1
        payload = {
            "email": email or f"user{counter}@example.com",
            "username": username or f"user{counter}",
            "password": password,
        }
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 200, response.text

        data = response.json()
        user = db_session.query(User).filter(User.id == data["user"]["id"]).one()
        user.role = UserRole(role)
        user.is_active = is_active
        db_session.commit()
        db_session.refresh(user)
        data["user"]["role"] = user.role.value
        data["user"]["is_active"] = user.is_active
        return data

    return factory


@pytest.fixture()
def registered_user(user_factory: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    return user_factory(email="test@example.com", username="testuser")


@pytest.fixture()
def auth_headers(registered_user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {registered_user['access_token']}"}


@pytest.fixture()
def admin_user(user_factory: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    return user_factory(role="admin", email="admin@example.com", username="admin")


@pytest.fixture()
def admin_headers(admin_user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_user['access_token']}"}


@pytest.fixture()
def second_user(user_factory: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    return user_factory(email="second@example.com", username="seconduser")


@pytest.fixture()
def second_user_headers(second_user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {second_user['access_token']}"}


@pytest.fixture()
def guest_user(client: TestClient) -> dict[str, Any]:
    response = client.post("/api/auth/guest-login")
    assert response.status_code == 200
    return response.json()


@pytest.fixture()
def guest_headers(guest_user: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {guest_user['access_token']}"}


@pytest.fixture()
def chat_factory(client: TestClient) -> Callable[..., dict[str, Any]]:
    def factory(
        headers: dict[str, str],
        *,
        title: str = "Test Chat",
        session_type: str = "text",
    ) -> dict[str, Any]:
        response = client.post(
            "/api/chats",
            json={"title": title, "session_type": session_type},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        return response.json()

    return factory


@pytest.fixture()
def storage_mock(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    state: dict[str, Any] = {
        "uploaded": [],
        "deleted": [],
        "presigned": [],
        "url": "https://storage.example.test/download/file-1",
    }

    def upload_file(file_bytes: bytes, s3_key: str, content_type: str) -> bool:
        state["uploaded"].append(
            {
                "size": len(file_bytes),
                "s3_key": s3_key,
                "content_type": content_type,
            }
        )
        return True

    def get_presigned_url(s3_key: str, expires: int = 3600) -> str:
        state["presigned"].append({"s3_key": s3_key, "expires": expires})
        return state["url"]

    def delete_file(s3_key: str) -> bool:
        state["deleted"].append(s3_key)
        return True

    monkeypatch.setattr(main_module.storage_service, "upload_file", upload_file)
    monkeypatch.setattr(main_module.storage_service, "get_presigned_url", get_presigned_url)
    monkeypatch.setattr(main_module.storage_service, "delete_file", delete_file)
    return state
