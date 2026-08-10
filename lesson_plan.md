# Lesson Plan

This file is the order of the course. `ROADMAP.md` is a topic checklist and it
does not give an order. `MISSION.md` gives the goal. This file gives the
sequence, the one idea of each lesson, and the artifact that each lesson
leaves behind.

Lessons 1 to 7 use Python. From Lesson 8 every lesson teaches Python and
TypeScript together. [LR-0002](./learning-records/0002-dual-language-curriculum.md)
records that decision.

## How to read a row

Each lesson has four parts:

1. **One idea.** One sentence. The lesson defends it.
2. **The observable failure.** You break something first. You see the wrong
   output. Then the lesson names the rule.
3. **The artifact.** Code that runs, in `Code/`. A reviewer can open it.
4. **The quiz.** Retrieval practice at the end of the page. Answer before you
   scroll back.

Every number in a lesson is real output from a real run. No lesson quotes a
figure from memory.

## Done

| # | Lesson | The one idea | Code |
| --- | --- | --- | --- |
| 1 | ~~[A server is bytes on a socket](./lessons/0001-a-server-is-bytes-on-a-socket.html)~~ | A server accepts a TCP connection, reads text, and writes text back in an agreed shape. | [`Code/Lesson_1_code/`](./Code/Lesson_1_code/) |
| 2 | ~~[A server without a framework](./lessons/0002-a-server-without-a-framework.html)~~ | A framework is a calling convention between a server program and your code. | [`Code/Lesson_2_code/`](./Code/Lesson_2_code/) |
| 3 | ~~[FastAPI](./lessons/0003-fastapi.html)~~ | FastAPI turns type annotations into routing, validation, errors, and OpenAPI. | [`bookmarks-api/`](./bookmarks-api/) |
| 4 | ~~[Relational modelling and SQL](./lessons/0004-relational-modelling-and-sql.html)~~ | A schema is a set of rules that the data must not break. | [`Code/Lesson_4_code/`](./Code/Lesson_4_code/) |
| 5 | ~~[Why is this slow?](./lessons/0005-why-is-this-slow.html)~~ | Ask the database what it did, and read the answer. | [`Code/Lesson_5_code/`](./Code/Lesson_5_code/) |
| 6 | ~~[Concurrency and the ORM](./lessons/0006-concurrency-and-the-orm.html)~~ | A transaction protects you from a crash. It does not protect you from another transaction. | [`Code/Lesson_6_code/`](./Code/Lesson_6_code/) |
| 7 | ~~[Deployment](./lessons/0007-deployment.html)~~ | A deploy is one image plus one set of environment variables. | [`Code/Lesson_7_code/`](./Code/Lesson_7_code/) |

What each finished lesson proved:

- **1–2** The failure you can see: a response with no blank line makes `curl`
  report `Header without colon`. A response with no `Content-Length` makes the
  client wait forever.
- **3** The abstraction leaks: two decorators on one path give an incomplete
  `Allow` header on a `405`.
- **4** The wrong answer: `LIKE '%web%'` on a text column of tags returns
  `webassembly`. First normal form then costs one sentence.
- **5** The fix that does not work: a plain B-tree on `title` still gives a
  sequential scan for `LIKE 'Article number 1370%'`. The measurements:
  11.810 ms against 0.128 ms, and N+1 at 7× on loopback against 51× with 1 ms
  of latency each way.
- **6** The failure with no error message: 200 concurrent increments keep 12,
  and the program exits zero.
- **7** The deploy that looks like a network fault: the container logs
  `Application startup complete` and refuses every request from outside,
  because the process bound `127.0.0.1`.

## Now

| # | Lesson | The one idea | Code |
| --- | --- | --- | --- |
| 8 | [Authentication](./lessons/0008-authentication.html) | The server must never trust the client. It must only trust what it can verify. | [`Code/Lesson_8_code/`](./Code/Lesson_8_code/) (Python), [`Code/js/Lesson_8_code/`](./Code/js/Lesson_8_code/) (TypeScript) |

The lesson is written and the code runs. The learner has not worked through it
yet, so the row stays here and not in *Done*. Lesson 8 covers:

- Why a plain-text password column is a breach of every other site the user
  uses, and why a fast hash (SHA-256) is almost as bad.
- Password hashing with a slow function and a per-user salt: bcrypt or Argon2.
- The observable failure: a token that the client can edit. You change the
  payload of an unsigned token, and the server believes you.
- Sessions against JSON Web Tokens. What each one costs, and what each one
  cannot do.
- Logout, expiry, and revocation. A signed token is valid until it expires,
  and that is the whole problem.
- Protecting the bookmarks routes with a dependency (Python) and with
  middleware (TypeScript).

Its three observable failures: a SHA-256 table that falls in 0.03 ms; an
unsigned token that makes the attacker an administrator in three lines; and
ten logins that push an unrelated `/healthz` from 3.5 ms to 1727.8 ms.

## Next

| # | Lesson | The one idea | Planned code |
| --- | --- | --- | --- |
| 9 | Testing and CI | A test that cannot fail proves nothing. Test the contract, not the plumbing. | `Code/Lesson_9_code/`, `Code/js/Lesson_9_code/` |
| 10 | Caching | A cache is a copy that can be wrong. Name the moment it goes stale before you add it. | `Code/Lesson_10_code/`, `Code/js/Lesson_10_code/` |
| 11 | Observability | You cannot debug what you cannot see. A log line, a metric, and a trace answer different questions. | `Code/Lesson_11_code/`, `Code/js/Lesson_11_code/` |
| 12 | Scaling | Add a second instance and every assumption about local state breaks. | `Code/Lesson_12_code/`, `Code/js/Lesson_12_code/` |

Details for each planned lesson:

9. **Testing and CI.** `pytest` with `httpx` against `vitest` with
   `supertest`. A real PostgreSQL container for the integration tests, not a
   mock and not SQLite. Then GitHub Actions runs the suite and the migrations
   on each push.
10. **Caching.** HTTP caching first, because it is free: `ETag`,
    `Cache-Control`, and a `304`. Then Redis for the query that Lesson 5
    measured. The lesson measures the hit and the miss, and it shows a stale
    read.
11. **Observability.** Structured JSON logs with a request id, then
    `/metrics` with a counter and a histogram, then a trace across the API and
    the database.
12. **Scaling.** Two API instances behind one proxy. The lesson breaks
    in-memory state on purpose, then fixes it. Read replicas, connection
    limits, and backpressure.

## Rules that hold for every lesson

1. **Dark mode.** Every HTML page uses the tokens in `assets/course.css`.
2. **Simplified Technical English.** `AGENTS.md` states the rules. They cover
   the prose, not the code, the SQL, or the terminal output.
3. **Raw mechanism before the abstraction.** You write the mechanism by hand,
   then you use the library that hides it.
4. **Two languages, one idea.** From Lesson 8, each concept appears once, then
   in Python, then in TypeScript. The second version is recognition, not new
   material.
5. **PostgreSQL, not SQLite.** The types, the constraints, and the
   concurrency behaviour all differ.
