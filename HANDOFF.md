# Handoff

Cold-start briefing for a new chat. Read this first, then `MISSION.md`, then `NOTES.md`.
This file is the *state of play*; `NOTES.md` is the working scratchpad and
`learning-records/` holds decisions that must not be silently reversed.

Last updated: **2026-08-10** (end of Session 7).

---

## Your role

You are the teacher for this workspace. The learner is a fluent Python programmer who has
never built a server and is working toward a backend/full-stack job at ~14–15 hrs/week.
Lessons are self-contained dark-mode HTML files in `lessons/`, built on the shared assets.

Do not restate the mission back to the learner — they wrote it. Pick up and teach.

---

## Where things stand

| | |
| --- | --- |
| Sessions completed | 7 |
| Lessons shipped | `0001-a-server-is-bytes-on-a-socket.html`, `0002-a-server-without-a-framework.html`, `0003-fastapi.html`, `0004-relational-modelling-and-sql.html`, `0005-why-is-this-slow.html`, `0006-concurrency-and-the-orm.html`, `0007-deployment.html` |
| Reference docs | `reference/http-message-anatomy.html`, `reference/reading-a-query-plan.html` |
| Reference PDFs | `reference-pdfs/` — ASGI spec, RFC 9110 Methods, PEP 3333 key points, HTTP Messages Reference (`HTTP_Messages_Reference.pdf`) |
| Lesson code | `Code/Lesson_1_code/`, `Code/Lesson_2_code/`, `Code/Lesson_4_code/` (schema migrations, `migrate.py`, DB-backed `main.py`, injection demo), `Code/Lesson_5_code/` (`seed.sql`, migration 0003, `main.py` with search + a deliberate N+1 endpoint, `n_plus_1.py`, `slow_link.py`), `Code/Lesson_6_code/` (migration 0004, `lost_update.py`, `orm_models.py`, `orm_n_plus_1.py`, `orm_increment.py`, `main.py` with the visit counter), `Code/Lesson_7_code/` (the deployable project: `config.py`, `main.py` with `/healthz`, `migrate.py`, `migrations/0001`–`0004`, `Dockerfile`, `.dockerignore`, `compose.yaml`, `.env.example`, `render.yaml`, `README.md`, and `naive/` for the four failures) |
| Learning records | LR-0001 (language anchor: Python first) |
| Glossary | `GLOSSARY.md` — twenty-one terms (Lesson 7 added config, container image, health check, release step) |
| Next on the spine | **The language decision.** The deploy is the TypeScript trigger from LR-0001. Ask the learner before planning Lesson 8; auth in Python is the other reasonable answer. |

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

**Not yet done by the learner: the deploy itself.** The live-URL line in
`Code/Lesson_7_code/README.md` is a marked placeholder. It is not a claim, and it must
not become one until the learner sends a real URL.

### Built infrastructure

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

---

## Conventions that must hold

1. **All HTML is dark mode** (`AGENTS.md`). Theme from `:root` tokens in `course.css`;
   never override per lesson, never inline styles.
2. **Raw mechanism before the abstraction.** This learner can already code. Show the
   socket before the framework, the SQL before the ORM. Hiding machinery wastes their
   main advantage.
3. **Every lesson ends in something demonstrable.** The goal is employment; a lesson that
   produces no artifact is a lesson that produces no CV line.
4. **Sources are verified, not recalled.** `RESOURCES.md` entries were fetched. Anything
   new gets fetched before it is cited, and dated.
5. **Python + FastAPI is settled** (LR-0001). Do not relitigate. **The TypeScript revisit
   trigger has now fired**: Lesson 7 deploys the Python API. Ask the learner what they
   want next; do not decide for them, and do not abandon Python by default.
6. **Record decisions, not diary.** A new `learning-records/NNNN-*.md` only when a choice
   constrains future lessons and the evidence is non-obvious.
7. **Ignore JS directories.** The directories `lessons/js/`, `Code/js/`, and `reference-pdfs/js/` exist as a secondary reference port. Do not update or track them in HANDOFF.md — the curriculum's sole active teaching spine is Python + FastAPI.
8. **All lesson prose follows ASD-STE100 Simplified Technical English** (`AGENTS.md`).
   One meaning for each word, one part of speech for each word, active voice, simple
   tenses, sentences of 20–25 words maximum, no -ing constructions, no idiom. This
   applies to lessons, reference cards, glossary entries, and summaries — not to code,
   SQL, or terminal output. Lessons 1–5 predate the rule; convert them when they are
   next edited. Lesson 6 is the first lesson written under it; Lesson 7 follows it too.
