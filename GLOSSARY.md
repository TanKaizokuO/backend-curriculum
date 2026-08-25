# Glossary

Terms promoted here once the learner demonstrates correct usage. Not a
dictionary — each entry records the lesson where the term was established and
the precise sense that matters for this curriculum.

---

## A

**Atomic** (Lesson 12) — An operation that completes fully or not at all,
appearing instantaneous to every other process. Redis's `INCR` is atomic: two
concurrent increments of a key holding `4` always yield `5` and `6`, never
two `5`s. This is why a shared Redis counter prevents the *lost update* that
a naive read-modify-write causes.
**Atomicity** (Lesson 4) — The *A* in ACID: a transaction either applies
completely or not at all. Demonstrated concretely — a successful `INSERT`
followed by a failing one makes PostgreSQL answer the subsequent `COMMIT` with
`ROLLBACK`, and the first row never existed. This is why every multi-statement
write in an API belongs inside one transaction.

**Authentication** (Lesson 8) — The proof that the caller is who they claim to
be: a password check, then a session cookie or a signed token on each later
request. It answers "who is this?" and its failure code is `401`, with a
`WWW-Authenticate` header. Distinct from *authorisation*. The password check
must cost the same for a real account and for an unknown one, or the response
time lists your users.

**Authorisation** (Lesson 8) — The decision about what an identified caller
may do, for example the `user_id` column on the row they want to delete. It
answers "may they?" and its failure code is `403`. A `401` invites a new
credential; a `403` does not, because the same credential fails again.

**Authoritative server** (Lesson 14) — The server a domain's owner
configured to hold its actual DNS records. A root server names the
servers for a top-level domain; a TLD server names the authoritative
servers for one domain within it; only the authoritative server answers
with the record itself. Queried directly, it — like a root or TLD server
— reports `recursion requested but not available`, because none of the
three walks the chain on a client's behalf.

## B

**Blob** (Lesson 13) — A Git object holding raw file content, addressed by
the SHA-1 hash of that content, with no filename attached. `git hash-object
-w` writes one directly. Two files with identical content share one blob,
even across unrelated commits.

**Branch** (Lesson 13) — A movable pointer to one commit, stored as one
41-byte file under `.git/refs/heads/`. Creating a branch copies nothing, so
it costs the same regardless of repository size. `HEAD` names the current
branch; a new commit moves the branch's file to point at it.

## C

**Commit** (Lesson 13) — A Git object naming one tree (a full project
snapshot) plus zero or more parent commits. The first commit in a
repository has no parent; every later one names the commit before it,
which is what makes history a graph rather than a list. A merge commit
names two parents. An object's hash covers its own content, including its
parent, so changing a commit's parent (a *rebase*) always produces a new
hash.

**Connection pool** (Lesson 4) — A cache of open database connections. Opening
a TCP connection and negotiating TLS/authentication takes tens of milliseconds;
a pool does this once at startup and hands out ready connections in
microseconds. When demand exceeds `max_size`, callers queue. Node.js `pg.Pool`
lacks a queue timeout, forcing callers to wait forever or write a manual timeout.
**Cache** (Lesson 10) — A copy of an answer, kept somewhere faster than the
place that computed it, so a later request can skip the work. A cache can be
wrong: the source changes, and the copy does not. Name the moment a copy goes
stale before you add a cache, not after. See *TTL* and *cache invalidation*.

**Cache invalidation** (Lesson 10) — The act of telling a cache that its copy
no longer matches the source, either by deleting the entry on a write or by
giving the entry a *TTL* so it expires on its own. A TTL is simpler: no write
path needs to know which cache keys its change affects. The cost is a stale
read for up to one TTL after every write.

**CNAME** (Lesson 14) — A DNS record that maps a name to another name,
never to an address. `www.github.com` holds a CNAME pointing at
`github.com`; a client must resolve that target name separately to get an
actual address. A name with a CNAME record may hold no other record type.

