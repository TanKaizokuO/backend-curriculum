# Glossary

Terms promoted here once the learner demonstrates correct usage. Not a
dictionary — each entry records the lesson where the term was established and
the precise sense that matters for this curriculum.

---

## A

**Atomicity** (Lesson 4) — The *A* in ACID: a transaction either applies
completely or not at all. Demonstrated concretely — a successful `INSERT`
followed by a failing one makes PostgreSQL answer the subsequent `COMMIT` with
`ROLLBACK`, and the first row never existed. This is why every multi-statement
write in an API belongs inside one transaction.

## C

**Config** (Lesson 7) — Everything that varies between deploys: connection
strings, credentials, and per-deploy values such as the canonical hostname.
The twelve-factor rule (factor III) is *strict separation of config from
code*, and the litmus test is one question — could you open source this
repository today without leaking a credential? Config lives in environment
variables, never in a constant, a committed file, or an `ENV` line in a
`Dockerfile`. In this curriculum one `pydantic-settings` class holds the whole
contract, so a missing or malformed value stops the process at import with the
name of the variable in the message.

**Container image** (Lesson 7) — A stack of read-only layers plus the metadata
that says which command to run. One image serves every deploy; only the
environment differs. Two consequences follow. Each layer is permanent, so a
secret written in one layer stays readable through `docker image history` even
after a later layer removes it. And layers are cached in order, so a
`Dockerfile` copies `requirements.txt` and installs before it copies the
source, otherwise every code edit reinstalls every dependency.

## F

**Framing** (Lesson 1) — The mechanism by which an HTTP recipient knows where
a message body ends. The three legal framing strategies for HTTP/1.1 are:
`Content-Length`, chunked transfer encoding, and closing the connection. Missing
all three causes the client to hang — the defining symptom of a framing bug.

## H

**Health check** (Lesson 7) — A request that a platform sends to a service
every few seconds, to decide two things: whether a new deploy may take traffic,
and whether a running instance needs a restart. A useful endpoint touches the
dependency that actually breaks — `SELECT 1` on the connection pool — and
answers `503` when it fails, so an instance that cannot reach its database
never receives a request. Keep it cheap; it runs forever. Render treats any
`2xx` or `3xx` within five seconds as healthy.

## I

**Index** (Lesson 5) — A second structure, maintained by the database, holding
one or more columns in sorted order so that rows can be found without reading
the whole table. `PRIMARY KEY` and `UNIQUE` create one implicitly; `REFERENCES`
does not. A B-tree index serves a query only on its *leftmost* columns, in
order, and only for operators its operator class supports — a default text index
cannot serve `LIKE 'abc%'` outside the C locale. Every index taxes every write:
measured at 200 000 rows, three extra indexes made the same load six times
slower. Add one for a measured slow query, never in advance.

**Idempotent** (Lesson 1, reference card) — A request method is idempotent if
making the same request multiple times has the same effect as making it once.
GET, PUT, DELETE, and HEAD are idempotent. POST is not. RFC 9110 §9.2.2.

**Isolation level** (Lesson 6) — The setting that decides what one transaction
sees of other transactions that run at the same time. PostgreSQL implements
three distinct levels: `READ COMMITTED` (the default), `REPEATABLE READ`, and
`SERIALIZABLE`. At `READ COMMITTED` a snapshot covers *one query*, not one
transaction, so the same `SELECT` can return two answers inside one
transaction — a *non-repeatable read*. `REPEATABLE READ` takes one snapshot at
the transaction's first statement and answers a conflicting write with
`ERROR: could not serialize access due to concurrent update`, which the
application must catch and retry. No level in PostgreSQL permits a dirty read.

## J

**Junction table** (Lesson 4) — The table that represents a many-to-many
relationship, holding one row per pair with a foreign key to each side and a
composite primary key over both: `bookmark_tags (bookmark_id, tag_id)`. It has
no surrogate `id` because the pair *is* its identity. Also called a join, link,
or association table.

## L

**Lost update** (Lesson 6) — Two transactions read the same row, each computes
a new value in application code, and each writes it back. The second write
overwrites the first, so one update disappears. No error is raised, because
neither transaction broke a rule: the defect is the *shape* of the code — a
read, a decision in Python, then a write. Measured at 20 threads and 200
increments, 188 of the updates were lost. Three fixes, in order of preference:
one statement (`SET n = n + 1`), a row lock (`SELECT … FOR UPDATE`), or
*optimistic locking* (`REPEATABLE READ` plus a retry loop, which only pays when
conflicts are rare).

