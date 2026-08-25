# Lesson 10 — caching (TypeScript)

The TypeScript twin of [`Code/Lesson_10_code/`](../../Lesson_10_code/). Same
routes, same status codes, same database, same Redis instance.

## Run it

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
npm install
npm run migrate
npm start                     # http://localhost:8009
npm run typecheck             # tsc --noEmit; the runtime never checks types
```

You also need Redis:

```shell
docker run -d --name redis-bookmarks -p 6379:6379 redis:7-alpine
```

## The bench program

| Command | What it proves |
| --- | --- |
| `npm run cache-bench` | A Redis hit answers in 3.301 ms against 15.296 ms for a database miss. A row inserted straight into PostgreSQL does not appear in a cached search until the 30 s TTL passes. |

## Endpoints added in this lesson

| Method | Path | Cache | Purpose |
| --- | --- | --- | --- |
| `GET` | `/bookmarks/:id` | `ETag` + `Cache-Control: max-age=30` | 304 when `If-None-Match` matches. |
| `GET` | `/bookmarks/search?q=` | Redis, 30 s TTL | Prefix search on title, from Lesson 5's index. |

Every other endpoint is unchanged from
[`Code/js/Lesson_9_code/`](../Lesson_9_code/).

## Measured on this machine

PostgreSQL 17.10, Redis 7.4.11, 200 000 rows in `bookmarks`.

| Read | Time |
| --- | --- |
| `/bookmarks/search` — database (cache miss) | 15.296 ms average of 5, including one 51.2 ms first call that opened a new PostgreSQL connection |
| `/bookmarks/search` — Redis (cache hit) | 3.301 ms average of 5 |

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
   npm run test
   ```