9. **Ignore `summaries/` directory.** The `summaries/` folder contains generated summaries for Lessons 1, 2, and 3. Future agents must totally ignore this directory.

---

## Open threads

- **Learner ran Lesson 1 code.** Confirmed: both `client.py` and `server.py`.
- **`GLOSSARY.md` updated.** Twenty-one terms total. New from Lesson 7: config, container
  image, health check, release step. Note this workspace promotes terms at lesson time,
  before the learner has demonstrated them — check usage next session and revise anything
  that did not land.
- **Code-review venue.** Code Review Stack Exchange is now *raised* — it is named in
  Lesson 5's closing `.ask` block, alongside r/PostgreSQL for plan questions. Ask next
  session whether they posted, and offer to read the post before it goes up.
- **Location / in-person community** — never asked. `RESOURCES.md` lists it as a gap.
- **TypeScript entry point — the trigger has fired.** Lesson 7's closing `.ask` block
  asks the question directly: TypeScript next, or authentication in Python first? Wait for
  the answer before you plan Lesson 8.
- **Bookmarks API** — the learner's `bookmarks-api/main.py` is still the in-memory
  version, and it has a latent bug: the path is `/bookmarks/{id}` while the handler takes
  `bookmark_id`, and `request` is unannotated. Walk them through migrating it to the
  Lesson 4 shape rather than handing over the finished file.
- **HTTP Messages PDF** — reminder delivered in Lesson 4's opening note; Session 5 did not
  get to ask (no learner reply in session). Still open — ask.
- **Learner has not replied in-session since Lesson 4.** Lessons 4, 5, 6 and 7 were all
  shipped without confirmation that the practice was done. **Ask before teaching Lesson
  8**, and ask concretely: did they run `lost_update.py`, and did they deploy Lesson 7?
  Lesson 7's `.ask` block asks for the first deploy log and for the URL, so an answer may
  already be waiting. If the project is not deployed, the right move is a working session
  on the deploy, not a new lesson.
- **The live URL is unknown.** `Code/Lesson_7_code/README.md` carries a marked placeholder
  where the URL goes. Fill it in only from a URL the learner sends. Never invent one.
- **Docker note.** The `pg-bookmarks` container is now created with a named volume
  (`-v pg-bookmarks-data:/var/lib/postgresql/data`); the Lesson 4 `docker run` line has no
  volume, so a container recreation silently loses the data. Lesson 4's text was left
  as-is; mention the volume flag when it next comes up.

---

## Next lesson: spec

**Ask first, then choose.** Lesson 7 ends with an open question, and the answer decides
the next lesson. Two candidates, both prepared:

### Candidate A — the language decision (LR-0001's trigger)

The Python API is deployed, which is the condition LR-0001 set. This is a conversation,
not a lesson: what a TypeScript port buys in the job market, what it costs in weeks, and
which parts of Lessons 1–7 transfer without change (sockets, HTTP framing, indexes, the
lost update) against which parts do not (the type system, the async model, the
ecosystem). If the learner says yes, the first TypeScript artifact should be the *same*
bookmarks API, so the diff is the lesson. Write a second learning record for the
decision, whichever way it goes.

### Candidate B — Lesson 0008, authentication

- **The observable failure to open with.** Store a password with a fast hash, or with no
  hash, then crack it in front of the learner. Then show a session cookie without
  `HttpOnly` read by one line of JavaScript, and a JWT with `alg: none` accepted by a
  naive verifier.
- **The mechanism before the library.** Sign a token by hand with `hmac`, then read it
  back. Only after that reach for a library.
- **The real decision.** Sessions against tokens: where the state lives, what logout
  means in each, and why "stateless" is a cost as well as a benefit. Revocation is the
  question that separates the two.
- **Password storage.** Argon2id against bcrypt, with the parameters and the reason.
  Measure the hash time; a slow hash is the feature.
- **The artifact.** `POST /login`, a protected `POST /bookmarks`, and a FastAPI dependency
  that carries the current user. Add both to the deployed service, so the CV artifact
  grows instead of forking.
- Sources: fetch and date them. Candidates: OWASP Password Storage Cheat Sheet,
  RFC 8725 (JWT Best Current Practices), RFC 9700 if it covers the OAuth guidance needed,
  the FastAPI security chapter, and the `argon2-cffi` documentation.

### Either way

Lesson 8 must extend the deployed service, not a local copy. The deploy is now the spine
of the project, and every later lesson should ship to it.