**Cardinality** (Lesson 11) — The number of distinct label combinations a
metric can take, and so the number of separate time series it creates. A
label built from a route template, `/bookmarks/{id}`, stays bounded at one
series per route. A label built from the raw path, with the id inside it,
adds a new series for every id ever requested and never stops growing —
the mistake a metric label must avoid.

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

**Counter** (Lesson 11) — A metric that only goes up, and resets to zero
when the process restarts. Answers "how often": `http_requests_total`
counts every request, labelled by method, route, and status code.
Contrast *histogram*.

## E

**ETag** (Lesson 10) — A short opaque string that names one version of a
resource, sent in a response header. The client stores it and sends it back
in `If-None-Match` on the next request. If the server computes the same
ETag, it answers `304 Not Modified` with no body, and the client keeps the
copy it already has. RFC 9110 §8.8.3.

## F

**Framing** (Lesson 1) — The mechanism by which an HTTP recipient knows where
a message body ends. The three legal framing strategies for HTTP/1.1 are:
`Content-Length`, chunked transfer encoding, and closing the connection. Missing
all three causes the client to hang — the defining symptom of a framing bug.

**Force-push** (Lesson 13) — `git push --force`: a push that tells the
remote to accept a new branch tip without checking that it descends from
the old one. It overwrites the remote's history — including any commit
that only the old tip named — and offers no undo on the remote itself.
Branch protection can block it outright on a shared branch; see *reflog*
for the local-only rescue when it happens anyway.

## H

**Health check** (Lesson 7) — A request that a platform sends to a service
every few seconds, to decide two things: whether a new deploy may take traffic,
and whether a running instance needs a restart. A useful endpoint touches the
dependency that actually breaks — `SELECT 1` on the connection pool — and
answers `503` when it fails, so an instance that cannot reach its database
never receives a request. Keep it cheap; it runs forever. Render treats any
`2xx` or `3xx` within five seconds as healthy.

**Histogram** (Lesson 11) — A metric built from several counters plus a
running sum, sorting every observed value into buckets by upper bound.
Answers "how slow, and in which bucket", for example how many requests to
one route finished in under 25 ms. Contrast *counter*, which only answers
"how often".

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

**JSON Web Token (JWT)** (Lesson 8) — Three base64url parts joined by dots:
header, payload, signature. The signature is HMAC or a public-key algorithm
over the first two parts. The client can read every claim, so a JWT hides
nothing; it only proves who wrote the claims. The server keeps no record, so
the token stays valid until `exp` and a logout cannot withdraw it. Two rules:
take the accepted algorithm from your own list, never from the header
(`alg: none`), and keep the life short.

## L

**Load balancer** (Lesson 12) — A reverse proxy that accepts a connection from
a client, picks one backend instance from a list, opens a connection to it, and
copies bytes back and forth. A minimal proxy simply alternates (round robin);
a production balancer adds health checks, TLS termination, and retries.
Load balancing is what makes *local state* break.

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

**Merge conflict** (Lesson 13) — What Git reports when two branches change
the same lines of the same file and `git merge` cannot pick a side on its
own. Git writes both versions into the file between `<<<<<<<` and `>>>>>>>`
markers and stops; a person edits the file, keeps the intended result, and
stages it. `git rebase` hits the identical conflict for the identical
reason, since it replays the same changed lines onto a new parent.

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

**Rate limiting** (Lesson 12) — Rejecting requests to cap how often a client
can call an endpoint in a given window, usually to stop brute-force attacks or
manage overload. An in-memory rate limiter silently multiplies its limit across
multiple instances behind a *load balancer*; a correct distributed limiter uses
*atomic* operations against a shared store like Redis.

**Rebase** (Lesson 13) — Replaying one branch's commits onto a new parent
commit, one at a time, instead of joining the two branches with a merge
commit. The result is a straight line, with no merge commit, but every
replayed commit gets a new hash, because a commit's hash covers its parent.
Never rebase a commit already pushed to a branch other people build on —
their copy and the rebased copy become two different commits.

