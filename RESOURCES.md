# Backend Development Resources

Every URL here was fetched and verified on **2026-08-01**. Staleness is judged against a
~2-year horizon — but note that an old RFC is not a stale RFC, so specs are flagged
separately.

Scope skeleton: [`ROADMAP.md`](./ROADMAP.md) — local scope checklist. **Use it for scope only, never as a source of truth.**

---

## Knowledge

### HTTP & networking

- [MDN — Overview of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
  Client/server model, statelessness, proxies, connection reuse. The teaching spine for HTTP; living document.
- [MDN — HTTP messages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Messages)
  Byte-level anatomy: start-line, headers, blank line, body. Use for: the moment you hand-write bytes into a socket.
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
  June 2022, STD 97. Obsoletes RFC 7230–7235. Methods §9, status codes §15, conditionals §13. Use for: settling a dispute ("is PUT idempotent?"), never as reading homework.
- [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/html/)
  v3.3.2, April 2026. C-flavoured, but the canonical explanation of `socket()/bind()/listen()/accept()`. Use for: understanding what Python's `socket` module wraps.
- [High Performance Browser Networking, ch.2 — Grigorik](https://hpbn.co/building-blocks-of-tcp/)
  Handshake, congestion control, slow start, latency vs bandwidth. Use for: "why is my API slow?" ⚠️ 2013 edition — accurate on TCP/TLS, predates HTTP/3 and QUIC.
- [Julia Evans — How to use undocumented web APIs](https://jvns.ca/blog/2022/03/10/how-to-use-undocumented-web-apis/)
  Devtools → Copy as cURL → port to Python. Use for: making "a browser is just an HTTP client" click. Her long-form zines are **paid**; only the [comics](https://wizardzines.com/comics/) are free.

### Python servers

- [Socket Programming HOWTO](https://docs.python.org/3/howto/sockets.html)
  The accept loop, and the hard part: `send`/`recv` handle *partial* buffers, so messages must be delimited or length-prefixed. Use for: building a server from scratch.
- [`http.server` reference](https://docs.python.org/3/library/http.server.html)
  `BaseHTTPRequestHandler`, `do_GET`, `send_response`. Carries an explicit "not recommended for production" warning — that warning is itself a lesson.
- [PEP 3333 — WSGI](https://peps.python.org/pep-3333/)
  The `application(environ, start_response)` contract. Use for: explaining what Flask and Django actually *are*. Final since 2010; normative, not stale.
- [ASGI Specification v3.0](https://asgi.readthedocs.io/en/latest/specs/main.html)
  `application(scope, receive, send)`. Use for: what uvicorn speaks to FastAPI. Spec unchanged since 2019 — current, not abandoned.
- [FastAPI — Tutorial: User Guide](https://fastapi.tiangolo.com/tutorial/)
  **Primary framework for this mission.** Every code block is a tested file.
- [Pydantic — documentation](https://docs.pydantic.dev/latest/)
  v2.13.4, verified 2026-08-02. `BaseModel`, field types, validation errors, JSON Schema emission. Use for: understanding *why* FastAPI rejects a request body the way it does. Core validation is Rust; the error objects (`type`, `loc`, `msg`, `input`) are what surface as FastAPI's 422 payload.
- [Django — first app, part 1](https://docs.djangoproject.com/en/stable/intro/tutorial01/)
  Django 6.0. Use for: when a job ad names Django — which a meaningful share still do.
- [Flask — Flaskr tutorial](https://flask.palletsprojects.com/en/stable/tutorial/)
  Smallest complete request → DB → HTML loop, in 11 chapters.

### Databases & APIs

- [PostgreSQL Tutorial (Part I)](https://www.postgresql.org/docs/current/tutorial.html)
  Official hands-on intro. Default database for this mission. Always link `/docs/current/`.
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  Verified 2026-08-03. `CHECK`, `NOT NULL`, `UNIQUE`, primary/foreign keys, every `ON DELETE` action. Use for: deciding what the database should refuse, rather than checking it in Python.
- [psycopg 3 — documentation](https://www.psycopg.org/psycopg3/docs/)
  v3.3.4, verified 2026-08-03. The PostgreSQL driver this curriculum uses. "Basic module usage" and "Passing parameters to SQL queries" are the two pages that matter; the latter is the authoritative statement of why `%s` is *not* string formatting.
- [Alembic — Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
  Verified 2026-08-03. SQLAlchemy's migration tool and the Python default. Read after writing a migration runner by hand (Lesson 4) — revision/head/upgrade then map onto something already understood.
- [PostgreSQL Exercises](https://pgexercises.com/)
  Graded drills: select → joins → aggregates → window → recursive, each with an explanation. Use for: deliberate practice between lessons.
- [Select Star SQL](https://selectstarsql.com/)
  Free interactive book building a *mental model* of querying. Use for: when you can write SQL but can't reason about it.
- [Use The Index, Luke! — Markus Winand](https://use-the-index-luke.com/sql/table-of-contents)
  © 2010–2026, maintained. B-tree anatomy, concatenated indexes, the ORM N+1 problem, EXPLAIN per engine. **Link the TOC — the bare root serves an RSS feed to non-browser clients.**
- [PostgreSQL — Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
  Verified 2026-08-09 (`current` served the v18 page; behaviour checked against PostgreSQL 17.10). §14.1. The reference for cost units, nested plan nodes, and what `BUFFERS` reports. Use for: Lesson 5, and every time a plan surprises you. Note `ANALYZE` implicitly enables `BUFFERS` from v18 — pass it explicitly and it works on both.
- [PostgreSQL — Operator Classes and Operator Families](https://www.postgresql.org/docs/current/indexes-opclass.html)
  Verified 2026-08-09. §11.10. Short, and the authority on why a default text index cannot serve `LIKE 'abc%'` outside the C locale, and what `text_pattern_ops` changes. Use for: the argument that ends "but there *is* an index on that column".
- [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  Verified 2026-08-10 (`current` served the v18 page; behaviour checked against PostgreSQL 17.10, where the section number is the same). §13.2. The authority on what one transaction sees of another: the four standard levels, the four anomalies, and why `READ COMMITTED` takes a snapshot per *query* rather than per transaction. Use for: Lesson 6, and any argument about `REPEATABLE READ` retries.
- [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  Verified 2026-08-10. §13.3. Row-level lock modes (§13.3.2) and which pairs conflict; deadlocks and the rule that prevents them (§13.3.4) — always take locks in the same order. Use for: deciding whether a write needs `SELECT … FOR UPDATE`.
- [SQLAlchemy — ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
  v2.0.51 (released 15 Jun 2026), verified 2026-08-10. The shortest complete tour of `DeclarativeBase`, `mapped_column`, `relationship`, and `Session`. **Skip its `create_all()` step** — in this curriculum the migrations own the schema.
- [SQLAlchemy — Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)
  v2.0.51, verified 2026-08-10. Why an ORM produces N+1 by default and how to stop it: `lazy` (the default), `selectinload`, `joinedload`, and `raiseload` to turn an accidental lazy load into an exception. Read "Summary of Relationship Loading Styles" and "What Kind of Loading to Use?".
- [CMU 15-445 Intro to Database Systems](https://15445.courses.cs.cmu.edu/)
  Pavlo & Patel, Spring 2026, free lectures. Use for: "but how does the database *do* that?"
- [OpenAPI Specification v3.2.0](https://spec.openapis.org/oas/latest.html)
  19 Sep 2025. Use for: understanding what FastAPI's `/docs` actually generates.

### Deployment & platforms

- [The Twelve-Factor App](https://12factor.net/)
  Verified 2026-08-10. Twelve short pages; four carry this curriculum — [III. Config](https://12factor.net/config), [V. Build, release, run](https://12factor.net/build-release-run), [VI. Processes](https://12factor.net/processes), [XI. Logs](https://12factor.net/logs). Factor III's litmus test is the one to memorise: could this repository go public today without leaking a credential? ⚠️ Written 2011 for Heroku; the vocabulary is dated in places, the rules are not.
- [Render — Blueprint YAML Reference](https://render.com/docs/blueprint-spec)
  Verified 2026-08-10. The declarative deploy for Lesson 7: services, `databases`, `envVars`, `preDeployCommand`, `healthCheckPath`. The four ways to set a variable (literal, `generateValue`, `sync: false`, `fromDatabase`) cover nearly every real case. Schema at `https://render.com/schema/render.yaml.json`, served from SchemaStore, so an editor validates it as you type. **Every Render docs page also serves a clean `.md` version — append `.md` to the URL.**
- [Render — Deploying on Render](https://render.com/docs/deploys)
  Verified 2026-08-10. Build → pre-deploy → start, with the timeout for each. The pre-deploy command needs a paid instance type; a free instance has no separate release step. Also covers zero-downtime deploys and rollbacks.
- [Render — Health Checks](https://render.com/docs/health-checks)
  Verified 2026-08-10. Short and complete: `2xx`/`3xx` within five seconds is healthy, a new deploy waits up to 15 minutes for every instance to pass, and 60 seconds of consecutive failures restarts a running instance.
- [Render — Deploy for Free](https://render.com/docs/free)
  Verified 2026-08-10. Read before promising anyone a permanent demo: a free web service spins down after 15 minutes of no traffic and takes about a minute to return, 750 free instance hours per month, and a free Postgres database expires 30 days after creation with a 14-day grace period and no backups.
- [Docker — Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
  Verified 2026-08-10. A lookup, not reading. Two entries repay a slow read: `CMD` (exec form against shell form, and why `${PORT}` does not expand in the exec form) and `ENTRYPOINT`.
- [Uvicorn — Settings](https://github.com/Kludex/uvicorn/blob/master/docs/settings.md)
  v0.52.1, verified 2026-08-10 from the repository source; `uvicorn.org` did not resolve from this machine on that date. The authority on `--host`, `--port`, `--proxy-headers` (enabled by default), and `--forwarded-allow-ips` (defaults to `127.0.0.1`; the literal `'*'` trusts everything).

### Architecture

- [Kleppmann — Distributed Systems notes (Cambridge)](https://www.cl.cam.ac.uk/teaching/2526/ConcDisSys/dist-sys-notes.pdf)
  Michaelmas 2025/26, CC BY-SA, ~90pp. Clocks, causality, replication, quorums, 2PC, Raft. The best legitimately free rigorous text by the DDIA author.
- [Designing Data-Intensive Applications — Kleppmann](https://dataintensive.net/)
  🔒 **Paywalled, no legal free copy.** Still the reference for replication and consistency trade-offs. Budget for buying it around month 4 — there is no free equivalent, and pretending otherwise wastes time.
- [The Architecture of Open Source Applications](https://aosabook.org/en/)
  CC BY. *500 Lines or Less* ch.22 "A Simple Web Server"; Vol 2 ch.14 nginx, ch.20 SQLAlchemy. ⚠️ 2011–2016 — the tooling is stale, the architectural reasoning holds.

### Job-market evidence

- [Stack Overflow Developer Survey 2025](https://survey.stackoverflow.co/2025/technology)
  Use the **professional-developer** chart cuts, not the headline numbers — the two disagree in a way that matters. See [LR-0001](./learning-records/0001-language-anchor-python-first.md).
- [DevJobsScanner — most demanded languages](https://www.devjobsscanner.com/blog/top-8-most-demanded-programming-languages/)
  Jun 2026, ~3M postings. The only true *postings* source found. Read its methodology: classification is title-only, so the JS/TS bucket is contaminated with frontend roles and the Python bucket omits FastAPI.
- [Python Developers Survey 2024 (PSF + JetBrains)](https://lp.jetbrains.com/python-developers-survey-2024/)
  FastAPI 38% > Django 35% > Flask 34%. Newest official edition — the 2025 one 404s. ⚠️ Fielded Oct–Nov 2024.

---

## Wisdom (Communities)

- [Python Discord](https://www.pythondiscord.com/)
  100+ vetted helpers, staffed channels, explicitly novice-friendly. Use for: stuck more than 30 minutes.
- [Discussions on Python.org — Help](https://discuss.python.org/c/help/7)
  PSF-run; core devs on the same instance. Slower, permanent, higher quality. Use for: design and "why" questions.
- [Code Review Stack Exchange](https://codereview.stackexchange.com/)
  **The single best place to test skill.** Post *working* code, get line-by-line critique. Use for: after every finished project — this is the closest thing to a free senior reviewer.
- [Exercism — Python track](https://exercism.org/tracks/python)
  146 exercises with free human mentoring on idiomatic style. Use for: converting "my Python works" into "my Python is idiomatic" — exactly what an interviewer probes.
- [FastAPI GitHub Discussions → Questions](https://github.com/fastapi/fastapi/discussions/categories/questions)
  Maintainer-answered, active. Use for: FastAPI-specific behaviour only.
- [Django Forum](https://forum.djangoproject.com/)
  Has a sanctioned **Mentorship** category and a **Show & Tell** for project feedback. Rare and valuable.
- [r/PostgreSQL](https://old.reddit.com/r/PostgreSQL/)
  Flair-enforced, practitioner-heavy, 17 years old. Use for: "is my schema sane?"
- [PostgreSQL community](https://www.postgresql.org/community/) / [Planet PostgreSQL](https://planet.postgresql.org/)
  Mailing lists expect a well-formed question. Planet is a good passive feed.
- [r/ExperiencedDevs](https://old.reddit.com/r/ExperiencedDevs/)
  Good judgement signal. **Rule: post only in the pinned weekly thread** — top-level beginner posts get removed. Skip the burnout thread.

### Avoid

- [r/cscareerquestions](https://old.reddit.com/r/cscareerquestions/)
  Front page checked 2026-08-01: layoff anxiety, AI doom, office-layout arguments. Near-zero technical signal and actively demoralising for someone mid-career-change. The daily mod-run Resume Advice Thread is the only useful artifact.
- Any "top N backend frameworks 2026" listicle. Content marketing.

---

## Gaps

- **No free HTTP/3 resource verified.** HPBN predates it. RFC 9114 exists but was not fetched, so it is not cited here.
- **No free, maintained, book-length backend-systems text of DDIA's calibre.** The Cambridge notes are rigorous but distributed-systems-shaped and assume mathematical comfort. Buy DDIA rather than pretending a substitute exists.
- **No canonical free "write an HTTP server in Python from scratch" text.** Substitute: Beej + Socket HOWTO + MDN HTTP messages + the AOSA *500 Lines* chapter.
- **No seniority breakdown** (junior vs senior) for Python vs Node/TS postings. The HackerRank 2025 report URL 404s. Treat "Node is easier to get hired into at junior level" as unsupported.
- **No measured Python-backend vs Python-ML posting split.** "Python demand is ML-concentrated" is an inference from three converging sources, not a measured fact.
- **No local, in-person community identified.** Not yet asked about location or preference.
