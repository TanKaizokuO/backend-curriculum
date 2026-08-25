"""What a Redis cache buys you, and what it costs you.

    uvicorn main:app --port 8000    # in one terminal
    python cache_bench.py           # in another

The program does three things:

    1. It clears the cache key, then times a miss and five hits, and reports
       both.
    2. It writes a row directly into PostgreSQL, bypassing the API, and shows
       that a cached search does not see it.
    3. It waits for the cache entry to expire, and shows the same search see
       the new row.

Every number that this program prints comes from your machine. Run it before
you read the lesson section that quotes it.
"""

import time

import httpx
import psycopg
import redis

from config import settings

BASE_URL = "http://127.0.0.1:8000"
QUERY = "Article number 1370"
STALE_QUERY = "Cache demo"


def timed_get(client: httpx.Client, url: str) -> tuple[float, dict]:
    start = time.perf_counter()
    response = client.get(url)
    elapsed_ms = (time.perf_counter() - start) * 1000
    return elapsed_ms, response.json()


def bench_miss_vs_hit(client: httpx.Client, cache: redis.Redis) -> None:
    print("--- 1. miss against hit -----------------------------------")
    key = f"search:{QUERY}:0:10"
    misses = []
    for _ in range(5):
        cache.delete(key)
        elapsed_ms, _ = timed_get(client, f"/bookmarks/search?q={QUERY}")
        misses.append(elapsed_ms)

    hits = []
    for _ in range(5):
        elapsed_ms, _ = timed_get(client, f"/bookmarks/search?q={QUERY}")
        hits.append(elapsed_ms)

    avg_miss = sum(misses) / len(misses)
    avg_hit = sum(hits) / len(hits)
    print(f"miss (database each time): {misses}")
    print(f"hit  (Redis each time):    {hits}")
    print(f"average miss: {avg_miss:.3f} ms, average hit: {avg_hit:.3f} ms, "
          f"{avg_miss / avg_hit:.1f}x faster")


def bench_stale_read(client: httpx.Client) -> None:
    print("\n--- 2. the stale read ---------------------------------------")
    with psycopg.connect(settings.dsn, autocommit=True) as conn:
        conn.execute("DELETE FROM bookmarks WHERE url = %s",
                     ("https://example.com/cache-demo",))

    _, before = timed_get(client, f"/bookmarks/search?q={STALE_QUERY}")
    print(f"before insert: {before}")

    with psycopg.connect(settings.dsn, autocommit=True) as conn:
        conn.execute(
            "INSERT INTO bookmarks (url, title) VALUES (%s, %s)",
            ("https://example.com/cache-demo", "Cache demo row"),
        )
    print("inserted a matching row directly in PostgreSQL, "
          "bypassing the API")

    _, still_cached = timed_get(client, f"/bookmarks/search?q={STALE_QUERY}")
    print(f"right after insert (within the 30s TTL): {still_cached}")

    print("waiting 31s for the cache entry to expire ...")
    time.sleep(31)

    _, fresh = timed_get(client, f"/bookmarks/search?q={STALE_QUERY}")
    print(f"after the TTL: {fresh}")

    with psycopg.connect(settings.dsn, autocommit=True) as conn:
        conn.execute("DELETE FROM bookmarks WHERE url = %s",
                     ("https://example.com/cache-demo",))


def main() -> None:
    cache = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    with httpx.Client(base_url=BASE_URL) as client:
        bench_miss_vs_hit(client, cache)
        bench_stale_read(client)


if __name__ == "__main__":
    main()
