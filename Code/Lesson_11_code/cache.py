"""Lesson 11 — a second seam, the same shape as `db.py`.

`main.py` reached `app.state.redis` directly in one route. That made the
route untestable without a running Redis server, and it hid the cache logic
(the key, the TTL, the hit/miss counter) inside the handler.

`SearchCache` names the two operations the route needs: `lookup` and
`store`. `RedisCache` is the production adapter. `DictCache` is the test
adapter — no server, no network, same interface. A cache test wires
`DictCache` and asserts hit, miss, and TTL expiry directly, the same way
`conftest.py`'s `_SavepointSource` lets a database test run `db.py`'s real
code with no throwaway Postgres server of its own.
"""

import json
import time
from typing import Protocol

from redis.asyncio import Redis

from observability import CACHE_RESULT, log_event

DEFAULT_TTL_SECONDS = 30


class SearchCache(Protocol):
    """The interface `search_bookmarks` calls. Both adapters implement it."""

    async def lookup(self, q: str, skip: int, limit: int) -> list[dict] | None:
        """Return the cached rows, or `None` on a miss or an expired entry."""
        ...

    async def store(self, q: str, skip: int, limit: int, rows: list[dict]) -> None:
        """Save `rows` under this query's key, for the cache's TTL."""
        ...


def _key(q: str, skip: int, limit: int) -> str:
    return f"search:{q}:{skip}:{limit}"


class RedisCache:
    """Production adapter. Stores each result set as JSON text in Redis."""

    def __init__(self, redis: Redis, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self._redis = redis
        self._ttl_seconds = ttl_seconds

    async def lookup(self, q: str, skip: int, limit: int) -> list[dict] | None:
        key = _key(q, skip, limit)
        cached = await self._redis.get(key)
        if cached is None:
            CACHE_RESULT.labels("miss").inc()
            log_event(event="search_cache", result="miss", key=key)
            return None
        CACHE_RESULT.labels("hit").inc()
        log_event(event="search_cache", result="hit", key=key)
        return json.loads(cached)

    async def store(self, q: str, skip: int, limit: int, rows: list[dict]) -> None:
        key = _key(q, skip, limit)
        await self._redis.set(key, json.dumps(rows, default=str), ex=self._ttl_seconds)


class DictCache:
    """Test adapter. A dict stands in for Redis; a stored expiry time stands
    in for Redis's own `EXPIRE`. `lookup` reads the wall clock and treats a
    stale entry as a miss, so a TTL test needs no running server and no
    `sleep()` longer than the TTL it is testing."""

    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self._ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[float, str]] = {}

    async def lookup(self, q: str, skip: int, limit: int) -> list[dict] | None:
        key = _key(q, skip, limit)
        entry = self._entries.get(key)
        if entry is not None:
            expires_at, payload = entry
            if time.monotonic() < expires_at:
                CACHE_RESULT.labels("hit").inc()
                log_event(event="search_cache", result="hit", key=key)
                return json.loads(payload)
            del self._entries[key]
        CACHE_RESULT.labels("miss").inc()
        log_event(event="search_cache", result="miss", key=key)
        return None

    async def store(self, q: str, skip: int, limit: int, rows: list[dict]) -> None:
        key = _key(q, skip, limit)
        expires_at = time.monotonic() + self._ttl_seconds
        self._entries[key] = (expires_at, json.dumps(rows, default=str))
