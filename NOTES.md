# Working Notes

Scratchpad for teaching preferences and working state. Not a journal — see
`./learning-records/` for decision-grade insights.

## Learner profile

- Fluent in Python. Rusty JavaScript (unused for a long time).
- Has never built a server. After Lessons 1–3: understands sockets, HTTP parsing, routing,
  status codes, WSGI/ASGI contracts, and FastAPI (routing, Pydantic validation,
  serialisation, HTTPException, OpenAPI docs). Has a running JSON API.
  After Lesson 4: also relational modelling, SQL joins/aggregates, constraints,
  transactions, migrations, and psycopg. Has a persistent API.
- ~14–15 hrs/week. That is a lot — lessons can chain into a continuous project build.
- Goal is employment, so bias every lesson toward something that ends up demonstrable.

## Teaching preferences

- **All HTML ships dark mode.** Stated preference, recorded in `AGENTS.md`. Theme is
  token-driven from `:root` in `assets/course.css`; never override per lesson.
- Default assumption until told otherwise: show the raw mechanism before the abstraction.
  This learner can already code, so hiding the machinery behind a framework would waste
  the main advantage they have.

## Session state

- **Session 1 (2026-08-01):** Workspace bootstrapped. Mission established. Language
  question settled (Python-first, TypeScript layered later — LR-0001). Built
  `assets/course.css` + `assets/quiz.{js,css}`. Shipped Lesson 0001 (raw HTTP over a
  socket) and the HTTP reference card.
  Retheme: all HTML is dark mode (`AGENTS.md`), print media resets to light.
  `ROADMAP.md` added as local scope checklist.
- **Session 2 (2026-08-01):** Shipped Lesson 0002 (server without a framework: parsing,
  routing, status codes, WSGI/ASGI). Created `GLOSSARY.md` with first five terms
  (framing, start-line, idempotent, safe method, virtual hosting). Confirmed learner ran
  Lesson 1 code (both client.py and server.py).
- **Session 3 (2026-08-02):** Shipped Lesson 0003 (FastAPI: routing with decorators, path
  params, query params, Pydantic request-body validation, HTTPException, OpenAPI /docs,
  complete bookmarks API with CRUD). Updated Lesson 2 nav link. Created reference PDFs
  from ASGI spec, RFC 9110 Methods, and PEP 3333 in `reference-pdfs/`.
  All lesson code was run before shipping (FastAPI 0.137.1 / Pydantic 2.13.4 /
  Uvicorn 0.49.0); quoted status codes and bodies are real output.
  **What worked:** finding a spot where the abstraction leaks and making the learner
  check it — FastAPI's 405 `Allow` header is incomplete when one path uses separate
  decorators. It pays off the "raw mechanism first" convention directly, because the
  learner can only see the gap thanks to hand-writing `allowed_methods()` in Lesson 2.
  Look for one such leak per framework lesson.
- **Session 4 (2026-08-03):** Shipped Lesson 0004 (relational modelling + SQL:
  denormalised failure first, three-table normalised schema, constraints,
  joins/aggregates, transactions, a hand-written migration runner, then psycopg
  wired into FastAPI with a pooled connection). Reference code in
  `Code/Lesson_4_code/`. Glossary +3 (atomicity, junction table, migration);
  RESOURCES +3 (PG constraints, psycopg 3, Alembic), verified 2026-08-03.
  Everything was executed against PostgreSQL 17.10 in Docker with psycopg 3.3.4
  / psycopg-pool 3.3.1 / FastAPI 0.141.1 — all psql transcripts and curl output
  in the lesson are real, including the error messages.
  **What worked (reuse):** the "do it wrong first" opening. A tags column of
  comma-separated text, then `LIKE '%web%'` returning WebAssembly — the learner
  sees a wrong *answer*, not an abstract rule, and 1NF lands in one line. Same
  shape as Lesson 3's leaky-`Allow` hook: make the failure observable, then name
  the principle.

