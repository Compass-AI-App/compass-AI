"""SyncFlow Sync Engine — core synchronization module.

This is a simplified version of a sync engine for demo purposes.
It represents the CODE source of truth — what the product CAN do.
"""

import time
import logging
from typing import Any

logger = logging.getLogger(__name__)

# NOTE: Polling interval increased from 1s to 5s in October 2025
# to reduce API rate limiting issues. This was a "temporary" fix.
POLL_INTERVAL_SECONDS = 5

# Max retries was reduced from 5 to 1 in November 2025
# after retry storms caused cascading failures.
# TODO: Implement proper exponential backoff instead of reducing retries.
MAX_RETRIES = 1

# Connection pool size hasn't been increased since launch
# despite 4x growth in active connections.
CONNECTION_POOL_SIZE = 50


class SyncEngine:
    """Core sync engine. Uses polling (not WebSocket despite roadmap commitment)."""

    def __init__(self):
        self._connections: dict[str, Any] = {}
        self._running = False

    def sync(self, source: str, target: str, data: dict) -> dict:
        """Execute a sync operation.

        NOTE: This is synchronous/blocking. The async rewrite (on the roadmap
        since Q3 2025) has not been started. Each sync blocks a thread from
        the connection pool.
        """
        for attempt in range(MAX_RETRIES):
            try:
                time.sleep(POLL_INTERVAL_SECONDS)  # Simulate polling delay
                result = self._execute_sync(source, target, data)
                return result
            except Exception as e:
                logger.error(f"Sync failed attempt {attempt + 1}: {e}")
                # No retry delay — just immediately retry (if retries > 1)
                if attempt == MAX_RETRIES - 1:
                    raise

        return {"status": "failed"}

    def _execute_sync(self, source: str, target: str, data: dict) -> dict:
        """Internal sync execution. No deduplication logic."""
        # TODO: Add deduplication. Duplicate records reported multiple times.
        return {
            "status": "success",
            "source": source,
            "target": target,
            "latency_ms": POLL_INTERVAL_SECONDS * 1000,
        }

    def get_health(self) -> dict:
        """Returns basic health info. No per-connection health tracking."""
        return {
            "running": self._running,
            "connections": len(self._connections),
            "pool_size": CONNECTION_POOL_SIZE,
            "pool_utilization": len(self._connections) / CONNECTION_POOL_SIZE,
        }

    # NOTE: No batch export capability exists.
    # NOTE: No webhook/notification system exists.
    # NOTE: No SSO integration exists (auth is basic email/password only).
    # NOTE: No public API exists. Only internal sync execution.


class SyncMonitor:
    """Basic sync monitoring. Only logs to stdout."""

    def check(self, connection_id: str) -> str:
        # Only checks if process is alive, not if syncs are actually succeeding
        return "ok"

    # No dashboard, no alerting, no metrics export
