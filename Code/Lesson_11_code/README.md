# Lesson 11 — observability (Python)

The Lesson 10 API, observed. Every request now writes one structured JSON
log line, updates a Prometheus counter and histogram, and opens an
OpenTelemetry trace span with a child span for the database round trips
that matter. `observability.py` holds the wiring; `main.py` only calls it.
The TypeScript twin is
[`Code/js/Lesson_11_code/`](../js/Lesson_11_code/). Both stacks write the
same version strings to `schema_migrations`, so one database serves both.

## Run it

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python migrate.py
uvicorn main:app --port 8000
```

You also need Redis:

```shell
docker run -d --name redis-bookmarks -p 6379:6379 redis:7-alpine
```

## What was added

| File | Purpose |
| --- | --- |
| `observability.py` | Request id (`contextvars`), `log_event()`, the Prometheus counter/histogram/cache-result metrics, and the OpenTelemetry tracer, all wired once. |
| `diagnose.py` | Reproduces Lesson 10's stale read, and prints only the client-visible half of the payoff: read the server's log lines, `/metrics`, and trace spans for the diagnosis. |

## Endpoints added in this lesson

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/metrics` | Prometheus text exposition: `http_requests_total`, `http_request_duration_seconds`, `bookmark_search_cache_total`. |

Every request, on every route, now also carries an `X-Request-Id` response
header and writes one JSON log line to stdout. `GET /bookmarks/search`
opens a `pg_query` child span on a cache miss and none on a cache hit.
Every other endpoint is unchanged from
[`Code/Lesson_10_code/`](../Lesson_10_code/).

## The diagnosis program

Run the server in one terminal and `python diagnose.py` in another, and
read the *server's* terminal while it runs — that is the whole point.

| Step | Log line | Metric | Trace |
| --- | --- | --- | --- |
| 1. fresh query | `"result": "miss"` | `bookmark_search_cache_total{result="miss"}` +1 | `pg_query` span present |
| 2. same query again | `"result": "hit"` | `bookmark_search_cache_total{result="hit"}` +1 | no `pg_query` span |
| 3. row inserted with `psycopg`, bypassing the API | — | — | — |
| 4. same query, inside the 30 s TTL | `"result": "hit"` | `hit` +1 | no `pg_query` span |
| 5. same query, after the TTL | `"result": "miss"` | `miss` +1 | `pg_query` span present, `db.rows_returned: 1` |

Step 4 answers stale from the cache. Three independent signals say so
before you read a line of `main.py`: the log line says `hit`, the counter
that tracks database queries did not move, and the trace has no database
span.

## Measured on this machine

PostgreSQL 17.10, Redis 7.4.11, run against the 200 000-row `bookmarks`
table plus one demo row.

| Request | `duration_ms` (from the log line) |
| --- | --- |
| `/bookmarks/search` — cache miss (database + trace child span) | 7.35, 7.98 |
| `/bookmarks/search` — cache hit (Redis only, no child span) | 1.38, 2.12 |

## Testing

This project includes integration tests that run against a real PostgreSQL
database. The tests do not touch Redis, so only the database needs to be up.

1. Start the test database:
   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```
2. Run the test suite:
   ```bash
   pytest
   ```
