import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


def test_create_list_and_paginate_chats(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
):
    chat_factory(auth_headers, title="Alpha", session_type="text")
    chat_factory(auth_headers, title="Beta", session_type="meeting")
    chat_factory(auth_headers, title="Gamma", session_type="meeting")

    response = client.get(
        "/api/chats",
        params={
            "search": "a",
            "session_type": "meeting",
            "sort_by": "title",
            "sort_order": "asc",
            "paginate": True,
            "page": 1,
            "page_size": 1,
        },
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["page"] == 1
    assert data["page_size"] == 1
    assert data["pages"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Beta"


def test_get_chat_returns_404_for_foreign_chat(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
    chat_factory,
):
    chat = chat_factory(auth_headers, title="Private chat")

    response = client.get(f"/api/chats/{chat['id']}", headers=second_user_headers)

    assert response.status_code == 404


def test_send_message_persists_message_and_updates_chat(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
):
    chat = chat_factory(auth_headers, title="Messaging chat")

    response = client.post(
        f"/api/chats/{chat['id']}/messages",
        json={"content": "Hello from test", "role": "user", "message_type": "text"},
        headers=auth_headers,
    )

    assert response.status_code == 200, response.text
    message = response.json()
    assert message["content"] == "Hello from test"
    assert message["chat_session_id"] == chat["id"]

    chat_response = client.get(f"/api/chats/{chat['id']}", headers=auth_headers)
    assert chat_response.status_code == 200
    chat_data = chat_response.json()
    assert len(chat_data["messages"]) == 1
    assert chat_data["messages"][0]["content"] == "Hello from test"


def test_send_message_returns_validation_error_for_empty_content(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
):
    chat = chat_factory(auth_headers, title="Validation chat")

    response = client.post(
        f"/api/chats/{chat['id']}/messages",
        json={"content": "", "role": "user", "message_type": "text"},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_invalid_pagination_parameters_are_rejected(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/api/chats", params={"page": 0}, headers=auth_headers)

    assert response.status_code == 422