**Reflog** (Lesson 13) — A local, per-repository log of every commit `HEAD`
has pointed to on this machine, including ones no branch names anymore.
`git reflog` recovers a commit dropped by a mistaken `reset --hard` or
rebase. It is never pushed, fetched, or cloned, so it only helps on the
machine that made the original commit.

**Recursive resolver** (Lesson 14) — The server a client actually queries:
usually one handed out by the operating system or ISP, or a public one
such as `1.1.1.1`. It walks the chain from root to TLD to authoritative
server on the client's behalf and caches the result, so only the first
query for a name pays for the whole walk.

**Reverse proxy** (Lesson 12) — A process that accepts a connection on a
client's behalf and forwards it to a backend, so the client never talks
to the backend directly. Lesson 12's round-robin proxy only copies bytes.
Lesson 15's proxy also ends TLS, picks a certificate by *SNI*, adds
*X-Forwarded-For*, and rejects an over-size body — the jobs a real edge
such as Nginx or Caddy performs before an application ever sees a
request.

**Root server** (Lesson 14) — One of thirteen well-known servers that
know, for every top-level domain, which servers are authoritative for it.
A root server holds no record for any individual domain — only the next
link in the chain toward one.

**Read replica** (Lesson 12) — A second database that accepts a continuous
stream of changes (WAL) from the primary database and serves read-only queries.
Because WAL transfer and replay take time, a replica can fall behind (*replication
lag*). Reading from a replica immediately after writing to the primary causes a
*stale read*.

**Request id** (Lesson 11) — A short random value generated once, at the top
of a request, and carried through every log line and response header for
that request. Python threads it through `contextvars.ContextVar`; Node
threads it through `AsyncLocalStorage` — both solve the same problem: many
requests run interleaved in one process, so a plain variable would leak one
request's id into another's log line. `grep` on one id reconstructs one
request's whole story.

**Release step** (Lesson 7) — The command that runs between the build and the
run stage, and only there: schema migrations, an asset upload, a cache warm.
It runs once, on its own instance, and it must finish before the new version
takes traffic; a failure fails the deploy and the previous version keeps the
traffic. Never put a migration in the web process — a platform starts many
instances, and each one would change the schema at the same instant. Render
calls this the `preDeployCommand`. The step must be idempotent, because the
platform may run it twice.

## S

**Scaling** (Lesson 12) — Adding capacity to handle more traffic. *Vertical*
scaling means buying a bigger machine. *Horizontal* scaling means running a
second instance of the application on another machine. Horizontal scaling
forces all *local state* into a shared data store, because an instance no
longer knows about the traffic hitting its siblings.

**Safe method** (Lesson 1, reference card) — A request method that does not
modify server state. GET and HEAD are safe. Safety means a cache can serve them
without side effects and a crawler can follow links freely. RFC 9110 §9.2.1.

**Salt** (Lesson 8) — Random bytes, different for each user, mixed into a
password hash and stored beside it. Without a salt, two users with the same
password produce the same hash, and the leaked table shows which accounts
share a password. bcrypt puts the cost and the 22-character salt inside the
string that it returns: `$2b$12$<salt><hash>`. You never manage a salt column.

**Self-signed certificate** (Lesson 15) — A TLS certificate a server signs
with its own key, instead of a certificate authority's. It proves nothing
to a client that has not chosen to trust that one file, so curl and
browsers reject it by default with `SSL certificate problem`. A public
certificate authority buys one thing: a client's existing trust, not a
different check.

**SNI (Server Name Indication)** (Lesson 15) — The hostname a client
sends in clear text, inside the TLS handshake, before encryption starts.
A TLS server needs it to pick a certificate for the requested hostname
before it can decrypt anything else about the request — the `Host`
header (see *Virtual hosting*) is not available yet, because it lives
inside the part of the request SNI runs ahead of.

