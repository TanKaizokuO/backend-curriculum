"""Lesson 11's payoff: diagnose Lesson 10's stale read with no source open.

    uvicorn main:app --port 8000    # in one terminal
    python diagnose.py              # in another

Watch the *server's* terminal while this script runs, and run
`curl -s localhost:8000/metrics` after step 4. The claims this lesson makes
are about what those two views show, not about what this script prints —
this script only produces the requests. Every number quoted in the lesson
came from a real run of this file; run it yourself before you trust it.
"""

import time

import httpx
import psycopg

from config import settings

BASE_URL = "http://127.0.0.1:8000"
QUERY = "Observability demo"
TTL_SECONDS = 30


def metric_value(text: str, name: str, **labels) -> float | None:
    """Pull one sample out of Prometheus's text exposition format."""
    label_str = ",".join(f'{k}="{v}"' for k, v in labels.items())
    prefix = f"{name}{{{label_str}}}" if labels else name
    for line in text.splitlines():
        if line.startswith(prefix + " "):
            return float(line.rsplit(" ", 1)[1])
    return None


def search(client: httpx.Client, step: str) -> None:
    response = client.get("/bookmarks/search", params={"q": QUERY})
    body = response.json()
    print(
        f"{step}: GET /bookmarks/search?q={QUERY!r} -> {response.status_code}, "
        f"source={body['source']}, rows={len(body['results'])}, "
        f"request-id={response.headers['x-request-id']}"
    )


def main() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
        print("--- 1. a query nobody has run yet: cache miss ------------------")
        search(client, "step 1")

        print("\n--- 2. the same query again: cache hit -------------------------")
        search(client, "step 2")

        print("\n--- 3. a row inserted straight into Postgres, bypassing the API -")
        with psycopg.connect(settings.dsn, autocommit=True) as conn:
            conn.execute(
                "INSERT INTO bookmarks (url, title) VALUES (%s, %s) "
                "ON CONFLICT (url) DO NOTHING",
                (
                    "https://example.com/observability-demo-new",
                    f"{QUERY} — written straight into Postgres",
                ),
            )
        print("row inserted with a direct psycopg connection, no HTTP request made")

        print("\n--- 4. the same query, inside the TTL: is it fresh? ------------")
        search(client, "step 4")

        metrics_text = client.get("/metrics").text
        miss = metric_value(metrics_text, "bookmark_search_cache_total", result="miss")
        hit = metric_value(metrics_text, "bookmark_search_cache_total", result="hit")
        print(f"\n/metrics: bookmark_search_cache_total{{result=\"miss\"}} = {miss}")
        print(f"/metrics: bookmark_search_cache_total{{result=\"hit\"}}  = {hit}")

        print(f"\nWaiting {TTL_SECONDS + 1}s for the cache entry to expire...")
        time.sleep(TTL_SECONDS + 1)

        print("\n--- 5. the same query, after the TTL: is it fresh now? ---------")
        search(client, "step 5")


if __name__ == "__main__":
    main()
