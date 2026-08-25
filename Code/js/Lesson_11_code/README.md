# Lesson 11 — observability (TypeScript)

The TypeScript twin of [`Code/Lesson_11_code/`](../../Lesson_11_code/). Same
routes, same status codes, same database, same Redis instance, and the same
three primitives: a structured log line, two Prometheus metrics, and an
OpenTelemetry trace with a database child span.

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

## What was added

| File | Purpose |
| --- | --- |
| `src/observability.ts` | The request id (`AsyncLocalStorage`), `logEvent()`, the `prom-client` counter/histogram/cache-result metrics, and the OpenTelemetry tracer, all wired once. |
| `src/diagnose.ts` | The TypeScript twin of `diagnose.py`: reproduces Lesson 10's stale read and prints only the client-visible half of the payoff. |

## Endpoints added in this lesson

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/metrics` | Prometheus text exposition: `http_requests_total`, `http_request_duration_seconds`, `bookmark_search_cache_total`. |

Every request, on every route, now also carries an `X-Request-Id` response
header and writes one JSON log line to stdout. `GET /bookmarks/search` opens
a `pg_query` child span on a cache miss and none on a cache hit. Every other
endpoint is unchanged from
[`Code/js/Lesson_10_code/`](../Lesson_10_code/).

## The diagnosis program

Run the server in one terminal and `npm run diagnose` in another, and read
the *server's* terminal while it runs — that is the whole point.

| Step | Log line | Metric | Trace |
| --- | --- | --- | --- |
| 1. fresh query | `"result":"miss"` | `bookmark_search_cache_total{result="miss"}` +1 | `pg_query` span present |
| 2. same query again | `"result":"hit"` | `bookmark_search_cache_total{result="hit"}` +1 | no `pg_query` span |
| 3. row inserted with `pg`, bypassing the API | — | — | — |
| 4. same query, inside the 30 s TTL | `"result":"hit"` | `hit` +1 | no `pg_query` span |
| 5. same query, after the TTL | `"result":"miss"` | `miss` +1 | `pg_query` span present, `db.rows_returned: 1` |

Step 4 answers stale from the cache. Three independent signals say so
before you read a line of `server.ts`: the log line says `hit`, the counter
that tracks database queries did not move, and the trace has no database
span.

## Measured on this machine

PostgreSQL 17.10, Redis 7.4.11, run against the 200 000-row `bookmarks`
table plus one demo row.

| Request | `duration_ms` (from the log line) |
| --- | --- |
| `/bookmarks/search` — cache miss (database + trace child span) | 22.54, 23.13 |
| `/bookmarks/search` — cache hit (Redis only, no child span) | 1.70, 1.88 |

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
