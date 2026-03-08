"""
Тесты аутентификации и авторизации (Лаб 2).
Покрывают: регистрацию, вход, refresh, logout, RBAC.
"""
import pytest
from fastapi.testclient import TestClient


class TestRegistration:
    """Тесты регистрации пользователя."""

    def test_register_success(self, client: TestClient):
        response = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "SecurePass1!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "new@example.com"
        assert data["user"]["role"] == "user"

    def test_register_duplicate_email(self, client: TestClient, registered_user):
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "username": "other",
            "password": "Pass123!",
        })
        assert response.status_code == 400

    def test_register_duplicate_username(self, client: TestClient, registered_user):
        response = client.post("/api/auth/register", json={
            "email": "other@example.com",
            "username": "testuser",
            "password": "Pass123!",
        })
        assert response.status_code == 400


class TestLogin:
    """Тесты входа в систему."""

    def test_login_success(self, client: TestClient, registered_user):
        response = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "TestPass123!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password(self, client: TestClient, registered_user):
        response = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "WrongPassword",
        })
        assert response.status_code == 401

    def test_login_wrong_email(self, client: TestClient):
        response = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "AnyPass1!",
        })
        assert response.status_code == 401


class TestRefreshToken:
    """Тесты обновления access token через refresh token."""

    def test_refresh_success(self, client: TestClient, registered_user):
        refresh_token = registered_user["refresh_token"]
        response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # После ротации выдаётся новый refresh token
        assert data["refresh_token"] != refresh_token

    def test_refresh_old_token_invalid_after_rotation(self, client: TestClient, registered_user):
        """После ротации старый refresh token должен быть отозван."""
        old_refresh = registered_user["refresh_token"]
        # Первый refresh
        client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        # Попытка использовать старый токен
        response = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert response.status_code == 401

    def test_refresh_invalid_token(self, client: TestClient):
        response = client.post("/api/auth/refresh", json={"refresh_token": "invalid-token"})
        assert response.status_code == 401

    def test_refresh_empty_token(self, client: TestClient):
        response = client.post("/api/auth/refresh", json={"refresh_token": ""})
        assert response.status_code == 401


class TestLogout:
    """Тесты выхода из системы."""

    def test_logout_success(self, client: TestClient, registered_user, auth_headers):
        refresh_token = registered_user["refresh_token"]
        response = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_refresh_after_logout_fails(self, client: TestClient, registered_user, auth_headers):
        """После logout refresh token должен быть недействителен."""
        refresh_token = registered_user["refresh_token"]
        client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers=auth_headers,
        )
        response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 401


class TestCurrentUser:
    """Тесты получения текущего пользователя."""

    def test_get_me_success(self, client: TestClient, auth_headers):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_get_me_no_token(self, client: TestClient):
        response = client.get("/api/auth/me")
        assert response.status_code == 403

    def test_get_me_invalid_token(self, client: TestClient):
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
        assert response.status_code == 401


class TestRBAC:
    """Тесты ролевой авторизации."""

    def test_admin_endpoint_forbidden_for_user(self, client: TestClient, auth_headers):
        """Обычный пользователь не может получить список всех пользователей."""
        response = client.get("/api/admin/users", headers=auth_headers)
        assert response.status_code == 403

    def test_create_chat_allowed_for_user(self, client: TestClient, auth_headers):
        """Обычный пользователь может создавать чаты."""
        response = client.post(
            "/api/chats",
            json={"title": "Test Chat", "session_type": "text"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_health_check_public(self, client: TestClient):
        """Health check доступен без аутентификации."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestGuestLogin:
    """Тесты гостевого входа."""

    def test_guest_login_success(self, client: TestClient):
        response = client.post("/api/auth/guest-login")
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "guest"
        assert "access_token" in data
        assert "refresh_token" in data

    def test_guest_cannot_create_chat(self, client: TestClient):
        """Гость не может создавать чаты (только user+)."""
        resp = client.post("/api/auth/guest-login")
        token = resp.json()["access_token"]
        response = client.post(
            "/api/chats",
            json={"title": "Guest Chat", "session_type": "text"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
