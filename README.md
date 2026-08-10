# Backend, from a socket to a deploy

Eight lessons that build one JSON API. Lesson 1 starts with `socket.accept()`
and a hand-written HTTP response. Lesson 7 ends with a container that reads
its configuration from the environment, runs its own migrations, and answers
a health check. Lesson 8 adds accounts, and it teaches Python and TypeScript
side by side.

Each lesson states one idea, shows the failure that motivates it, and ends in
something a reviewer can open. The numbers in this repository are real output
from real runs, not estimates.

The deployable service is [`Code/Lesson_7_code/`](./Code/Lesson_7_code/). Its
[README](./Code/Lesson_7_code/README.md) holds the stack, the endpoints, and the
measurements. The order of the course is
[`lesson_plan.md`](./lesson_plan.md).

## The lessons

Open the HTML files in a browser. Each one carries its own retrieval quiz.

| # | Lesson | The one idea | Code |
| --- | --- | --- | --- |
| 1 | [A server is bytes on a socket](./lessons/0001-a-server-is-bytes-on-a-socket.html) | A server accepts a TCP connection, reads text, and writes text back in an agreed shape. | [`Code/Lesson_1_code/`](./Code/Lesson_1_code/) |
| 2 | [A server without a framework](./lessons/0002-a-server-without-a-framework.html) | A framework is a calling convention between a server program and your code. You can write it yourself. | [`Code/Lesson_2_code/`](./Code/Lesson_2_code/) |
| 3 | [FastAPI](./lessons/0003-fastapi.html) | FastAPI turns type annotations into routing, validation, errors, and OpenAPI. | [`bookmarks-api/`](./bookmarks-api/) |
| 4 | [Relational modelling + SQL](./lessons/0004-relational-modelling-and-sql.html) | A schema is a set of rules the data must not break. Keys and constraints make the illegal states impossible. | [`Code/Lesson_4_code/`](./Code/Lesson_4_code/) |
| 5 | [Why is this slow?](./lessons/0005-why-is-this-slow.html) | Ask the database what it did, and read the answer. | [`Code/Lesson_5_code/`](./Code/Lesson_5_code/) |
| 6 | [Concurrency and the ORM](./lessons/0006-concurrency-and-the-orm.html) | A transaction protects you from a crash. It does not protect you from another transaction. | [`Code/Lesson_6_code/`](./Code/Lesson_6_code/) |
| 7 | [Deployment](./lessons/0007-deployment.html) | A deploy is one image plus one set of environment variables. | [`Code/Lesson_7_code/`](./Code/Lesson_7_code/) |
| 8 | [Authentication](./lessons/0008-authentication.html) | The server must never trust the client. It must only trust what it can verify. | [`Code/Lesson_8_code/`](./Code/Lesson_8_code/) · [`Code/js/Lesson_8_code/`](./Code/js/Lesson_8_code/) |

## What the repository demonstrates

Three measurements carry most of the weight. Each one comes from a script in
this repository, and you can repeat it.

**An index is not a switch you flip.** A prefix search over 200 000 rows,
measured with `EXPLAIN (ANALYZE, BUFFERS)`.

| Plan | Execution time |
| --- | --- |
| Sequential scan | 11.810 ms |
| B-tree with `text_pattern_ops` | 0.128 ms |

A plain B-tree on `title` does not serve `LIKE 'Article number 1370%'`, because
the default operator class sorts by collation. The `text_pattern_ops` class
sorts byte by byte.

**N+1 hides on a laptop.** One request that reads the tags per row, against one
request that joins. `Code/Lesson_5_code/slow_link.py` adds one millisecond in
each direction.

| Link | Slowdown of N+1 over the join |
| --- | --- |
| Loopback | 7× |
| Plus 1 ms each way | 51× |

The code did not change between the two rows. Only the distance changed.

**A lost update raises nothing.** 200 concurrent increments of one counter,
four strategies, from `Code/Lesson_6_code/lost_update.py`.

| Strategy | Result | Wall time |
| --- | --- | --- |
| `SELECT` then `UPDATE` | 12 of 200 survived | — |
| One `UPDATE … SET n = n + 1` | 200 of 200 | 178.3 ms |
| `SELECT … FOR UPDATE` | 200 of 200 | 247.9 ms |
| `REPEATABLE READ` with retry | 200 of 200, 1411 retries | 772.3 ms |

The two-statement version exited zero and returned a plausible wrong number.

**A password hash is a price list.** One core, bcrypt at cost 12, from
`Code/Lesson_8_code/hash_speed.py`.

| Function | Guesses per second | Eight lower-case letters |
| --- | --- | --- |
| SHA-256 | 6,006,030 | 9.7 hours |
| bcrypt, cost 12 | 6 | 1,087 years |

The same word list broke the SHA-256 table in 0.03 ms and the bcrypt table in
27.3 s. A slow hash buys time. It does not repair a weak password.

## Two languages

Lessons 1 to 7 are Python with FastAPI. `lessons/js/` and `Code/js/`
hold a condensed port of those seven lessons to Node.js and Express.

From Lesson 8, one lesson teaches both languages. Each idea appears once,
then in Python, then in TypeScript.
[LR-0001](./learning-records/0001-language-anchor-python-first.md) records why
the anchor was Python.
[LR-0002](./learning-records/0002-dual-language-curriculum.md) records why both
run together now.

## Run it

Lessons 1 and 2 use the standard library only:

```shell
python Code/Lesson_1_code/server.py
curl -v localhost:8080/
```

Lessons 3 to 8 need FastAPI:

```shell
python -m venv .venv && . .venv/bin/activate
pip install -r Code/Lesson_8_code/requirements.txt
```

Lessons 4 to 8 need PostgreSQL. Do not use SQLite: the types, the constraints,
and the concurrency behaviour all differ.

```shell
docker run -d --name pg-bookmarks \
    -e POSTGRES_USER=learner \
    -e POSTGRES_PASSWORD=lesson4 \
    -e POSTGRES_DB=bookmarks \
    -p 55432:5432 \
    postgres:17

export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
python Code/Lesson_8_code/migrate.py
```

The full service runs on one machine with Docker Compose. See
[`Code/Lesson_7_code/README.md`](./Code/Lesson_7_code/README.md).

Each JavaScript and TypeScript lesson directory carries its own
`package.json`. Run `npm install` inside the directory you want. The Lesson 8
TypeScript project needs Node 22.6 or later, because Node runs the `.ts`
files directly.

## Layout

```
lessons/            the eight lessons, plus lessons/js/ for the Node.js port
reference/          reference cards: HTTP anatomy, reading a query plan
reference-pdfs/     specifications kept for offline reading
summaries/          consolidated recall material
Code/               the code for each Python lesson, plus Code/js/
bookmarks-api/      the Lesson 3 in-memory API
assets/             the shared dark stylesheet and the quiz engine
MISSION.md          why this exists and what success looks like
ROADMAP.md          the topic checklist, ticked by the learner
lesson_plan.md      the order of the course, and what each lesson proves
GLOSSARY.md         terms, each tied to the lesson that established it
RESOURCES.md        verified links, with a staleness date
learning-records/   decisions and the evidence behind them
```

## Conventions

Two rules hold across the repository, and
[`AGENTS.md`](./AGENTS.md) states them in full.

1. **Every page is dark.** The theme comes from the `:root` tokens in
   `assets/course.css`. No lesson sets its own colours.
2. **The prose follows ASD-STE100 Simplified Technical English.** One meaning
   for each word, active voice, simple tenses, short sentences. The rule covers
   the prose. It does not cover code, SQL, or terminal output.