## M

**Migration** (Lesson 4) — A versioned, ordered, applied-once change to the
database schema, checked into git beside the code that needs it. A runner
records applied versions in a `schema_migrations` table so re-running is a
no-op — the same *idempotence* property as an HTTP `PUT`. Never edit a
migration that has already run anywhere but your laptop; write a new one.

## N

**N+1 problem** (Lesson 5) — Issuing one query to fetch N rows, then one further
query per row: 1 + N queries where 1 would do. Every individual query is fast,
so no single `EXPLAIN` reveals it — the cost is round trips, not query work.
It therefore looks mild on localhost (~40 µs per round trip) and severe in
production (~1 ms): the same code measured 7× slower locally and 51× slower
across a 1 ms link. The fix is a join, never an index. The diagnostic shape
to recognise is *a query inside a loop over rows*.

## O

**OpenAPI schema** (Lesson 3) — A machine-readable JSON description of an API:
its paths, methods, parameters, request/response body shapes, and status codes.
FastAPI generates one automatically at `/openapi.json` from your decorators,
function signatures, and Pydantic models, then renders it as the interactive
`/docs` page via Swagger UI. The code *is* the documentation — there is no
separate spec file to drift out of sync.

**ORM** (Lesson 6) — Object-relational mapper: a library that maps table rows
onto Python objects, of which SQLAlchemy is the Python standard. It buys an
identity map, a unit of work that batches writes into one transaction,
relationship navigation, and Alembic migrations. It hides exactly one thing —
cost. `bookmark.tags` is an attribute access that emits a `SELECT`, so the
default *lazy* loader strategy reproduces the N+1 problem (101 queries for a
page of 100; `selectinload` gives 2, `joinedload` gives 1). `bookmark.count +=
1` is a read-modify-write, so it loses updates. The defence is `echo=True` and
the habit of counting statements — never avoidance of the ORM.

## P

**Path operation** (Lesson 3) — FastAPI's name for the pairing of an HTTP method
and a path, bound to a handler function by a decorator: `@app.get("/bookmarks")`
declares the path operation `GET /bookmarks`. This is the decorator-based
equivalent of the `(method, path) → handler` dictionary written by hand in
Lesson 2.

**Query plan** (Lesson 5) — The ordered tree of steps PostgreSQL chose to answer
a query, shown by `EXPLAIN`. `EXPLAIN (ANALYZE, BUFFERS)` runs the query and
annotates each step with what really happened: `actual time`, true row counts,
`Rows Removed by Filter`, and pages touched. Read it inside out — the most
indented node runs first. `cost` is an arbitrary planner unit for comparing
candidate plans, never a duration; a large gap between estimated and actual rows
means stale statistics and calls for `ANALYZE`.

**Pydantic model** (Lesson 3) — A class inheriting from `pydantic.BaseModel`
whose typed attributes define a data schema. FastAPI uses it to parse a JSON
request body, validate every field's type, reject bad input with a `422`
response naming the exact failing field, and emit the body's JSON Schema into
the OpenAPI document. Replaces hand-written `json.loads` plus manual field
checks.

## R

**Release step** (Lesson 7) — The command that runs between the build and the
run stage, and only there: schema migrations, an asset upload, a cache warm.
It runs once, on its own instance, and it must finish before the new version
takes traffic; a failure fails the deploy and the previous version keeps the
traffic. Never put a migration in the web process — a platform starts many
instances, and each one would change the schema at the same instant. Render
calls this the `preDeployCommand`. The step must be idempotent, because the
platform may run it twice.

## S

**Safe method** (Lesson 1, reference card) — A request method that does not
modify server state. GET and HEAD are safe. Safety means a cache can serve them
without side effects and a crawler can follow links freely. RFC 9110 §9.2.1.

**Start-line** (Lesson 1) — The first line of an HTTP message. For a request it
is the *request line*: `METHOD target HTTP/version`. For a response it is the
*status line*: `HTTP/version status-code reason-phrase`. Everything after it
until the blank line is headers.

## V

**Virtual hosting** (Lesson 1) — Serving multiple domain names from a single IP
address. The `Host` header (mandatory in HTTP/1.1) tells the server which site
the client meant — without it, `GET /` is ambiguous because hundreds of sites
may share the address. This is why HTTP/1.1 requires `Host` and responds `400`
if it is missing. RFC 9110 §7.2.
