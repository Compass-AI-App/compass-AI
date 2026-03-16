"""Base class for live API connectors.

LiveConnector extends Connector with HTTP helpers, token injection,
rate limiting, and retry logic. Each live connector keeps its file-import
mode as fallback — live API mode activates when credentials are available.
"""

from __future__ import annotations

import time
from abc import abstractmethod

import httpx

from compass.config import SourceConfig
from compass.connectors.base import Connector
from compass.models.sources import Evidence


class RateLimiter:
    """Simple token-bucket rate limiter."""

    def __init__(self, requests_per_minute: int = 30):
        self.rpm = requests_per_minute
        self.interval = 60.0 / requests_per_minute
        self._last_request = 0.0

    def wait(self) -> None:
        """Block until a request is allowed."""
        now = time.monotonic()
        elapsed = now - self._last_request
        if elapsed < self.interval:
            time.sleep(self.interval - elapsed)
        self._last_request = time.monotonic()


class LiveConnector(Connector):
    """Base class for connectors that can fetch data via live APIs.

    Subclasses implement `ingest_live()` for API-based ingestion and
    `ingest_file()` for the existing file-based fallback. The `ingest()`
    method delegates to the appropriate one based on credential availability.
    """

    # Subclasses set this to their provider ID (e.g. "github", "jira")
    provider_id: str = ""

    # Rate limit (requests per minute) — override per provider
    rate_limit_rpm: int = 30

    # Max retries for transient failures
    max_retries: int = 3

    def __init__(self, config: SourceConfig):
        super().__init__(config)
        self._rate_limiter = RateLimiter(self.rate_limit_rpm)
        self._token: str | None = None

    def _get_token(self) -> str | None:
        """Get the injected access token for this provider."""
        if self._token:
            return self._token

        # Import here to avoid circular imports
        from compass.server import get_credential

        cred = get_credential(self.provider_id)
        if cred:
            self._token = cred.get("access_token")
        return self._token

    def has_credentials(self) -> bool:
        """Check if live API credentials are available."""
        return self._get_token() is not None

    def _auth_headers(self) -> dict[str, str]:
        """Build authorization headers for API requests."""
        token = self._get_token()
        if not token:
            return {}
        return {"Authorization": f"Bearer {token}"}

    def _api_get(
        self,
        url: str,
        params: dict | None = None,
        headers: dict | None = None,
    ) -> httpx.Response:
        """Make an authenticated GET request with rate limiting and retries."""
        return self._api_request("GET", url, params=params, headers=headers)

    def _api_post(
        self,
        url: str,
        json: dict | None = None,
        headers: dict | None = None,
    ) -> httpx.Response:
        """Make an authenticated POST request with rate limiting and retries."""
        return self._api_request("POST", url, json=json, headers=headers)

    def _api_request(
        self,
        method: str,
        url: str,
        params: dict | None = None,
        json: dict | None = None,
        headers: dict | None = None,
    ) -> httpx.Response:
        """Make an authenticated HTTP request with rate limiting and retries."""
        merged_headers = {**self._auth_headers(), **(headers or {})}

        last_exc: Exception | None = None
        for attempt in range(self.max_retries):
            self._rate_limiter.wait()
            try:
                with httpx.Client(timeout=30.0) as client:
                    response = client.request(
                        method,
                        url,
                        params=params,
                        json=json,
                        headers=merged_headers,
                    )
                    # Retry on 429 (rate limited) and 5xx (server errors)
                    if response.status_code == 429 or response.status_code >= 500:
                        wait_time = min(2 ** attempt, 30)
                        # Check for Retry-After header
                        retry_after = response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                wait_time = int(retry_after)
                            except ValueError:
                                pass
                        time.sleep(wait_time)
                        continue
                    response.raise_for_status()
                    return response
            except httpx.HTTPStatusError:
                raise
            except httpx.HTTPError as exc:
                last_exc = exc
                if attempt < self.max_retries - 1:
                    time.sleep(min(2 ** attempt, 30))

        raise last_exc or RuntimeError("Request failed after retries")

    def ingest(self) -> list[Evidence]:
        """Route to live API or file-based ingestion."""
        if self.has_credentials():
            return self.ingest_live()
        return self.ingest_file()

    @abstractmethod
    def ingest_live(self) -> list[Evidence]:
        """Fetch evidence via live API. Subclasses must implement."""
        ...

    @abstractmethod
    def ingest_file(self) -> list[Evidence]:
        """Fetch evidence from local files (fallback). Subclasses must implement."""
        ...