**Session** (Lesson 8) — Server-held state for a signed-in user, addressed by
one opaque id in a cookie. The id carries no facts; every fact stays in the
`sessions` row. This gives the property a signed token cannot give: one
`DELETE` ends the session at once, everywhere. Generate the id with a
cryptographic generator (`secrets.token_hex`, `crypto.randomBytes`), never
with `random` or `Math.random()`.

**Span** (Lesson 11) — One timed operation inside a *trace*: a start time, an
end time, a name, and a set of attributes. `tracer.start_as_current_span(...)`
opens one around the HTTP handler; a nested call opens a child span around
the database round trip. Printed to the console with `ConsoleSpanExporter`
in this curriculum; a production deploy exports the same spans over OTLP to
Jaeger or a vendor instead, with no other code change.

**Stale read** (Lesson 10) — An answer served from a cache after the source it
copied has changed. A write that bypasses the cache, direct `SQL` against
the database in this curriculum, makes the next cached read stale until the
entry expires. The failure has no error: the response is `200`, and the body
is wrong.

**Start-line** (Lesson 1) — The first line of an HTTP message. For a request it
is the *request line*: `METHOD target HTTP/version`. For a response it is the
*status line*: `HTTP/version status-code reason-phrase`. Everything after it
until the blank line is headers.

**Structured log** (Lesson 11) — One JSON object per log line, instead of a
free-text sentence. A JSON line is a line a program can parse and search by
field; a sentence built with an f-string is a line only a human can read.
Every field in this curriculum's log line is named, never embedded in
prose: `{"request_id": ..., "method": ..., "status": ..., "duration_ms": ...}`.
See *request id*.

## T

**Trace** (Lesson 11) — A tree of *spans* that share one `trace_id`,
showing where the time inside one request went. The outer span covers the
whole request; a child span's `parent_id` equals the outer span's own
`span_id`, and that field is what makes it a child instead of a second,
unrelated event. A cache hit that never opens a database span is itself
evidence — the absence of a child span shows the request never reached the
database. See *span*.

**TLS termination** (Lesson 15) — The point where an encrypted connection
ends and is replaced by a plain one. A reverse proxy that terminates TLS
decrypts the client's request, then forwards it to the origin over plain
HTTP; the origin never holds a certificate or negotiates encryption
itself. Termination is also the moment the origin's view of the client's
address and protocol becomes wrong, unless *X-Forwarded-For* and
`X-Forwarded-Proto` restore them.

**TTL** (Lesson 10) — Time to live: the number of seconds a cache entry stays
valid before the cache deletes it on its own. A short TTL bounds how stale a
read can be, at the cost of more cache misses. A long TTL does the reverse.
Set it in the same statement that writes the entry:
`redis.set(key, value, ex=seconds)`. Lesson 14 applies the same idea to a
DNS record: every resolver between the client and the authoritative
server may keep the old answer for up to one TTL after the record itself
changes.

## V

**Virtual hosting** (Lesson 1) — Serving multiple domain names from a single IP
address. The `Host` header (mandatory in HTTP/1.1) tells the server which site
the client meant — without it, `GET /` is ambiguous because hundreds of sites
may share the address. This is why HTTP/1.1 requires `Host` and responds `400`
if it is missing. RFC 9110 §7.2.

## X

**X-Forwarded-For** (Lesson 15) — A header a reverse proxy adds after
*TLS termination* ends the client's own connection, naming the client's
real address for the origin. The proxy must strip any
`X-Forwarded-For` a client already sent before adding its own, or a
client could claim any address it likes.

## Z

**Zone** (Lesson 14) — The set of DNS records one authoritative server
answers for, rooted at one domain name. `bookmarks-api.local` and every
name under it, in this lesson's toy server, form one zone, held in one
file re-read on every query.
