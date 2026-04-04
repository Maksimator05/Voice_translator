import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.services.external_resources_service import ExternalAPIError, ExternalRateLimitError

pytestmark = pytest.mark.integration


def test_external_resources_endpoint_returns_normalized_payload(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        main_module.external_resources_service,
        "search_books",
        lambda query, requester_id, limit: {
            "query": query or "meeting productivity",
            "items": [
                {
                    "id": "book-1",
                    "title": "Deep Work",
                    "authors": ["Cal Newport"],
                    "description": "Focus guide",
                    "resource_url": "https://books.example/deep-work",
                    "thumbnail_url": None,
                    "published_date": "2016",
                    "categories": ["Productivity"],
                    "source": "google_books",
                }
            ],
            "total": 1,
            "source": "google_books",
            "cached": False,
            "fetched_at": "2026-04-04T10:00:00Z",
        },
    )

    response = client.get("/api/resources/books", params={"query": "deep work", "limit": 4})

    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "deep work"
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Deep Work"


def test_external_resources_endpoint_maps_rate_limit_error(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    def raise_rate_limit(*_args, **_kwargs):
        raise ExternalRateLimitError("Slow down")

    monkeypatch.setattr(main_module.external_resources_service, "search_books", raise_rate_limit)

    response = client.get("/api/resources/books", params={"query": "meetings"})

    assert response.status_code == 429
    assert response.json()["error"] == "Slow down"


def test_external_resources_endpoint_maps_provider_error(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    def raise_provider_error(*_args, **_kwargs):
        raise ExternalAPIError("Provider offline")

    monkeypatch.setattr(main_module.external_resources_service, "search_books", raise_provider_error)

    response = client.get("/api/resources/books", params={"query": "meetings"})

    assert response.status_code == 503
    assert response.json()["error"] == "Provider offline"