- **Session 5 (2026-08-09):** Shipped Lesson 0005 (why is this slow? — `EXPLAIN
  (ANALYZE, BUFFERS)`, indexes, the leftmost-columns rule, the write cost of
  indexes, and the N+1 problem). New reference card
  `reference/reading-a-query-plan.html`. Code in `Code/Lesson_5_code/`
  (`seed.sql`, `migrations/0003_add_title_search_index.sql`, `main.py` with
  `/bookmarks/search` and a deliberate `/bookmarks/slow`, `n_plus_1.py`,
  `slow_link.py`). Glossary +3 (index, N+1 problem, query plan); RESOURCES +2
  (PostgreSQL Using EXPLAIN, Operator Classes), fetched and verified
  2026-08-09. `assets/course.css` gained a `blockquote` rule — for verbatim
  quotation from a spec, as distinct from `.note` for our own asides.
  Everything ran against PostgreSQL 17.10 in Docker with psycopg 3.3.4 /
  FastAPI 0.141.1 on 200 000 seeded rows; every plan and timing in the lesson
  is real output.
  **Scope call:** the Lesson 5 spec in HANDOFF also listed isolation levels and
  the ORM. Both were moved to Lesson 6. Indexes + N+1 is already one coherent
  skill (measure → diagnose → fix → prove); concurrency is a different
  question and would have doubled the working-memory load.
  **What worked (reuse):** the same observable-failure hook, twice over.
  (a) Create the index on `title`, then run `LIKE 'Article number 1370%'` and
  watch it *still* do a sequential scan — the fix is `text_pattern_ops`. The
  learner's assumption ("I added an index, so it is fast") breaks in front of
  them. (b) N+1 measured on localhost is only 7× — unimpressive, and that is
  the point; `slow_link.py` (a 25-line TCP proxy adding 1 ms each way) turns it
  into 51× without touching the code. Making the *environment* the variable is
  a hook worth reusing.
  **Method note worth keeping:** I first tried to demonstrate all of this with
  `time curl` against the endpoints and got numbers that contradicted the SQL
  measurements — the endpoint timings were dominated by a ~25 ms TCP
  delayed-ACK artifact on loopback, not by the database. Measure at the layer
  the claim lives in. This is now a `.note` in the lesson, and it is a better
  lesson about measurement than anything I planned.

- **Session 6 (2026-08-10):** Shipped Lesson 0006 (concurrency and the ORM — the
  lost update, isolation levels, `SELECT … FOR UPDATE`, one-statement updates,
  `REPEATABLE READ` + retry, then SQLAlchemy 2.x over the same schema with
  `echo=True`). Code in `Code/Lesson_6_code/`
  (`migrations/0004_add_visit_count.sql`, `lost_update.py`, `orm_models.py`,
  `orm_n_plus_1.py`, `orm_increment.py`, `main.py` with
  `POST /bookmarks/{id}/visit`). Glossary +3 (isolation level, lost update,
  ORM); RESOURCES +4 (PostgreSQL Transaction Isolation, PostgreSQL Explicit
  Locking, SQLAlchemy ORM Quick Start, SQLAlchemy Relationship Loading
  Techniques), fetched and verified 2026-08-10. Everything ran against
  PostgreSQL 17.10 in Docker with psycopg 3.3.4 / SQLAlchemy 2.0.51 /
  FastAPI 0.141.1; every transcript, count and timing in the lesson is real
  output. This is the first lesson written under ASD-STE100.
  **Scope call:** the spec asked for three strategies. I measured four. The
  fourth (`REPEATABLE READ` + retry) cost 772.3 ms and 1411 retries against
  247.9 ms for `FOR UPDATE` and 178.3 ms for one statement. The retry price is
  now a measurement, not a claim, so "choose the fix from the contention" has
  evidence behind it.
  **What worked (reuse):** the failure with no error message. `lost_update.py`
  reports 12 of 200 and a clean exit code; nothing raises. A plausible wrong
  number teaches more fear than an exception, because the learner cannot rely
  on the program to tell them. Reuse this shape for any correctness defect.
  **What worked (reuse):** show the same defect twice in two vocabularies.
  Step 3 loses 188 increments in raw SQL. Step 10 loses 173 with
  `bookmark.visit_count += 1`. The ORM section then reads as recognition of a
  named defect, not as new material — the ORM does not remove the problem, it
  hides the `SELECT` and the `UPDATE` that cause it.
  **Hazard:** a psql session left `idle in transaction` while it held a
  `FOR UPDATE` lock blocked every writer to bookmark 1 and hung a 300-request
  load test for the full timeout. Diagnose with `pg_stat_activity`
  (`wait_event_type = 'Lock'`), then `pg_terminate_backend(pid)`. Written up in
  `HANDOFF.md`.

