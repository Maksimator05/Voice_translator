import logging
import time
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

import requests

from app.config import settings


logger = logging.getLogger(__name__)


class ExternalAPIError(RuntimeError):
    """Base exception for external provider failures."""


class ExternalRateLimitError(ExternalAPIError):
    """Raised when the app should reject overly frequent requests."""


class ExternalResourcesService:
    """Server-side adapter for external public knowledge resources."""

    def __init__(self) -> None:
        self._cache: Dict[str, Tuple[float, dict]] = {}
        self._request_log: Dict[str, float] = {}

    def search_books(
        self,
        query: Optional[str],
        requester_id: Optional[str] = None,
        limit: int = 6,
    ) -> dict:
        normalized_query = self._normalize_query(query) or settings.EXTERNAL_RESOURCES_DEFAULT_QUERY
        safe_limit = max(1, min(limit, 10))
        cache_key = f"{normalized_query}:{safe_limit}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            cached["cached"] = True
            return cached

        self._enforce_rate_limit(requester_id or "anonymous")
        response_data = self._fetch_with_retries(normalized_query, safe_limit)
        normalized = self._normalize_response(
            payload=response_data,
            query=normalized_query,
            limit=safe_limit,
            cached=False,
        )
        self._cache[cache_key] = (time.time(), normalized)
        return normalized

    def _get_cached(self, cache_key: str) -> Optional[dict]:
        entry = self._cache.get(cache_key)
        if not entry:
            return None

        created_at, payload = entry
        if time.time() - created_at > settings.EXTERNAL_RESOURCES_CACHE_TTL_SECONDS:
            self._cache.pop(cache_key, None)
            return None

        return dict(payload)

    def _enforce_rate_limit(self, requester_id: str) -> None:
        now = time.time()
        last_request_at = self._request_log.get(requester_id)
        if (
            last_request_at is not None
            and now - last_request_at < settings.EXTERNAL_RESOURCES_MIN_INTERVAL_SECONDS
        ):
            raise ExternalRateLimitError(
                "Too many external resource requests. Please wait a moment and try again."
            )

        self._request_log[requester_id] = now

    def _fetch_with_retries(self, query: str, limit: int) -> dict:
        params = {
            "q": query,
            "maxResults": limit,
            "orderBy": "relevance",
            "printType": "books",
        }
        if settings.GOOGLE_BOOKS_API_KEY:
            params["key"] = settings.GOOGLE_BOOKS_API_KEY

        attempts = settings.EXTERNAL_RESOURCES_MAX_RETRIES + 1
        delay_seconds = 0.5

        for attempt in range(1, attempts + 1):
            try:
                response = requests.get(
                    settings.GOOGLE_BOOKS_API_URL,
                    params=params,
                    timeout=(
                        settings.EXTERNAL_RESOURCES_CONNECT_TIMEOUT_SECONDS,
                        settings.EXTERNAL_RESOURCES_READ_TIMEOUT_SECONDS,
                    ),
                )

                if response.status_code == 429:
                    raise ExternalAPIError("External provider rate limit exceeded.")

                if response.status_code >= 500:
                    raise ExternalAPIError(
                        f"External provider temporary failure ({response.status_code})."
                    )

                response.raise_for_status()
                return response.json()
            except requests.Timeout as exc:
                logger.warning(
                    "External books API timeout on attempt %s/%s for query '%s'",
                    attempt,
                    attempts,
                    query,
                )
                if attempt >= attempts:
                    raise ExternalAPIError("External provider timed out.") from exc
            except requests.RequestException as exc:
                logger.warning(
                    "External books API request failed on attempt %s/%s for query '%s': %s",
                    attempt,
                    attempts,
                    query,
                    exc,
                )
                if attempt >= attempts:
                    raise ExternalAPIError("External provider request failed.") from exc
            except ExternalAPIError:
                if attempt >= attempts:
                    raise

            time.sleep(delay_seconds)
            delay_seconds *= 2

        raise ExternalAPIError("External provider request failed.")

    def _normalize_response(
        self,
        payload: dict,
        query: str,
        limit: int,
        cached: bool,
    ) -> dict:
        items = []
        for item in payload.get("items", [])[:limit]:
            volume_info = item.get("volumeInfo", {})
            info_link = volume_info.get("infoLink") or volume_info.get("previewLink")
            if not info_link:
                continue

            image_links = volume_info.get("imageLinks", {})
            thumbnail = image_links.get("thumbnail") or image_links.get("smallThumbnail")

            items.append(
                {
                    "id": item.get("id", f"book-{len(items) + 1}"),
                    "title": volume_info.get("title", "Untitled resource"),
                    "authors": volume_info.get("authors", []) or [],
                    "description": self._truncate_text(volume_info.get("description")),
                    "resource_url": info_link,
                    "thumbnail_url": thumbnail,
                    "published_date": volume_info.get("publishedDate"),
                    "categories": volume_info.get("categories", [])[:3],
                    "source": "google_books",
                }
            )

        return {
            "query": query,
            "items": items,
            "total": payload.get("totalItems", len(items)),
            "source": "google_books",
            "cached": cached,
            "fetched_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def _normalize_query(query: Optional[str]) -> str:
        return " ".join((query or "").split()).strip()

    @staticmethod
    def _truncate_text(text: Optional[str], max_length: int = 220) -> Optional[str]:
        if not text:
            return None

        cleaned = " ".join(text.split())
        if len(cleaned) <= max_length:
            return cleaned

        return f"{cleaned[: max_length - 3].rstrip()}..."


external_resources_service = ExternalResourcesService()
