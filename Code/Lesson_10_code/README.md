# Lesson 10 — caching (Python)

The Lesson 9 API with two caches added. The TypeScript twin is
[`Code/js/Lesson_10_code/`](../js/Lesson_10_code/). Both stacks write the
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

## The bench program

| File | What it proves |
| --- | --- |
| `cache_bench.py` | A Redis hit answers in 1.251 ms against 3.131 ms for a database miss. A row inserted straight into PostgreSQL does not appear in a cached search until the 30 s TTL passes. |

## Endpoints added in this lesson

| Method | Path | Cache | Purpose |
| --- | --- | --- | --- |
| `GET` | `/bookmarks/{id}` | `ETag` + `Cache-Control: max-age=30` | 304 when `If-None-Match` matches. |
| `GET` | `/bookmarks/search?q=` | Redis, 30 s TTL | Prefix search on title, from Lesson 5's index. |

Every other endpoint is unchanged from
[`Code/Lesson_9_code/`](../Lesson_9_code/).

## Measured on this machine

PostgreSQL 17.10, Redis 7.4.11, 200 000 rows in `bookmarks`.

| Read | Time |
| --- | --- |
| `/bookmarks/search` — database (cache miss) | 3.131 ms average of 5 |
| `/bookmarks/search` — Redis (cache hit) | 1.251 ms average of 5 |

A row inserted with `psql`, bypassing the API, does not appear in
`/bookmarks/search` while the cached answer is still inside its 30 s TTL. It
appears on the first request after the TTL expires.

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