- **Session 7 (2026-08-10):** Shipped Lesson 0007 (deployment — twelve-factor
  config, one image with no secret, a release step, a real health check, a
  named volume, Docker Compose as the local rehearsal, a managed database, and
  a Render Blueprint). Code in `Code/Lesson_7_code/` (`config.py`,
  `main.py` with `/healthz`, `migrate.py`, `migrations/0001`–`0004`,
  `Dockerfile`, `.dockerignore`, `compose.yaml`, `.env.example`,
  `render.yaml`, `README.md`, and `naive/` for the failures). Glossary +4
  (config, container image, health check, release step); RESOURCES gained a
  "Deployment & platforms" section with seven entries, fetched and verified
  2026-08-10. Everything ran with Docker 29.7.2, PostgreSQL 17,
  uvicorn 0.52.1, FastAPI 0.141.1, psycopg 3.3.4, pydantic-settings 2.14.2;
  every transcript in the lesson is real output. `render.yaml` validates
  against `https://render.com/schema/render.yaml.json` with zero errors.
  **The CV artifact is the README**, not the URL. It carries the Lesson 5 and
  Lesson 6 measurements, so the deploy inherits four years of evidence from two
  lessons.
  **What worked (reuse):** `naive/` — a second, deliberately wrong Dockerfile
  kept in the repository. Four defects in seven lines, each one demonstrated
  before it is named. The best of the four is the bind failure: the container
  logs `Application startup complete`, the same request succeeds from inside
  the container, and every request from outside resets. A failure that looks
  like a network problem and is not one.
  **What worked (reuse):** prove the destructive command instead of warning
  about it. `docker compose down`, read the row back, then `docker compose down
  -v`, read `[]`. The volume rule lands in two commands.
  **Method note:** the free-tier limits are lesson content, not footnotes.
  Render's `preDeployCommand` needs a paid plan, so the correct design and the
  free workaround differ. The lesson states both and tells the learner to say
  so in an interview. Pretending the free plan is production would have taught
  the wrong thing.
  **Hazard:** `--reload` in an image gives three processes and a reloader as
  PID 1, watching files that never change. Verified through `/proc`, 66.45 MiB
  resident for one application.

  **Outcome:** the learner did not deploy. Render asks for a credit card, even
  on the free plan. `Code/Lesson_7_code/README.md` now states that the service
  is container-ready and proved with Docker Compose, and that the cloud deploy
  is skipped. Do not ask for a URL again.

