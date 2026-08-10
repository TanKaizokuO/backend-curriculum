# Bookmarks API (Node.js & Express)

Production-ready containerised REST API for managing web bookmarks and tags, built with Node.js, Express, and PostgreSQL 17.

*Live URL:* not deployed yet. Placeholder: `https://bookmarks-api-js.onrender.com/healthz`

---

## Performance & Concurrency Profile

### 1. Database Indexing & Query Execution (Lesson 5)
- **Sequential Scan vs B-tree Index Scan:** On a 200,000-row table, `WHERE title = ...` query execution time dropped from **9.846 ms** (2568 buffer page reads) to **0.085 ms** (4 buffer page reads).
- **Prefix Pattern Search:** Default B-tree indexes do not optimize wildcard prefix queries under locale collations; applying `text_pattern_ops` restored index scan performance for `LIKE 'prefix%'` queries.
- **N+1 Query Elimination:** Replacing an N+1 query loop (101 SQL round-trips) with a single `LEFT JOIN` and `array_agg` query reduced response latency by **67×** under a 1 ms network latency simulation.

### 2. Transaction Isolation & Concurrency Control (Lesson 6)
- **Lost Update Defect:** 20 concurrent workers executing 10 increments each (200 total increments) produced **187 lost updates** under naive application-level read-modify-write operations (`final count = 13`).
- **Atomic UPDATE:** Single SQL statement updates (`UPDATE bookmarks SET visit_count = visit_count + 1 WHERE id = $1`) completely eliminated lost updates (`final count = 200`, **0 lost updates**, execution duration **121 ms**).
- **Pessimistic Locking:** `SELECT FOR UPDATE` guaranteed strict sequential consistency without data loss (`final count = 200`, execution duration **225 ms**).

---

## Infrastructure & Twelve-Factor Architecture

- **Factor III (Config):** Environment-driven configuration via `process.env.DATABASE_URL` and `process.env.PORT`. Strict validation on startup (`config.js`).
- **Factor V (Build, Release, Run):** Strict separation of container image building, transactional migration release execution (`migrate.js`), and runtime execution (`server.js`).
- **Factor VI (Processes):** Stateless Node.js application process. Session state and persistent bookmarks reside entirely in PostgreSQL.
- **Factor X (Dev/Prod Parity):** Parity maintained across local Docker Compose rehearsal (`compose.yaml`) and cloud deployment (`render.yaml`).

---

## Production Container Specifications

- **Base Image:** `node:22-alpine`
- **Security:** Non-root execution (`USER node`), pinned dependencies (`npm ci --only=production`), layer caching optimization.
- **Process Orchestration:** Exec form `CMD ["node", "server.js"]` ensures Node.js runs as PID 1 to receive `SIGTERM` signals for graceful shutdown.
- **Health Verification:** `/healthz` endpoint executes `SELECT 1` against PostgreSQL connection pool, returning `200 OK` when healthy and `503 Service Unavailable` on database connection failure.

---

## Local Execution Rehearsal

```bash
# Copy local environment variables
cp .env.example .env

# Start PostgreSQL, run release migrations, and launch API
docker compose up --build -d

# Verify health status
curl -s http://localhost:8007/healthz
# Output: {"status":"ok","env":"production"}

# Stop services preserving persistent data volume
docker compose down
```
