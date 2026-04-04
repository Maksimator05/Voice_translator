import io

import pytest
from fastapi.testclient import TestClient

import app.main as main_module

pytestmark = pytest.mark.integration


def test_file_upload_list_download_and_delete(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
    storage_mock,
):
    chat = chat_factory(auth_headers, title="Files chat")

    upload_response = client.post(
        f"/api/chats/{chat['id']}/files",
        headers=auth_headers,
        files={"file": ("notes.txt", io.BytesIO(b"meeting notes"), "text/plain")},
    )

    assert upload_response.status_code == 200, upload_response.text
    attachment = upload_response.json()
    assert attachment["original_filename"] == "notes.txt"
    assert len(storage_mock["uploaded"]) == 1

    list_response = client.get(f"/api/chats/{chat['id']}/files", headers=auth_headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    file_id = attachment["id"]
    download_response = client.get(f"/api/files/{file_id}/url", headers=auth_headers)
    assert download_response.status_code == 200
    assert download_response.json()["url"] == storage_mock["url"]

    delete_response = client.delete(f"/api/files/{file_id}", headers=auth_headers)
    assert delete_response.status_code == 204
    assert len(storage_mock["deleted"]) == 1

    final_list = client.get(f"/api/chats/{chat['id']}/files", headers=auth_headers)
    assert final_list.status_code == 200
    assert final_list.json() == []


def test_file_access_is_forbidden_for_another_user(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
    chat_factory,
    storage_mock,
):
    chat = chat_factory(auth_headers, title="Private files")
    upload_response = client.post(
        f"/api/chats/{chat['id']}/files",
        headers=auth_headers,
        files={"file": ("spec.txt", io.BytesIO(b"private"), "text/plain")},
    )
    file_id = upload_response.json()["id"]

    download_response = client.get(f"/api/files/{file_id}/url", headers=second_user_headers)
    delete_response = client.delete(f"/api/files/{file_id}", headers=second_user_headers)

    assert download_response.status_code == 403
    assert delete_response.status_code == 403


def test_upload_rejects_invalid_file_type(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
):
    chat = chat_factory(auth_headers, title="Invalid files")

    response = client.post(
        f"/api/chats/{chat['id']}/files",
        headers=auth_headers,
        files={"file": ("script.exe", io.BytesIO(b"binary"), "application/x-msdownload")},
    )

    assert response.status_code == 400


def test_upload_returns_503_when_storage_is_unavailable(
    client: TestClient,
    auth_headers: dict[str, str],
    chat_factory,
    monkeypatch: pytest.MonkeyPatch,
):
    chat = chat_factory(auth_headers, title="Storage down")

    def fail_upload(*_args, **_kwargs):
        raise RuntimeError("File upload failed: storage offline")

    monkeypatch.setattr(main_module.storage_service, "upload_file", fail_upload)

    response = client.post(
        f"/api/chats/{chat['id']}/files",
        headers=auth_headers,
        files={"file": ("notes.txt", io.BytesIO(b"meeting"), "text/plain")},
    )

    assert response.status_code == 503
