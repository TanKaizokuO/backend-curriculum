# Log

Append-only history: what each lesson covered, what was verified before it
shipped, and the teaching hooks worth reusing. An entry is written once, when
a lesson ships, and is not revised afterward — only a new lesson's entry is
appended below the last one. For live state — where things stand right now,
conventions, open threads, and what ships next — see `STATE.md`.

---

## Lessons taught

### Lesson 0001 covers

Raw HTTP over a TCP socket, no framework. Structure: the one idea → request shape →
response shape → *Practice 1* be the client (`client.py`, hand-typed request to
example.com:80) → *Practice 2* be the server (`server.py`, complete accept loop) →
*Practice 3* break it on purpose (Experiment A: delete the blank line, watch curl fail
with `Header without colon`; Experiment B: drop `Content-Length` and hold the socket open,
watch the client hang) → six retrieval-practice questions → MDN + Beej as primary sources.

### Lesson 0002 covers

Server without a framework. Structure: the one idea (a framework is a standard calling
convention) → parse the start line → parse headers + query string → routing table →
correct status codes (200, 400, 404, 405 with `Allow`) → complete `server.py` with all
pieces → practice (curl each status code, `nc` for malformed request) → WSGI contract
(`application(environ, start_response)`, runnable `wsgi_demo.py` with `wsgiref`) → ASGI
contract (`async application(scope, receive, send)`) → where FastAPI sits (ASGI app on
Uvicorn) → stack diagram → seven retrieval-practice questions → PEP 3333, ASGI spec,
RFC 9110, MDN as primary sources.

### Lesson 0003 covers

