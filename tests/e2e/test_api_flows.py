import io

import pytest
from fastapi.testclient import TestClient

import app.main as main_module

pytestmark = pytest.mark.e2e


def test_registered_user_end_to_end_flow(
    client: TestClient,
    auth_headers: dict[str, str],
    registered_user: dict,
    storage_mock,
):
    create_response = client.post(
        "/api/chats",
        json={"title": "Weekly sync", "session_type": "meeting"},
        headers=auth_headers,
    )
    assert create_response.status_code == 200
    chat = create_response.json()

    message_response = client.post(
        f"/api/chats/{chat['id']}/messages",
        json={"content": "Capture action items", "role": "user", "message_type": "text"},
        headers=auth_headers,
    )
    assert message_response.status_code == 200

    ask_response = client.post(
        f"/api/chats/{chat['id']}/ask",
        data={"message": "Summarize the discussion"},
        headers=auth_headers,
    )
    assert ask_response.status_code == 200
    ask_payload = ask_response.json()
    assert ask_payload["ai_response"]["content"] == "Test AI response"

    list_response = client.get(
        "/api/chats",
        params={
            "search": "Weekly",
            "session_type": "meeting",
            "sort_by": "title",
            "sort_order": "asc",
            "paginate": True,
            "page": 1,
            "page_size": 5,
        },
        headers=auth_headers,
    )
    assert list_response.status_code == 200
    list_payload = list_response.json()
    assert list_payload["total"] == 1
    assert list_payload["items"][0]["message_count"] >= 2

    upload_response = client.post(
        f"/api/chats/{chat['id']}/files",
        headers=auth_headers,
        files={"file": ("summary.txt", io.BytesIO(b"follow-up"), "text/plain")},
    )
    assert upload_response.status_code == 200
    file_id = upload_response.json()["id"]

    download_response = client.get(f"/api/files/{file_id}/url", headers=auth_headers)
    assert download_response.status_code == 200
    assert download_response.json()["url"] == storage_mock["url"]

    delete_file_response = client.delete(f"/api/files/{file_id}", headers=auth_headers)
    assert delete_file_response.status_code == 204

    delete_chat_response = client.delete(f"/api/chats/{chat['id']}", headers=auth_headers)
    assert delete_chat_response.status_code == 200
    assert delete_chat_response.json()["deleted_chat_id"] == chat["id"]

    logout_response = client.post(
        "/api/auth/logout",
        json={"refresh_token": registered_user["refresh_token"]},
        headers=auth_headers,
    )
    assert logout_response.status_code == 200

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": registered_user["refresh_token"]},
    )
    assert refresh_response.status_code == 401


def test_guest_and_external_api_flows(
    client: TestClient,
    guest_user: dict,
    guest_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    guest_chats_response = client.get("/api/chats", headers=guest_headers)
    assert guest_chats_response.status_code == 200
    guest_chats = guest_chats_response.json()
    assert len(guest_chats) >= 1

    create_chat_response = client.post(
        "/api/chats",
        json={"title": "Guest cannot create", "session_type": "text"},
        headers=guest_headers,
    )
    assert create_chat_response.status_code == 403

    monkeypatch.setattr(
        main_module.external_resources_service,
        "search_books",
        lambda query, requester_id, limit: {
            "query": query or "meeting productivity",
            "items": [],
            "total": 0,
            "source": "google_books",
            "cached": True,
            "fetched_at": "2026-04-04T10:00:00Z",
        },
    )

    resources_response = client.get("/api/resources/books", params={"query": "meeting productivity"})
    assert resources_response.status_code == 200
    assert resources_response.json()["cached"] is True
    assert guest_user["user"]["role"] == "guest"
