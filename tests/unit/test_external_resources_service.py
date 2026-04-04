from datetime import timezone

import pytest
import requests

from app.config import settings
from app.services.external_resources_service import (
    ExternalAPIError,
    ExternalRateLimitError,
    ExternalResourcesService,
)

pytestmark = pytest.mark.unit


class DummyResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"status={self.status_code}")

    def json(self) -> dict:
        return self._payload


def test_search_books_uses_cache_after_first_request(monkeypatch: pytest.MonkeyPatch):
    service = ExternalResourcesService()
    calls: list[dict] = []

    def fake_get(url: str, params: dict, timeout: tuple[float, float]) -> DummyResponse:
        calls.append({"url": url, "params": params, "timeout": timeout})
        return DummyResponse(
            {
                "items": [
                    {
                        "id": "book-1",
                        "volumeInfo": {
                            "title": "Deep Work",
                            "authors": ["Cal Newport"],
                            "infoLink": "https://books.example/deep-work",
                        },
                    }
                ],
                "totalItems": 1,
            }
        )

    monkeypatch.setattr("app.services.external_resources_service.requests.get", fake_get)

    first = service.search_books("deep work", requester_id="user-1", limit=5)
    second = service.search_books("deep work", requester_id="user-1", limit=5)

    assert len(calls) == 1
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["items"][0]["title"] == "Deep Work"


def test_search_books_retries_after_timeout(monkeypatch: pytest.MonkeyPatch):
    service = ExternalResourcesService()
    attempts = {"count": 0}

    def fake_get(url: str, params: dict, timeout: tuple[float, float]) -> DummyResponse:
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise requests.Timeout("slow provider")
        return DummyResponse(
            {
                "items": [
                    {
                        "id": "book-2",
                        "volumeInfo": {
                            "title": "Measure What Matters",
                            "authors": ["John Doerr"],
                            "infoLink": "https://books.example/okrs",
                        },
                    }
                ],
                "totalItems": 1,
            }
        )

    monkeypatch.setattr("app.services.external_resources_service.requests.get", fake_get)
    monkeypatch.setattr("app.services.external_resources_service.time.sleep", lambda *_args: None)
    monkeypatch.setattr(settings, "EXTERNAL_RESOURCES_MAX_RETRIES", 2)

    result = service.search_books("okrs", requester_id="user-2", limit=3)

    assert attempts["count"] == 2
    assert result["items"][0]["title"] == "Measure What Matters"


def test_search_books_enforces_rate_limit(monkeypatch: pytest.MonkeyPatch):
    service = ExternalResourcesService()
    monkeypatch.setattr(settings, "EXTERNAL_RESOURCES_MIN_INTERVAL_SECONDS", 10.0)
    monkeypatch.setattr(
        service,
        "_fetch_with_retries",
        lambda query, limit: {"items": [], "totalItems": 0},
    )

    service.search_books("meetings", requester_id="same-user", limit=2)

    with pytest.raises(ExternalRateLimitError):
        service.search_books("meeting notes", requester_id="same-user", limit=2)


def test_normalize_response_skips_items_without_links_and_truncates_text():
    service = ExternalResourcesService()
    long_description = " ".join(["description"] * 80)
    result = service._normalize_response(
        payload={
            "items": [
                {
                    "id": "skip-me",
                    "volumeInfo": {"title": "Missing link"},
                },
                {
                    "id": "book-3",
                    "volumeInfo": {
                        "title": "The Mom Test",
                        "authors": ["Rob Fitzpatrick"],
                        "description": long_description,
                        "previewLink": "https://books.example/mom-test",
                        "categories": ["Interviews", "Research", "Product"],
                        "publishedDate": "2013",
                    },
                },
            ],
            "totalItems": 2,
        },
        query="product interviews",
        limit=5,
        cached=False,
    )

    assert result["query"] == "product interviews"
    assert len(result["items"]) == 1
    assert result["items"][0]["title"] == "The Mom Test"
    assert result["items"][0]["description"].endswith("...")
    assert result["fetched_at"].tzinfo == timezone.utc


def test_search_books_raises_provider_error_after_retries(monkeypatch: pytest.MonkeyPatch):
    service = ExternalResourcesService()
    monkeypatch.setattr(settings, "EXTERNAL_RESOURCES_MAX_RETRIES", 1)
    monkeypatch.setattr(
        "app.services.external_resources_service.requests.get",
        lambda *_args, **_kwargs: DummyResponse({}, status_code=503),
    )
    monkeypatch.setattr("app.services.external_resources_service.time.sleep", lambda *_args: None)

    with pytest.raises(ExternalAPIError):
        service.search_books("meeting notes", requester_id="user-3", limit=2)
