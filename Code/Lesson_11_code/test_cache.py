"""Lesson 11 — the cache seam, tested without a Redis server.

`search_bookmarks` calls `app.state.cache.lookup` and `.store`. It does not
know, and does not need to know, that production answers those calls with a
`RedisCache` and the test suite answers them with a `DictCache`. The unit
tests below exercise `DictCache` directly. The integration tests below that
exercise it through the real route, the way a client actually sees it.
"""

import pytest
from httpx import AsyncClient

from cache import DictCache


@pytest.mark.anyio
async def test_lookup_misses_before_anything_is_stored():
    cache = DictCache(ttl_seconds=30)
    assert await cache.lookup("term", 0, 10) is None


@pytest.mark.anyio
async def test_store_then_lookup_returns_the_same_rows():
    cache = DictCache(ttl_seconds=30)
    rows = [{"id": 1, "title": "Example"}]

    await cache.store("term", 0, 10, rows)

    assert await cache.lookup("term", 0, 10) == rows


@pytest.mark.anyio
async def test_lookup_is_scoped_to_the_exact_query_skip_and_limit():
    """A different page, or a different search term, is a different key."""
    cache = DictCache(ttl_seconds=30)
    await cache.store("term", 0, 10, [{"id": 1}])

    assert await cache.lookup("term", 0, 20) is None
    assert await cache.lookup("other", 0, 10) is None


@pytest.mark.anyio
async def test_entry_expires_after_its_ttl(monkeypatch):
    """WARNING: control the clock in a TTL test. A real `sleep()` past the
    TTL makes the suite slow; a fake clock makes the test instant and exact.
    """
    clock = {"now": 1_000.0}
    monkeypatch.setattr("cache.time.monotonic", lambda: clock["now"])

    cache = DictCache(ttl_seconds=30)
    await cache.store("term", 0, 10, [{"id": 1}])

    clock["now"] += 29
    assert await cache.lookup("term", 0, 10) == [{"id": 1}]

    clock["now"] += 2  # 31 seconds after the store
    assert await cache.lookup("term", 0, 10) is None


@pytest.mark.anyio
async def test_search_route_is_a_miss_then_a_hit(client: AsyncClient):
    await client.post(
        "/auth/register", json={"email": "search@example.com", "password": "password"}
    )
    await client.post(
        "/auth/login", json={"email": "search@example.com", "password": "password"}
    )
    await client.post("/bookmarks", json={"url": "https://example.com/x", "title": "Cache Target"})

    res = await client.get("/bookmarks/search", params={"q": "Cache"})
    assert res.status_code == 200
    assert res.json()["source"] == "database"

    res = await client.get("/bookmarks/search", params={"q": "Cache"})
    assert res.status_code == 200
    assert res.json()["source"] == "cache"


@pytest.mark.anyio
async def test_search_route_opens_no_database_span_on_a_hit(client: AsyncClient, spans):
    """A cache hit must not touch the database. Read the trace to prove it,
    not the response body alone."""
    await client.post(
        "/auth/register", json={"email": "search2@example.com", "password": "password"}
    )
    await client.post(
        "/auth/login", json={"email": "search2@example.com", "password": "password"}
    )
    await client.post("/bookmarks", json={"url": "https://example.com/y", "title": "Span Target"})
    await client.get("/bookmarks/search", params={"q": "Span"})  # warm the cache
    spans.clear()

    res = await client.get("/bookmarks/search", params={"q": "Span"})

    assert res.json()["source"] == "cache"
    names = [span.name for span in spans.get_finished_spans()]
    assert names.count("pg_query") == 0
