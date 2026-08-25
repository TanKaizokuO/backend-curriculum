# State

Cold-start briefing for a new chat. Read this first, then `LOG.md`, then
`MISSION.md`, then `NOTES.md`. This file is the *state of play*; `LOG.md` is
the append-only record of what each lesson covered and verified; `NOTES.md` is
the working scratchpad and `learning-records/` holds decisions that must not be
silently reversed.

Last updated: **2026-08-26** (end of Session 15, agent session — no learner reply captured this session; see Open threads).

---

## Your role

You are the teacher for this workspace. The learner is a fluent Python programmer who has
never built a server and is working toward a backend/full-stack job at ~14–15 hrs/week.
Lessons are self-contained dark-mode HTML files in `lessons/`, built on the shared assets.
From Lesson 8 each lesson teaches Python **and** TypeScript in one file.

Do not restate the mission back to the learner — they wrote it. Pick up and teach.

---

## Where things stand

| | |
| --- | --- |
| Sessions completed | 15 |
| Lessons shipped | `0001-a-server-is-bytes-on-a-socket.html`, `0002-a-server-without-a-framework.html`, `0003-fastapi.html`, `0004-relational-modelling-and-sql.html`, `0005-why-is-this-slow.html`, `0006-concurrency-and-the-orm.html`, `0007-deployment.html`, `0008-authentication.html`, `0009-testing-and-ci.html`, `0010-caching.html`, `0011-observability.html`, `0012-scaling.html`, `0013-version-control.html`, `0014-how-a-request-finds-your-server.html`, `0015-the-edge-reverse-proxy-and-tls.html` (Python + TypeScript from Lesson 8 on; Lesson 13's TypeScript twin repeats only the merge conflict) |
| Course order | `lesson_plan.md` — the order, the one idea of each lesson, and what each one proved. Update it first when the plan changes. |
| Reference docs | `reference/http-message-anatomy.html`, `reference/reading-a-query-plan.html` |
| Reference PDFs | `reference-pdfs/` — ASGI spec, RFC 9110 Methods, PEP 3333 key points, HTTP Messages Reference (`HTTP_Messages_Reference.pdf`) |
| Lesson code | `Code/Lesson_1_code/`, `Code/Lesson_2_code/`, `Code/Lesson_4_code/` (schema migrations, `migrate.py`, DB-backed `main.py`, injection demo), `Code/Lesson_5_code/` (`seed.sql`, migration 0003, `main.py` with search + a deliberate N+1 endpoint, `n_plus_1.py`, `slow_link.py`), `Code/Lesson_6_code/` (migration 0004, `lost_update.py`, `orm_models.py`, `orm_n_plus_1.py`, `orm_increment.py`, `main.py` with the visit counter), `Code/Lesson_7_code/` (the deployable project: `config.py`, `main.py` with `/healthz`, `migrate.py`, `migrations/0001`–`0004`, `Dockerfile`, `.dockerignore`, `compose.yaml`, `.env.example`, `render.yaml`, `README.md`, and `naive/` for the four failures), `Code/Lesson_8_code/` + `Code/js/Lesson_8_code/` (accounts, in both languag…
| Learning records | LR-0001 (language anchor: Python first), LR-0002 (both languages from Lesson 8) |
| Glossary | `GLOSSARY.md` — Lesson 11 added cardinality, counter, histogram, request id, span, structured log, trace; Lesson 12 added atomic, connection pool, load balancer, rate limiting, read replica, scaling; Lesson 13 added blob, branch, commit, force-push, merge conflict, rebase, reflog; Lesson 14 added authoritative server, CNAME, recursive resolver, root server, zone; Lesson 15 added reverse proxy, self-signed certificate, SNI, TLS termination, X-Forwarded-For |
| Next on the spine | **Lesson 16: rules the browser enforces**, in both languages. `lesson_plan.md`'s one idea: "CORS and CSP are instructions to the browser. They protect the user, not the server." No detailed spec written yet — see `## Next lesson: spec` below. |

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
5. **Both languages, from Lesson 8** (LR-0002). Python + FastAPI stays the anchor
   (LR-0001); TypeScript now rides beside it in the same file. Do not drop either, and do
   not split Lesson 8 into two pages without asking the learner first.
6. **Record decisions, not diary.** A new `learning-records/NNNN-*.md` only when a choice
   constrains future lessons and the evidence is non-obvious.
7. **`lessons/js/` is frozen.** It holds a condensed port of Lessons 1 to 7. Do not add
   Lesson 8 or later files to it. New TypeScript teaching goes in the main lesson page,
   and new TypeScript code goes in `Code/js/Lesson_N_code/`.
8. **All lesson prose follows ASD-STE100 Simplified Technical English** (`AGENTS.md`).
   One meaning for each word, one part of speech for each word, active voice, simple
   tenses, sentences of 20–25 words maximum, no -ing constructions, no idiom. This
   applies to lessons, reference cards, glossary entries, and summaries — not to code,
   SQL, or terminal output. Lessons 1–5 predate the rule; convert them when they are
   next edited. Lessons 6 through 11 follow it.
9. **Ignore `summaries/` directory.** The `summaries/` folder contains generated summaries for Lessons 1, 2, and 3. Future agents must totally ignore this directory.

---

## Open threads

- **Learner ran Lesson 1 code.** Confirmed: both `client.py` and `server.py`.
- **`GLOSSARY.md` updated.** Twenty-six terms total. New from Lesson 8: authentication,
  authorisation, JSON Web Token, salt, session. Note this workspace promotes terms at
  lesson time, before the learner has demonstrated them — check usage next session and
  revise anything that did not land.
- **Code-review venue.** Code Review Stack Exchange is now *raised* — it is named in
  Lesson 5's closing `.ask` block, alongside r/PostgreSQL for plan questions. Ask next
  session whether they posted, and offer to read the post before it goes up.
- **Location / in-person community** — never asked. `RESOURCES.md` lists it as a gap.
- **The language question is answered.** The learner asked for both. LR-0002 records it,
  and Lesson 8 is the first lesson in both. Ask once whether the two languages in one
  page helped or crowded it; a split into a Python half and a TypeScript half is cheap.
- **Bookmarks API** — the learner's `bookmarks-api/main.py` is still the in-memory
  version, and it has a latent bug: the path is `/bookmarks/{id}` while the handler takes
  `bookmark_id`, and `request` is unannotated. Walk them through migrating it to the
  Lesson 4 shape rather than handing over the finished file.
- **HTTP Messages PDF** — reminder delivered in Lesson 4's opening note; Session 5 did not
  get to ask (no learner reply in session). Still open — ask.
- **Learner has not replied in-session since Lesson 4, except on process.** Lessons 4 to
  8 were shipped without confirmation that the practice was done. Ask concretely before
  Lesson 9: did they run `hash_speed.py` and `event_loop_block.py`, and did they delete
  the two deliberately wrong routes?
- **No live URL, and that is settled.** Render asks for a credit card, so the learner
  skipped the cloud deploy. `Code/Lesson_7_code/README.md` says the service is
  container-ready and proved with Docker Compose. Do not ask again, and never invent
  a URL. A free platform that takes no card is worth one search if the learner raises it.
- **Docker note.** The `pg-bookmarks` container is now created with a named volume
  (`-v pg-bookmarks-data:/var/lib/postgresql/data`); the Lesson 4 `docker run` line has no
  volume, so a container recreation silently loses the data. Lesson 4's text was left
  as-is; mention the volume flag when it next comes up.
- **Lessons 9 and 10 shipped with no learner reply in session.** Sessions 9 and 10 were
  agent-run, working from `lesson_plan.md`'s existing spec and the pattern of Lessons 1–8,
  with no message from the learner confirming direction or reviewing the result. Ask
  concretely before Lesson 11: did they read `0009-testing-and-ci.html` and
  `0010-caching.html`, did they run the test suites and `cache_bench.py` /
  `cacheBench.ts` themselves, and does the two-language format still work for them at
  ten lessons in.
- **Redis is now a third piece of dev infrastructure.** Lesson 10 needs a running
  `redis-bookmarks` container (`docker run -d --name redis-bookmarks -p 6379:6379
  redis:7-alpine`) alongside `pg-bookmarks`. Mention this the first time Lesson 10 comes
  up in conversation, the same way the Lesson 4 Docker note does for Postgres.
- **`lesson_plan.md`'s "Now" section is gone.** Lessons ship straight into "Done" the
  session they are finished; there is no longer a separate table for "written but not
  reviewed." If the learner wants a review gate before a lesson counts as done, add one
  back and say so here.
- **Lesson 11 shipped with no learner reply in session.** Session 11 was agent-run, the
  same as Sessions 9 and 10. Ask concretely before Lesson 12: did they read
  `0011-observability.html`, did they run `diagnose.py` / `diagnose.ts` themselves and
  watch the server's own terminal while it ran, and does the "diagnose without opening
  the source" framing land as a useful discipline or as a gimmick.
- **Lesson 12 shipped with no learner reply in session.** Session 12 was agent-run, the
  same as Sessions 9–11. Ask concretely before Lesson 13: did they read
  `0012-scaling.html`, did they run the rate-limit and pool-backpressure benches
  themselves against two live instances, and does watching a limit silently double
  across instances land as a convincing argument for shared state.
- **Lesson 13 shipped with no learner reply in session.** Session 13 was agent-run, the
  same as Sessions 9–12. Ask concretely before Lesson 14: did they run
  `Code/Lesson_13_code/demo.sh`, did they cause and resolve a merge conflict of their
  own, and did they turn on branch protection on a real GitHub repository and see the
  force-push get rejected.
- **Lesson 14 shipped with no learner reply in session.** Session 14 was agent-run, the
  same as Sessions 9–13. Ask concretely before Lesson 15: did they run
  `Code/Lesson_14_code/demo.sh`, did they query a domain of their own and check its
  TTL, and did they run the Lesson 12 API by name with `caching_resolver.py` and
  `curl --resolve` rather than only against `127.0.0.1`.
- **Lesson 15 shipped with no learner reply in session.** Session 15 was agent-run, the
  same as Sessions 9–14. Ask concretely before Lesson 16: did they run
  `Code/Lesson_15_code/demo.sh`, did they inspect a real certificate with
  `openssl s_client` against a domain they own, and does terminating TLS by
  hand before naming Nginx land as useful or as unnecessary detail given the
  learner has no live URL to put a real edge in front of (see the
  no-live-URL thread above).

---

## Next lesson: spec

### Lesson 0016 — rules the browser enforces

No detailed spec written yet. From `lesson_plan.md`'s one idea: "CORS and CSP
are instructions to the browser. They protect the user, not the server." The
plan's detail: covers CORS, CSP, and cookies (sections 8 & 9) — same-origin
policy, preflight requests, `SameSite`, `HttpOnly`, `Secure`. Observable
failure: `http://localhost:5173` calls the API, the server logs `200`, and
the browser drops the response due to CORS policy. Write the full spec — the
observable failure to open with, the build order, and the sources to fetch —
at the start of the session that ships it.

### Carry-over rules

Lesson 15 put `tls_proxy.py` / `nginx.conf` in front of `origin.py`, a
stand-in for the Lesson 12 / 14 API, rather than extending that API's own
`main.py` — the proxy's job is identical regardless of which origin sits
behind it, and a stand-in keeps the demo free of a database dependency.
Lesson 16's CORS failure needs a real browser, not curl: `fetch()` enforces
the same-origin policy client-side, and curl does not. Plan a lightweight
static page served from one origin, calling the API on another, and confirm
the block happens in a real browser's console before writing the lesson.
Keep both languages in one page unless the learner asks for a split.
