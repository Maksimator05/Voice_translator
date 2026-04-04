import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


def test_admin_can_list_users_and_update_role(
    client: TestClient,
    admin_headers: dict[str, str],
    registered_user: dict,
):
    list_response = client.get("/api/admin/users", headers=admin_headers)

    assert list_response.status_code == 200
    users = list_response.json()
    assert any(user["email"] == "test@example.com" for user in users)

    target_user_id = registered_user["user"]["id"]
    role_response = client.patch(
        f"/api/admin/users/{target_user_id}/role",
        json={"role": "admin"},
        headers=admin_headers,
    )

    assert role_response.status_code == 200
    assert role_response.json()["role"] == "admin"


def test_user_cannot_access_admin_endpoints(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/api/admin/users", headers=auth_headers)

    assert response.status_code == 403


def test_admin_cannot_change_own_role(client: TestClient, admin_headers: dict[str, str], admin_user: dict):
    response = client.patch(
        f"/api/admin/users/{admin_user['user']['id']}/role",
        json={"role": "user"},
        headers=admin_headers,
    )

    assert response.status_code == 400


def test_admin_can_deactivate_user_and_block_future_login(
    client: TestClient,
    admin_headers: dict[str, str],
    registered_user: dict,
):
    user_id = registered_user["user"]["id"]

    deactivate_response = client.patch(
        f"/api/admin/users/{user_id}/activate",
        params={"is_active": False},
        headers=admin_headers,
    )
    assert deactivate_response.status_code == 200
    assert deactivate_response.json()["is_active"] is False

    login_response = client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "TestPass123!"},
    )

    assert login_response.status_code == 403