- **Session 8 (2026-08-10):** Shipped Lesson 0008 (authentication — password
  hashing, sessions, JWTs, and the two questions 401 and 403). **First
  dual-language lesson.** One HTML file teaches Python and TypeScript side by
  side; there is no `lessons/js/0008`. Code in `Code/Lesson_8_code/`
  (`config.py`, `security.py`, `main.py`, `hash_speed.py`, `forge_token.py`,
  `event_loop_block.py`, migrations 0005–0007, `wordlist.txt`) and
  `Code/js/Lesson_8_code/` (`src/config.ts`, `src/security.ts`,
  `src/server.ts`, `src/migrate.ts`, and the three twin demos). Also created
  `lesson_plan.md`. Glossary +5 (authentication, authorisation, JSON Web
  Token, salt, session); RESOURCES gained an "Authentication & TypeScript"
  section with nine entries, fetched and verified 2026-08-10. Everything ran
  against PostgreSQL 17.10 (Docker), Python 3.12 with bcrypt 5.0.0 and
  PyJWT 2.13.0, and Node 24.19 with bcrypt 6, express 4.21, zod 4, and
  TypeScript 5.9. `npx tsc --noEmit` passes.
  **Format call:** Node 22.6+ runs `.ts` files directly, so the TypeScript
  project has no build step and no bundler. `npm run typecheck` is the only
  thing that checks types, and practice step 8 makes the learner prove it.
  **What worked (reuse):** three observable failures, each measured.
  (a) The SHA-256 table falls to a 64-word list in 0.03 ms; bcrypt costs the
  same attacker 27.3 s and *still loses all five accounts*. The second half of
  that sentence is the part that teaches. (b) `forge_token.py` edits an
  unsigned token and the server hands over an administrator. (c) Ten
  concurrent logins push `/healthz` from 3.5 ms to 1727.8 ms in Python and
  1192.8 ms in TypeScript — Lesson 5's measurement discipline applied to CPU
  instead of I/O.
  **What worked (reuse):** the logout table. `cookie after logout: 401`,
  `token after logout: 200`. Five lines end an argument that usually takes a
  blog post.
  **What worked (reuse):** the deliberately wrong route kept in the tree, from
  Lesson 7's `naive/`. `/auth/login-leaky` and `/auth/login-blocking` exist to
  be measured and then deleted, and practice steps 4 and 5 delete them.
  **Cross-language finding worth keeping:** the hand-written HMAC token and
  the library token are byte-identical in *both* languages. That kills the
  "the library does something magic" belief in one line of output.
  **Hazard:** `node-postgres` returns `bigint` as a string, so
  `bookmarks.id` arrives as `"200002"` in TypeScript and `200001` in Python,
  while `users.id` (an `integer`) arrives as a number in both. It is in the
  lesson as a sidenote. Expect it to bite in Lesson 9's tests.
  **Open:** ask whether two languages in one page helped or crowded it. The
  split into two files is still available and cheap.

## Curriculum spine (working plan, revise freely)

`lesson_plan.md` now holds the order of the course, and it is the file to
update first. This list is the short version. `ROADMAP.md` is a scope
checklist, not an order.

1. ~~HTTP from the socket up~~ ✓
2. ~~A server without a framework~~ ✓
3. ~~FastAPI~~ ✓
4. ~~Relational modelling + SQL~~ ✓
5. ~~Why is this slow? (indexes, EXPLAIN, N+1)~~ ✓
6. ~~Concurrency + the ORM: isolation levels, lost updates, `SELECT … FOR
   UPDATE`, then SQLAlchemy 2.x over the same schema with `echo=True`~~ ✓
7. ~~Deployment: twelve-factor config, Docker, a managed database, a release
   step, a health check, and the CV README~~ ✓
8. ~~Authentication: password hashing, sessions against JWTs, 401 against
   403 — the first lesson in Python **and** TypeScript~~ ✓
9. Testing + CI: pytest with httpx, vitest with supertest, a real PostgreSQL
   container, then GitHub Actions. Test the auth routes first
10. Caching, then observability, then scaling (all in both languages)

## Open threads

- **Language decision resolved.** Both languages, one lesson. From Lesson 8
  each page teaches Python and then TypeScript. `lessons/js/` stays as the
  condensed port of Lessons 1 to 7, and it gains no new files.
- **Deployment closed.** Render asks for a credit card, so the learner skipped
  the cloud deploy. Docker Compose is the accepted proof. Do not ask for a URL.
- `GLOSSARY.md` now has twenty-six terms. Next candidates: dependency injection,
  middleware, loader strategy, twelve-factor process model.
- **Roadmap checkboxes are the learner's, not ours.** No session has ticked any,
  so none are ticked. Do not start.
- **Terms are promoted at lesson time in this workspace**, before the learner has
  demonstrated them. That is a deviation from `GLOSSARY-FORMAT.md`, kept because
  lessons link into the glossary. Check usage next session and revise any entry
  that did not land.
- Not yet asked: location / whether they want an in-person or local community.
- **Reminder delivered in Lesson 4:** the `reference-pdfs/HTTP_Messages_Reference.pdf`
  nudge is in the lesson's opening note. Ask next session whether they read it.
- Learner's own `bookmarks-api/main.py` still has the in-memory store and a
  latent bug (`async def bookmark(request, bookmark_id: int)` — `request` is
  untyped, and the path parameter is `{id}` while the argument is `bookmark_id`).
  Lesson 4's `Code/Lesson_4_code/main.py` is the corrected, DB-backed version.
  Worth walking through the diff with them rather than silently overwriting it.