FastAPI introduction. Structure: the one idea (FastAPI turns type annotations into
routing, validation, serialisation, errors, and docs) → install + run → routing with
decorators (compared to Lesson 2's `ROUTES` dict) → path parameters with type conversion
and validation → query parameters from function signature → Pydantic models for request
body validation → `HTTPException` for error responses → OpenAPI `/docs` generation →
complete bookmarks API (`main.py`: list, get, create, delete) → practice (curl each
feature, verify 200/201/204/404/422, query params, the 405 `Allow` check, open `/docs`)
→ updated stack diagram → comparison table (hand-built vs FastAPI) → nine
retrieval-practice questions → FastAPI tutorial, Pydantic docs, OpenAPI spec, ASGI spec
as primary sources.

**Every code block and every practice step in this lesson was executed against
FastAPI 0.137.1 / Pydantic 2.13.4 / Uvicorn 0.49.0 before shipping.** Status codes and
response bodies quoted in the lesson are real output, not recalled.

**Teaching hook worth reusing — the incomplete `Allow` header.** Registering one path
with separate `@app.get` and `@app.delete` decorators makes Starlette answer a `PUT`
with `405` and `allow: GET` — `DELETE` is missing, because each decorator builds its own
route object and the router reports the first path match's methods. A single
`@app.api_route(..., methods=["GET","DELETE"])` gives the complete `allow: GET, DELETE`.
Verified by direct ASGI probe. This is the lesson's strongest argument for the
"raw mechanism before the abstraction" convention: the learner can only spot the gap
because they hand-wrote `allowed_methods()` in Lesson 2. It is written up as a
`note--warn`, a practice step, and a quiz question. Reach for this pattern again —
find the place the abstraction leaks and make the learner check it.

### Lesson 0004 covers

Relational modelling + SQL against PostgreSQL 17. Structure: opening nudge to read
`HTTP_Messages_Reference.pdf` → the one idea (a schema is a set of truths the data may
not violate) → Docker Postgres + `psql` survival commands → **do it wrong first**: a
`tags TEXT` column, then `LIKE '%web%'` returning WebAssembly, plus the rename/list/count
anomalies → 1NF stated usefully → the normalised three-table schema (`bookmarks`, `tags`,
`bookmark_tags`) with every clause explained (`GENERATED ALWAYS AS IDENTITY`, natural vs
surrogate key, `REFERENCES`, `ON DELETE CASCADE`, composite PK) → constraints enforced
(three real error transcripts) → joins: inner vs `LEFT JOIN`, `string_agg`, `GROUP BY`,
`count(col)` vs `count(*)`, the one-row tag rename, cascade on delete → transactions and
atomicity (`COMMIT` answered with `ROLLBACK`) plus the other three ACID letters →
migrations: numbered `.sql` files, a hand-written `migrate.py` with `schema_migrations`,
transactional DDL, "never edit an applied migration", then Alembic named → wiring psycopg
into FastAPI: pool in `lifespan`, `LIMIT/OFFSET`, `array_agg ... FILTER`, `RETURNING`,
upsert via `ON CONFLICT ... DO UPDATE`, `UniqueViolation` → `409`, `rowcount` → `404`, and
a runnable SQL-injection demo → eight practice steps ending in *kill the server, restart
it, the data is still there* → updated stack diagram → nine retrieval-practice questions
→ PostgreSQL tutorial + constraints, psycopg 3, pgexercises, Alembic as sources.

**Everything in this lesson was executed before shipping** against PostgreSQL 17.10
(Docker), psycopg 3.3.4, psycopg-pool 3.3.1, FastAPI 0.141.1. Every psql transcript,
every error message, and every curl response is real output.

**Teaching hook worth reusing — do it wrong first.** The lesson opens by building the
denormalised table and running the query that returns a *wrong answer* (`LIKE '%web%'`
matches `webassembly`). The learner sees the failure before hearing the rule, so "first
normal form" costs one sentence instead of a lecture. Same family as Lesson 3's leaky
`Allow` header: find the observable failure, then name the principle. Look for one per
lesson.

### Lesson 0005 covers

Query performance against PostgreSQL 17 on 200 000 seeded rows. Structure: the one idea
(you cannot fix slowness you have not measured, and the database hands you the
measurement) → `seed.sql` + why `ANALYZE` after a bulk load → **observable failure**:
`WHERE title = …` is a `Seq Scan`, 9.846 ms, `Rows Removed by Filter: 199999`, 2568
buffers → how to read a plan (estimate vs actual, cost is not milliseconds, `loops=`
multiplies, buffers are the stable measure, read inside out) → `CREATE INDEX` → 0.085 ms
and 4 buffers → `\d bookmarks` reveals the two indexes `PRIMARY KEY`/`UNIQUE` already
built → **the second observable failure**: with that index in place, `LIKE 'Article
number 1370%'` *still* seq-scans (11.810 ms) because a default text index is in collation
order; `text_pattern_ops` → 0.128 ms, shipped as migration 0003 → the leftmost-columns
rule, explaining the `bookmark_tags_tag_id_idx` line they copied in Lesson 4's migration
0002 (21.9 ms → 5.3 ms, and *why only 4×* — selectivity, and why that produces a Bitmap
scan) → indexes are not free (200 000 rows: 1 index 251 ms / 22 MB, 4 indexes 1533 ms /
50 MB) → **N+1**: `n_plus_1.py` shows 101 queries vs 1, only 7× on localhost, then
`slow_link.py` adds 1 ms each way and the same code goes to 51× → a note on measuring at
the layer the claim lives in → eight practice steps ending in a README section → nine
retrieval questions → Use The Index Luke!, PostgreSQL Using EXPLAIN, Operator Classes,
pgexercises as sources.

**Everything in this lesson was executed before shipping** against PostgreSQL 17.10
(Docker, 200 000 bookmarks / 585 000 tag links), psycopg 3.3.4, FastAPI 0.141.1. Every
plan, timing, and byte count is real output. Timings vary between runs; buffer and page
counts do not, and the lesson tells the learner to trust those.

**Scope call.** The Session 4 spec for this lesson also listed isolation levels and the
ORM. Both moved to Lesson 6. Indexes + N+1 is one coherent skill — measure, diagnose,
fix, prove — and concurrency is a different question.

**Teaching hooks worth reusing.** Two, both in the established observable-failure family:
(a) *the fix that does not work* — the learner creates an index, believes the problem is
solved, and the next query still seq-scans. Breaking the learner's own just-formed
assumption is stronger than breaking a naive one. (b) *change the environment, not the
code* — `slow_link.py` is a 25-line TCP proxy adding 1 ms each way, and it converts an
unimpressive 7× N+1 into an alarming 51× without editing a line. Reach for this whenever
a real problem looks harmless on a laptop.

**Method note for future lessons.** The endpoint-level `time curl` measurements that
seemed the obvious way to show all this were dominated by a ~25 ms TCP delayed-ACK
artifact on loopback and contradicted the SQL-level numbers. They were cut, and a
`bench.py` was deleted rather than shipped. Measure at the layer the claim lives in:
`EXPLAIN` for query cost, timing around the DB calls for round-trip cost, many requests
and a median for endpoint cost.

### Lesson 0006 covers

Concurrency, then the ORM, against PostgreSQL 17.10 on the same 200 000-row schema.
Structure: the one idea (a transaction protects you from a crash, not from another
transaction) → migration 0004 adds `visit_count`, with the note that a constant
`DEFAULT` does not rewrite the table on PG 11+ → **observable failure**: two `psql`
windows both read 0, both write 1, both commit, and two visits produce a count of 1 with
no error → `lost_update.py` scales it: 20 threads × 10 increments, 12 of 200 kept, 188
lost → why the database allows it: `READ COMMITTED` snapshots cover *one query*, shown by
two `SELECT`s in one transaction returning 0 then 5 → fix 1, one statement
(`SET visit_count = visit_count + 1`), 200/200 and the *fastest* of the four → fix 2,
`SELECT … FOR UPDATE`, with the blocked-session transcript and the
`pg_stat_activity` query that shows `wait_event_type = Lock`, plus a warning about
deadlocks and lock order → fix 3, `REPEATABLE READ` + retry, the real
`ERROR: could not serialize access due to concurrent update` and the `bookmarks=!#`
prompt, correct but 772 ms and **1411 retries** for 200 increments → the four-level table
and the four anomaly names → `POST /bookmarks/{id}/visit` with `RETURNING`, proven with
300 requests at 30 concurrent (result: exactly 300) → SQLAlchemy 2.x models over the
*migration-owned* schema (no `create_all()`) → `echo=True` shows the default lazy loader
producing Lesson 5's N+1 (101 queries / 2 / 1 for lazy / `selectinload` / `joinedload`),
and `joinedload`'s SQL is recognisably the Lesson 4 hand-written query → **the ORM writes
today's defect too**: `bookmark.visit_count += 1` echoes `SET visit_count=%(visit_count)s`
with a Python-computed number and loses 173 of 200 → nine practice steps → nine retrieval
questions → PostgreSQL Transaction Isolation + Explicit Locking, SQLAlchemy Loading
Techniques + Quick Start, Alembic as sources.

**Everything in this lesson was executed before shipping** against PostgreSQL 17.10
(Docker), psycopg 3.3.4, SQLAlchemy 2.0.51, FastAPI 0.141.1. Every psql transcript, every
error message, every `echo` line, and every measured table is real output. Counts are
exact and reproducible; the millisecond figures move between runs and the retry count
moves a lot (1267–1411 across three runs).

**Teaching hooks worth reusing.** (a) *The failure with no error message.* Lessons 3–5
broke things that produced an error or a slow number. This one produces a plausible wrong
number and a clean log. Telling the learner "your log says 200 and your counter says 12"
is the strongest version of the observable-failure opening so far. (b) *The same defect,
twice, in two vocabularies.* The lesson shows the lost update in raw SQL, then shows the
identical defect as `obj.attr += 1` — so the ORM section is not new material, it is
recognition. The Lesson 5 → Lesson 6 ordering paid off exactly as planned: N+1 was already
a named thing, so seeing the ORM emit it took one paragraph, not a section.

**Warning learned the hard way.** A `psql` session left `idle in transaction` while
holding a `FOR UPDATE` lock will block every writer to that row indefinitely — including
the load test in Step 8, which hung for five minutes before I found the held lock. If a
curl loop against the visit endpoint hangs, look for `idle in transaction` in
`pg_stat_activity` first. This is worth saying to the learner if they hit it.

### Lesson 0007 covers

Deployment. Structure: the one idea (a deploy is one image plus one set of
environment variables) → build/release/run as a table, from twelve-factor V →
*Step 1* deploy it badly (`naive/Dockerfile`, seven lines, four defects, each one
observed before it is named: a hard-coded `localhost` DSN, a bind to `127.0.0.1`,
`--reload` in an image, and a password in an `ENV` layer) → `config.py` with
`pydantic-settings` and the twelve-factor litmus test → the real `Dockerfile`, line by
line (unbuffered log, two `COPY` statements for the layer cache, pinned versions,
`USER appuser`, `--host 0.0.0.0`, `${PORT:-8000}`, and why the CMD is
`sh -c "exec uvicorn …"`) → the release step and its idempotence → `/healthz` that runs
`SELECT 1`, proved at 200 and 503 → the named volume, proved with `down` against
`down -v` → `compose.yaml` as the local rehearsal with `service_healthy` and
`service_completed_successfully` → managed PostgreSQL against your own container, as a
table, plus Render's free-plan limits → `render.yaml` as the declarative deploy →
the README as the CV artifact, carrying the Lesson 5 and Lesson 6 numbers → seven
practice steps → nine quiz questions → twelve-factor, Render, Uvicorn and Docker as
primary sources.

**Everything in this lesson was executed before shipping**: Docker 29.7.2,
PostgreSQL 17, uvicorn 0.52.1, FastAPI 0.141.1, psycopg 3.3.4,
pydantic-settings 2.14.2. Every transcript is real output. `render.yaml` validates
against `https://render.com/schema/render.yaml.json` with zero errors.

**Teaching hooks worth reusing.** (a) *A second, deliberately wrong artifact kept in the
repository.* `naive/` is not prose about mistakes; it builds and runs. The strongest of
its four defects is the bind failure — the container logs `Application startup complete`,
the same request succeeds from inside the container, and every request from outside
resets. It looks like a network problem and is not one. (b) *Prove the destructive
command instead of warning about it.* `docker compose down`, read the row back, then
`docker compose down -v`, read `[]`.

**Honest limit that is lesson content, not a footnote.** Render's `preDeployCommand`
needs a paid instance type, so the correct design and the free-plan workaround differ.
The lesson gives both, and tells the learner to say so in an interview. Free plan limits
that matter: a web service spins down after 15 minutes idle and takes about a minute to
return; a free database expires 30 days after creation, with no backups.

**Learner status.** The learner finished Lesson 7 and did not deploy. Render asks for a
credit card, even on the free plan. `Code/Lesson_7_code/README.md` now states that the
service is container-ready and proved with Docker Compose. Do not ask for a URL again.

### Lesson 0008 covers

Authentication, and the first lesson in two languages. Structure: the one idea (the
server must never trust the client; it must only trust what it can verify) → three words
and two status codes (identification, authentication, authorisation; 401 against 403) →
**observable failure 1**, `hash_speed.py`: a SHA-256 leak shows that Ada and Grace share
a password, a 64-word list breaks all five accounts in 0.03 ms, and the same list against
bcrypt costs 27.3 s and *still takes all five* → the guess rates (SHA-256 6,006,030/s
against bcrypt 6/s on one core, a ratio near one million) → salt, work factor, and the
72-byte limit of bcrypt → migration 0005 with a `CHECK` that keeps the email lower case →
register and login with real transcripts (201, 409, 422, 401, and the identical message
for an unknown email) → **observable failure 2**, `forge_token.py`: an unsigned token is
edited in three lines and the server hands over an administrator → HMAC-SHA256 by hand,
`compare_digest` and `timingSafeEqual`, the `alg: none` rule from RFC 8725, expiry, and
"a token is not a secret box" → the hand-written token and the library token are
**byte-identical in both languages** → migration 0006 and the session cookie, with the
four flags in a table → **the measurement that decides**: after logout the cookie
answers 401 and the token answers 200 → the eight-row comparison table and the hybrid
recommendation → **observable failure 3**, the timing leak: `/auth/login-leaky` answers
an unknown email in 6.8 ms and a real one in 190.6 ms, and the dummy hash closes the gap
to 0.7 ms → **observable failure 4**, the blocked event loop: ten logins push `/healthz`
from 3.5 ms to 1727.8 ms in Python and 1192.8 ms in TypeScript; `run_in_threadpool` and
`bcrypt.compare` fix it → a FastAPI dependency against Express middleware → migration
0007, ownership, and 401/403/404 in one transcript → what the lesson does not cover
(rate limits, password reset, CSRF tokens, refresh tokens, OAuth, MFA) → nine practice
steps, two of which delete the deliberately wrong routes → nine quiz questions → OWASP,
RFC 7519, RFC 8725, RFC 6265, MDN, FastAPI, and the two constant-time comparison pages
as sources.

**Everything in this lesson was executed before shipping**: PostgreSQL 17.10 (Docker),
Python 3.12 with bcrypt 5.0.0, PyJWT 2.13.0, FastAPI 0.141.1; Node 24.19 with bcrypt 6,
express 4.21, zod 4, TypeScript 5.9. Every transcript, timing, and status code is real
output. `npx tsc --noEmit` passes.

**Format note.** Node 22.6 and later run `.ts` files directly, so the TypeScript project
has no build step and no bundler. `npm run typecheck` is the only step that checks types.
Practice step 8 makes the learner break a type on purpose, watch the server run anyway,
and then watch `tsc` catch it.

**Teaching hooks worth reusing.** (a) *The fix that is not a fix.* bcrypt bought 27.3
seconds and still lost every account, because the passwords were on the list. The
learner's own conclusion ("a slow hash makes me safe") breaks in the same output that
taught them the hash. (b) *Five lines end an argument.* The logout table
(`cookie: 401`, `token: 200`) settles sessions against JWTs faster than any prose. (c)
*The same defect in two vocabularies*, as in Lesson 6: `run_in_threadpool` and
`bcrypt.compare` are the same fix with two names, and the two measurements sit in one
code block.

**Two routes exist to be deleted.** `/auth/login-leaky` and `/auth/login-blocking` are
wrong on purpose, in both projects. This is Lesson 7's `naive/` pattern. Practice steps 4
and 5 measure them and remove them. If the learner keeps them, that is a bug, not a
style choice.

**Hazard.** `node-postgres` returns `bigint` as a string, so `bookmarks.id` arrives as
`"200002"` in TypeScript and `200001` in Python, while `users.id` (an `integer`) arrives
as a number in both. The lesson carries this as a sidenote. Expect it in Lesson 9's
tests.
### Lesson 0011 covers

Observability, in both languages, extending the Lesson 10 API. Structure: the one idea
(you cannot debug what you cannot see) → **observable failure**: five concurrent
identical search requests produce five byte-identical `uvicorn` access-log lines, with no
duration, no cache result, and no way to match a response back to a line → structured
JSON logs: `contextvars.ContextVar` for a per-request id (Python), `AsyncLocalStorage`
(TypeScript), one `log_event()`/`logEvent()` call per request → the same five requests,
now individually named and timed, with the slow one (11.87 ms against 1.98–3.95 ms)
revealed as the cache miss → `prometheus_client` / `prom-client`: a `Counter`
(`http_requests_total`) and a `Histogram` (`http_request_duration_seconds`), plus
`bookmark_search_cache_total`, served from `GET /metrics` → a `note--warn` on route-template
cardinality (`request.scope["route"]` / `req.route`, read only after routing, never the
raw path) → OpenTelemetry: `TracerProvider` + `SimpleSpanProcessor(ConsoleSpanExporter())`,
one `http_request` span per request, a child `pg_query` span only on a cache miss, proven
nested by a shared `trace_id` and a matching `parent_id`/`span_id` pair → **the payoff**:
`diagnose.py` / `diagnose.ts` reproduce Lesson 10's stale read, and the lesson diagnoses it
from the log line, the metric, and the missing trace span alone, with `main.py` never
reopened → eight practice steps, one of which breaks span nesting on purpose by removing
`context.with(...)` and asks the learner to observe two unrelated `traceId` values before
putting it back → six quiz questions → OpenTelemetry Python/Node getting-started guides,
Prometheus exposition format, `prometheus_client`/`prom-client`, Python `contextvars`,
Node `async_context`, and twelve-factor XI (Logs) as sources.

**Everything in this lesson was executed before shipping**: PostgreSQL 17.10 (Docker),
Redis 7 (Docker), Python 3.12 with `opentelemetry-sdk` 1.44.0 and `prometheus-client`
0.26.0, FastAPI 0.141.1; Node 24.19 with `@opentelemetry/sdk-trace-node` 1.30.1 and
`prom-client` 15.1.3, Express 4.21. Every log line, span, and metric sample quoted in the
lesson is real output from `Code/Lesson_11_code/` and `Code/js/Lesson_11_code/`, captured
against a shared `redis-bookmarks` container so the Python and TypeScript demos land in
the same cache. `pytest` (6 passed) and `vitest` (6 passed) both pass against the
instrumented servers.

**Bug caught and fixed before shipping, worth reusing as a teaching moment.** The first
version of the TypeScript middleware called `tracer.startSpan('http_request')` without
entering it into the active context. Every `pg_query` child span opened inside a route
handler then started its own, unrelated trace — same `traceId` mismatch a learner will hit
the first time they wire tracing into Express by hand. The fix,
`context.with(trace.setSpan(context.active(), span), () => next())`, is now Practice
step 6 and a `note--warn` in the lesson: break the nesting on purpose, see the two
`traceId` values, then understand why the wrapper is required. Python's equivalent
(`with tracer.start_as_current_span(...) as span:`) never has this failure mode, because
the context manager both starts and activates the span in one call — worth naming as the
reason Python's version needed no such warning.

**Tooling hazard, worth reusing.** A copied `.venv/` directory (from `cp -r
Lesson_10_code Lesson_11_code`) leaves `pip`/`uvicorn` shebangs pointing at the *old*
project's interpreter. `pip install` then reports packages "already satisfied" from the
wrong venv and the new venv silently stays empty. Delete and recreate `.venv` after
copying a lesson directory, or install with `.venv/bin/python -m pip install ...`, which
ignores the stale shebang.

**Scenario reuse, on purpose.** The payoff diagnosis reuses Lesson 10's exact stale-read
scenario — same cache key shape, same 30 s TTL, same direct-SQL bypass — so the learner's
conclusion from Lesson 10 (the response is 200 and the answer is wrong) becomes the
premise Lesson 11 diagnoses with new tools, instead of a new failure to learn from
scratch.

### Lesson 0012 covers

Scaling the API to two instances, in both languages. Structure: the one idea (add
a second instance and every assumption about local state breaks) → the
round-robin TCP proxy (`round_robin_proxy.py` and `src/roundRobinProxy.ts`) →
**observable failure 1**: an in-memory rate limiter allows 11 attempts across
two instances when the limit is 5 → the fix: an atomic Redis counter
(`INCR` + `EXPIRE`), proven to block correctly at 6 attempts across the proxy →
**observable failure 2**: oversubscribed database connection pools (max 10+10 against a database capacity of 15)
produce a "slow failure" under burst load, hanging callers for 10–14 seconds while
every request eventually succeeds → the fix: right-sized pools (max 7+7) with a
short timeout (3s) produce honest backpressure, failing fast with a 503 and
`Retry-After` header → **observable failure 3**: reading from a read replica
immediately after a primary write yields a stale answer, proven by pausing WAL
replay on the replica container during the bench script → four practice steps
→ six retrieval-practice questions.

**Everything in this lesson was executed before shipping** against PostgreSQL 17.10
(Docker), Redis 7-alpine (Docker), Python 3.12, Node 24.19. Every bench run
number and HTTP transcript is real output from a live test.

**Teaching hook worth reusing — Node vs Python raw failure modes.** Python's
`psycopg_pool` queues callers automatically, resulting in the 14-second
hang during oversubscription. Node's `pg.Pool` lacks a queue timeout and fails
instantly with Postgres's raw `53300: too many clients already` error when
the connection is refused. The lesson does not hide this divergence; it adds a
manual timeout wrapper to the TypeScript side and explicitly calls out the
difference in a note, proving that libraries wrap the same primitive differently.

### Lesson 0013 covers

Version control, git's own mechanism rather than a per-language one. Structure: the
one idea (a commit is a snapshot with a parent; history is a graph, not a list) →
**raw mechanism**: `git hash-object`, `git update-index`, `git write-tree`, and
`git commit-tree` build one commit by hand, before naming the blob/tree/commit
objects `git commit` hides → a branch shown to be a 41-byte pointer file, not a
copy (`.git/refs/heads/main`, `.git/HEAD`) → **observable failure 1**: two branches
each edit the same two lines of `get_bookmark`/`getBookmark`, and `git merge` stops
with a real conflict, resolved by hand → the same conflict replayed with `git
rebase`, contrasted against the merge: a two-parent merge commit versus a straight
line with a rewritten commit hash → the index, via `git diff` against `git diff
--staged` → **observable failure 2**: a local `git reset --hard HEAD~1` followed by
`git push --force` erases a commit already reviewed and pushed → **the rescue**:
`git reflog` finds the dropped commit's hash on the machine that made it, and a
second force-push restores `origin/main` → pull requests and branch protection,
which prevents the failure outright rather than relying on the reflog rescue → five
practice steps → seven retrieval-practice questions.

**Every transcript in this lesson is real output**, captured by running
`Code/Lesson_13_code/demo.sh` and `Code/js/Lesson_13_code/demo.sh` against git
2.43 in a throwaway repository and bare remote, both rebuilt from scratch on every
run. Every commit hash, tree hash, and blob hash quoted in the lesson came out of
one of those runs — none is invented.

**Teaching hook worth reusing — the reflog is local, not shared.** The lesson
deliberately shows the force-push rescue succeeding, then immediately names its
limit: the reflog that recovers the commit lives only on the machine that made it,
never on the remote and never in a teammate's clone. This turns the rescue into an
argument for the actual fix (branch protection) instead of a trick to remember,
the same shape as Lesson 3's incomplete `Allow` header and Lesson 12's doubled rate
limit — the abstraction (a force-push "just works") leaks, and the learner can only
see the leak because Step 1 built commits by hand first.


### Lesson 0014 covers

How a request finds your server: DNS. Structure: the one idea (a name becomes an
address through caches you do not control) → **raw mechanism**: `dns_query.py` /
`dnsQuery.ts` build the twelve-byte header and length-prefixed labels of a DNS
query by hand and parse the reply, before naming `dig` and
`socket.getaddrinfo` as the tools that hide the same packet → record types
A, AAAA, CNAME, MX, TXT, each queried against a real domain → the walk from
root to TLD to authoritative server, one `dig` call per hop, each server
answering `recursion requested but not available` → the recursive resolver
as the one server that performs that walk and caches the result →
**observable failure**: `toy_dns_server.py` / `toyDnsServer.ts` (a one-record
authoritative server for `bookmarks-api.local`, rereading `zone.json` on
every query) and `caching_resolver.py` / `cachingResolver.ts` (a stub
resolver with a TTL-keyed cache) show a record changing on the authoritative
server while the cached answer stays wrong until the TTL expires → `curl
--resolve` makes the boundary explicit: the address DNS returns is what
Lesson 1's socket actually connects to → five practice steps → six
retrieval-practice questions.

**Every transcript in this lesson is real output**, captured by running
`Code/Lesson_14_code/demo.sh` and `Code/js/Lesson_14_code/demo.sh` against
real public DNS infrastructure (root server `198.41.0.4`, `.com` TLD server
`192.5.6.30`, `example.com`'s own authoritative servers) and against the
toy authoritative server and stub resolver built for this lesson. No record,
hash, or timing quoted in the lesson is invented.

**Teaching hook worth reusing — the record is correct the instant it
changes; the answer is not.** The toy authoritative server answers the new
IP on the very query after the operator edits `zone.json`. The stub
resolver keeps returning the old IP for the rest of the TTL regardless,
because nothing tells it the record changed — it only checks again once
the TTL it already has runs out. This is the same leak-in-the-abstraction
shape as Lesson 3's incomplete `Allow` header, Lesson 12's doubled rate
limit, and Lesson 13's local-only reflog: the fix Lesson 14 argues for
(a short TTL before a migration, not faith in instant propagation) only
makes sense once the learner has watched the gap happen on a TTL short
enough to see with a `sleep`.

### Lesson 0015 covers

The edge: reverse proxy and TLS. Structure: the one idea (the process that
answers port 443 is not your application) → `origin.py` / `origin.ts`, a
small stand-in API that reports exactly what it received, so a proxy's
effect on a request is visible → **raw mechanism**: `tls_proxy.py` /
`tlsProxy.ts` terminate TLS by hand with `ssl.SSLContext.wrap_socket` /
Node's `tls` module, before naming Nginx → **observable failure 1**: curl
refuses a self-signed certificate outright, then trusts it once told to
with `--cacert` → SNI: one process, one port, two certificates, chosen by
the hostname sent inside the handshake before any HTTP request exists →
forwarding headers: `X-Forwarded-For` / `X-Forwarded-Proto` restore what
TLS termination erases from the origin's point of view →
**observable failure 2**: an oversize body gets `413` from the proxy, and
the origin's own log shows nothing for that request → the abstraction:
`nginx.conf` performs the identical four jobs as configuration, run with
Docker on `--network host`, and every transcript from the raw mechanism
repeats unchanged against it → five practice steps → five
retrieval-practice questions.

**Every transcript in this lesson is real output**, captured by running
`Code/Lesson_15_code/demo.sh` and `Code/js/Lesson_15_code/demo.sh` against
`tls_proxy.py` / `tlsProxy.ts` and against a real `nginx:1.27-alpine`
container. No certificate subject, header value, or status code quoted in
the lesson is invented.

**Teaching hook worth reusing — the same four jobs, twice.** `tls_proxy.py`
and `nginx.conf` terminate TLS, pick a certificate by SNI, add forwarding
headers, and enforce a body limit in that exact order, one by hand and one
declared. Running the identical curl and `openssl s_client` commands
against both and getting identical output is the argument for Nginx over a
hand-rolled proxy — it is the same mechanism, not a different one, with
correctness and performance the demo does not need to prove.


### Lesson 0016 covers

Rules the browser enforces. Structure: the one idea (CORS and CSP are
instructions to the browser; they protect the user, not the server) →
two real origins on the loopback interface, `http://127.0.0.1:8051`
(`static_site.py`) and `http://127.0.0.2:8040` (`api.py`), chosen as two
different loopback addresses so no `/etc/hosts` edit is needed →
**observable failure 1**: a real headless Chromium's `fetch()` rejects a
simple `GET /bookmarks` with `TypeError: Failed to fetch` while
`api.py`'s own log shows `200` — curl on the identical URL gets a clean
`200` body, because curl enforces no same-origin policy at all →
**observable failure 2**: the identical page's `POST /login` never
reaches the server at all, because its JSON body makes it a
non-*simple* request, and the preflight `OPTIONS` gets no
`Access-Control-Allow-*` headers back → the fix: `CORS_ALLOW=on` echoes
the calling origin, never `*`, so the response can carry
`Access-Control-Allow-Credentials` → **observable failure 3**: with CORS
fixed, login succeeds and sets a cookie, but the very next
cross-*site* `GET /whoami` reports `cookie_header: null` — a
`SameSite=Lax` cookie set by a cross-site response is never stored at
all, confirmed with `page.cookies()` returning `[]`, not merely
withheld from being sent → `SameSite=None` set instead is dropped too,
because it requires `Secure`, and this demo stays on plain HTTP → a
same-origin control case proves `HttpOnly` separately: the server sees
the cookie, `document.cookie` reads `""` on the cookie's own origin →
CSP: `Content-Security-Policy: default-src 'self'` blocks a deliberate
inline `<script>` and, independently, the page's own cross-origin
`fetch()`, since `connect-src` falls back to `default-src` too → five
practice steps → five retrieval-practice questions.

**Every transcript and every console error quoted in this lesson is
real output**, captured with the `browser` tool driving a real headless
Chromium against `Code/Lesson_16_code/api.py` and `static_site.py`, then
reproduced against the TypeScript twin. No error message, header value,
or cookie-store result is invented or recalled from memory.

**Teaching hook worth reusing — origin, site, and two different loopback
addresses.** `CORS` is enforced per *origin* (scheme, host, port); a
cookie's `SameSite` is enforced per *site* (scheme, registrable domain,
ignoring port). Two ports on `127.0.0.1` would have been different
origins but the same site, silently hiding the `SameSite` failure this
lesson needed to show. Moving the API to `127.0.0.2` — still loopback,
still no `/etc/hosts` — made both boundaries real at once. Worth
repeating whenever a lesson needs a genuine cross-site case without
standing up DNS.

---

## Built infrastructure


- `assets/course.css` — Tufte-influenced shared stylesheet. **All theming is tokens in
  `:root`.** Dark by default; `@media print` resets the full palette to light.
- `assets/quiz.js` + `quiz.css` — zero-dependency retrieval-practice widgets. Three
  declarative types: multiple choice, typed answer, free recall. Auto-tallies a score.
- `ROADMAP.md` — scope checklist. Scope only,
  not an order and not a source of truth.
- `RESOURCES.md` — every URL fetched and verified 2026-08-01 (Pydantic docs added and
  verified 2026-08-02; PostgreSQL Constraints, psycopg 3, and Alembic added and verified
  2026-08-03; PostgreSQL Using EXPLAIN and Operator Classes added and verified
  2026-08-09; PostgreSQL Transaction Isolation and Explicit Locking, SQLAlchemy ORM Quick
  Start and Relationship Loading Techniques added and verified 2026-08-10), with staleness
  flags and an explicit *Avoid* list and *Gaps* list.
- `reference-pdfs/` — offline print-outs of the three specs the curriculum leans on,
  generated 2026-08-02: `asgi-spec-key-points.pdf` (6pp), `rfc9110-methods-key-points.pdf`
  (7pp, all eight methods with safe/idempotent/cacheable/body properties), and
  `pep3333-wsgi-key-points.pdf` (6pp). Light-background A4 — the dark-mode rule in
  `AGENTS.md` governs HTML, and these are made to be printed.
- `Code/Lesson_4_code/` — runnable reference implementation: `migrations/0001…0002.sql`,
  `migrate.py` (the hand-written runner), `main.py` (DB-backed API on a psycopg pool),
  `sql_injection_demo.py`. Needs `DATABASE_URL` and `pip install "psycopg[binary,pool]"`.
- `Code/Lesson_5_code/` — `seed.sql` (200 000 bookmarks, 585 000 tag links, with
  `ANALYZE`), `migrations/0003_add_title_search_index.sql` (`text_pattern_ops`),
  `main.py` (Lesson 4's API plus `GET /bookmarks/search` and a deliberately N+1
  `GET /bookmarks/slow` — the lesson tells the learner to delete it after measuring),
  `n_plus_1.py` (times both shapes, prints the query count), `slow_link.py` (asyncio TCP
  proxy on port 55433 adding 1 ms each way, to simulate a non-local database).
- `Code/Lesson_6_code/` — `migrations/0004_add_visit_count.sql`, `lost_update.py` (four
  concurrency strategies under 20 threads, prints the lost count and the retry count),
  `orm_models.py` (SQLAlchemy 2.x over the migration-owned schema; **no `create_all()`**,
  deliberately), `orm_n_plus_1.py` (`--echo` prints the generated SQL; counts queries with
  a `before_cursor_execute` event listener), `orm_increment.py` (`--echo` shows the three
  increment shapes; without it, measures the lost updates), `main.py` (Lesson 5's API with
  `/bookmarks/slow` removed and `POST /bookmarks/{id}/visit` added). Needs `DATABASE_URL`
  and `pip install "psycopg[binary,pool]" "sqlalchemy>=2"`. The lesson's own `migrate.py`
  stays in `Code/Lesson_4_code/`; the learner copies migration files next to it.
- `Code/Lesson_7_code/` — **the first self-contained, deployable copy of the project.**
  Unlike Lessons 4–6, it carries its own `migrations/0001`–`0004`, so the image holds the
  whole schema history. `config.py` (one `pydantic-settings` class, `SystemExit` on a bad
  value), `main.py` (Lesson 6's API plus `GET /healthz`, pool sizes from config),
  `migrate.py` (Lesson 4's runner, now a release step), `Dockerfile` (non-root
  `appuser` uid 10001, `sh -c "exec uvicorn … --port ${PORT:-8000}"`),
  `.dockerignore` (keeps `.env` out of the build context), `compose.yaml` (db with a
  named volume + healthcheck, `migrate` as a one-shot release step, `api` on host port
  **8007**), `.env.example`, `render.yaml` (validated against Render's JSON schema),
  `README.md` (the CV artifact), and `naive/` (`Dockerfile` + `main.py`, the four
  failures). Run it with `cp .env.example .env && docker compose up --build`.
  Warning: `docker compose down -v` deletes the named volume and all rows.
- `reference/reading-a-query-plan.html` — the plan-reading card: what each field means,
  every node type they will meet, the index rules, and a fixed diagnosis order.
- `Code/Lesson_8_code/` — accounts, in Python. `config.py` (Lesson 7's class plus
  `SECRET_KEY`, the two TTLs, and `BCRYPT_ROUNDS`), `security.py` (bcrypt helpers, the
  dummy hash for constant-time login, a hand-written HS256 token, and the PyJWT twin —
  `python security.py` proves the two are byte-identical), `main.py` (register, login,
  token, me, logout, logout-everywhere, owned bookmarks), `migrate.py`,
  `migrations/0001`–`0007`, `wordlist.txt` (64 common passwords), and three measurement
  programs: `hash_speed.py`, `forge_token.py`, `event_loop_block.py`. Two routes are
  wrong on purpose: `/auth/login-leaky` and `/auth/login-blocking`.
- `Code/js/Lesson_8_code/` — the TypeScript twin. `src/config.ts` (zod over
  `process.env`), `src/security.ts`, `src/server.ts` (Express 4 with `cookie-parser`,
  `requireUser` middleware), `src/migrate.ts` (writes the **same** version strings as
  `migrate.py`, so one database serves both stacks), and `src/hashSpeed.ts`,
  `src/forgeToken.ts`, `src/eventLoopBlock.ts`. No build step: Node runs the `.ts` files.
  `npm run typecheck` is the only type check. API on port **8009**; Python runs on 8008.
- `Code/Lesson_9_code/` + `Code/js/Lesson_9_code/` — the Lesson 8 API with an integration
  test suite. Python: `conftest.py` (drops and rebuilds the schema once per session, then
  a `client` fixture per test), `test_auth.py`, `test_bookmarks.py`, `docker-compose.test.yml`
  (Postgres only), `.github/workflows/ci.yml`. TypeScript: `tests/setup.ts`,
  `tests/auth.test.ts`, `tests/bookmarks.test.ts` with `vitest` + `supertest`. Both suites
  run against a real PostgreSQL container, never SQLite.
- `Code/Lesson_10_code/` + `Code/js/Lesson_10_code/` — the Lesson 9 API plus two caches.
  `GET /bookmarks/{id}` carries an `ETag` and `Cache-Control: max-age=30`, and answers
  `304` on a matching `If-None-Match`. `GET /bookmarks/search` (the Lesson 5 prefix search,
  re-added here) is cached in Redis with a 30 s TTL. `cache_bench.py` / `cacheBench.ts`
  measure a real miss against a real hit and demonstrate a stale read: a row inserted
  directly with `psql`, bypassing the API, does not appear in a cached search until the
  TTL expires. Both `docker-compose.test.yml` files and both `ci.yml` workflows now start
  a `redis:7-alpine` service alongside Postgres, though the test suites themselves do not
  touch Redis.
- `Code/Lesson_11_code/` + `Code/js/Lesson_11_code/` — the Lesson 10 API, observed.
  `observability.py` / `observability.ts` (request id, `log_event`/`logEvent`, the
  Prometheus `Counter`/`Histogram`/cache-result metrics, the OpenTelemetry
  `TracerProvider` with a console exporter), `GET /metrics` added to `main.py` /
  `server.ts`, a `pg_query` child span wrapped around the search endpoint's database
  call, and `diagnose.py` / `diagnose.ts` (reproduces the Lesson 10 stale read and
  prints only the client side of the payoff — the server's own terminal carries the
  log lines and spans the lesson diagnoses from).
- `Code/Lesson_12_code/` + `Code/js/Lesson_12_code/` — the Lesson 11 API scaled to two
  instances. `round_robin_proxy.py` / `roundRobinProxy.ts` (a hand-written reverse
  proxy), `rate_limit.py` / `rateLimit.ts` (local-dict and Redis-`INCR` backends),
  `bench_rate_limit.py`, `bench_pool_backpressure.py` / `benchPoolBackpressure.ts`,
  `slow_link_small_db.py` (adds latency to a deliberately small database), and
  `replica_lag_bench.py` / `replicaLagBench.ts` (pauses and resumes WAL replay on a
  real streaming replica).
- `Code/Lesson_13_code/` + `Code/js/Lesson_13_code/` — self-contained `demo.sh` scripts,
  no server and no database. Each rebuilds a throwaway git repository (and, in the
  Python version, a bare remote) from scratch on every run and prints every transcript
  quoted in the lesson: the blob/tree/commit walkthrough, the merge and rebase
  conflicts, the index diff, and the force-push/reflog rescue.
- `Code/Lesson_14_code/` + `Code/js/Lesson_14_code/` — the Lesson 12 API carried
  forward unchanged, plus `dns_query.py` / `dnsQuery.ts` (raw DNS query, no
  library), `toy_dns_server.py` / `toyDnsServer.ts` (one-record authoritative
  server reading `zone.json` fresh on every query), and `caching_resolver.py` /
  `cachingResolver.ts` (a stub resolver with a TTL-keyed cache). `demo.sh` in
  each directory is the whole lesson, runnable, needing only a network
  connection and no database.
- `Code/Lesson_15_code/` + `Code/js/Lesson_15_code/` — `origin.py` / `origin.ts`
  (a stand-in API that reports what it received), `tls_proxy.py` / `tlsProxy.ts`
  (a hand-written TLS-terminating reverse proxy with SNI-based certificate
  selection, forwarding-header rewriting, and a body-size limit),
  `generate_certs.sh` / `generate-certs.sh` (one self-signed certificate per
  hostname), and `nginx.conf` (the identical config in both directories,
  terminating TLS for the same two hostnames). `demo.sh` in each directory
  runs the raw mechanism first, then a real `nginx:1.27-alpine` container
  against the same certificates and origin.
- `Code/Lesson_16_code/` + `Code/js/Lesson_16_code/` — `api.py` / `api.ts`
  (two origins' worth of routes: `/bookmarks`, `/login`, `/whoami`, gated
  behind `CORS_ALLOW` and `COOKIE_SAMESITE` environment variables) and
  `static_site.py` / `staticSite.ts` (serves `static/`, gated behind
  `CSP_MODE`). `static/index.html`, `script.js`, and `style.css` are
  identical files in both directories — CORS, CSP, and cookie attributes
  are protocol rules, not language features. `demo.sh` in each directory
  proves every header transcript with curl; the console errors and
  cookie-store results need a real browser, noted in each `README.md`.
- `lesson_plan.md` — the order of the course: what is done, what each finished lesson
  proved, and twelve planned lessons (17–28) with their one idea.
