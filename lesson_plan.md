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
| 8 | ~~[Authentication](./lessons/0008-authentication.html)~~ | The server must never trust the client. It must only trust what it can verify. | [`Code/Lesson_8_code/`](./Code/Lesson_8_code/) (Python), [`Code/js/Lesson_8_code/`](./Code/js/Lesson_8_code/) (TypeScript) |
| 9 | ~~[Testing and CI](./lessons/0009-testing-and-ci.html)~~ | A test that cannot fail proves nothing. Test the contract, not the plumbing. | [`Code/Lesson_9_code/`](./Code/Lesson_9_code/) (Python), [`Code/js/Lesson_9_code/`](./Code/js/Lesson_9_code/) (TypeScript) |

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
- **8** The breach: an unsigned JWT lets a user edit their own ID, and ten slow hashes block the event loop for 1.7 seconds.
- **9** The test that fails: you change the status code from 401 to 200. CI fails the test on the pull request.

## Now

| # | Lesson | The one idea | Code |
| --- | --- | --- | --- |
| 10 | [Caching](./lessons/0010-caching.html) | A cache is a copy that can be wrong. Name the moment it goes stale before you add it. | [`Code/Lesson_10_code/`](./Code/Lesson_10_code/), [`Code/js/Lesson_10_code/`](./Code/js/Lesson_10_code/) |

The lesson is planned but not written.

## Next

| # | Lesson | The one idea | Planned code |
| --- | --- | --- | --- |
| 11 | Observability | You cannot debug what you cannot see. A log line, a metric, and a trace answer different questions. | `Code/Lesson_11_code/`, `Code/js/Lesson_11_code/` |
| 12 | Scaling | Add a second instance and every assumption about local state breaks. | `Code/Lesson_12_code/`, `Code/js/Lesson_12_code/` |
| 13 | Version control | A commit is a snapshot with a parent. History is a graph, not a list. | `Code/Lesson_13_code/`, `Code/js/Lesson_13_code/` |
| 14 | How a request finds your server | A name becomes an address through caches you do not control. | `Code/Lesson_14_code/`, `Code/js/Lesson_14_code/` |
| 15 | The edge: reverse proxy and TLS | The process that answers port 443 is not your application. | `Code/Lesson_15_code/`, `Code/js/Lesson_15_code/` |
| 16 | Rules the browser enforces | CORS and CSP are instructions to the browser. They protect the user, not the server. | `Code/Lesson_16_code/`, `Code/js/Lesson_16_code/` |
| 17 | Attacking your own API | Most breaches are authorization bugs, not broken cryptography. | `Code/Lesson_17_code/`, `Code/js/Lesson_17_code/` |
| 18 | Delegated identity | OAuth grants access. OpenID Connect proves identity. They are not the same token. | `Code/Lesson_18_code/`, `Code/js/Lesson_18_code/` |
| 19 | Other API shapes | The shape of the API decides who writes the query: you or the client. | `Code/Lesson_19_code/`, `Code/js/Lesson_19_code/` |
| 20 | Real-time data | Pick the cheapest transport that meets the latency the feature needs. | `Code/Lesson_20_code/`, `Code/js/Lesson_20_code/` |
| 21 | NoSQL | Choose the store from the access pattern. Every store gives up something. | `Code/Lesson_21_code/`, `Code/js/Lesson_21_code/` |
| 22 | Search engines | A database finds rows that match. A search engine ranks documents. | `Code/Lesson_22_code/`, `Code/js/Lesson_22_code/` |
| 23 | Message brokers | A queue turns work you must finish now into work you promise to finish. | `Code/Lesson_23_code/`, `Code/js/Lesson_23_code/` |
| 24 | Replication, sharding, CAP | Every distributed guarantee is bought with another one. | `Code/Lesson_24_code/`, `Code/js/Lesson_24_code/` |
| 25 | Building for scale | Overload is a queue problem. Choose how you fail, or the system chooses. | `Code/Lesson_25_code/`, `Code/js/Lesson_25_code/` |
| 26 | Containers and orchestration | An orchestrator is a control loop that keeps a declared state true. | `Code/Lesson_26_code/`, `Code/js/Lesson_26_code/` |
| 27 | Splitting the monolith | A split distributes the work and the failures with it. | `Code/Lesson_27_code/`, `Code/js/Lesson_27_code/` |
| 28 | Design and architecture | A pattern is a name for pressure you already feel in the code. | `Code/Lesson_28_code/`, `Code/js/Lesson_28_code/` |

### Details for planned lessons

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
13. **Version control.** Covers roadmap section 3. Branches, merge against
    rebase, the index, `reflog`, and pull requests/reviews. The observable
    failure: two branches edit the same handler, a force-push removes an
    approved commit, and `git reflog` recovers it.
14. **How a request finds your server.** Covers roadmap section 1 (DNS,
    domains, hosting). Resolvers, root/TLD servers, record types (`A`, `AAAA`,
    `CNAME`, `MX`, `TXT`), and TTL. The observable failure: changing an `A`
    record with an 86400s TTL while the browser uses the cached IP for hours.
15. **The edge: reverse proxy and TLS.** Covers roadmap sections 8 & 19 (Nginx,
    Caddy, HTTPS/TLS). TLS termination, SNI, certificates, `X-Forwarded-For`.
    Observable failures: self-signed certificate rejection, proxy payload size
    limits (`413`), missing forwarding headers.
16. **Rules the browser enforces.** Covers CORS, CSP, and cookies (sections 8
    & 9). Same-origin policy, preflight requests, `SameSite`, `HttpOnly`,
    `Secure`. Observable failure: `http://localhost:5173` calls API, server logs
    `200`, browser drops the response due to CORS policy.
17. **Attacking your own API.** Covers OWASP risks & server security (section 8).
    Broken Object Level Authorization (BOLA), mass assignment, injection, rate
    limiting. Observable failure: changing an ID in the path allows reading
    another user's private data.
18. **Delegated identity.** Covers OAuth 2.0, OpenID Connect, SAML, and Basic
    auth (section 9). Authorization code flow with PKCE, access tokens vs ID
    tokens, scopes. Observable failure: treating an access token as proof of
    identity allowing token reuse across client applications.
19. **Other API shapes.** Covers GraphQL, SOAP, and HATEOAS (section 6). Schema,
    resolvers, N+1 problem in GraphQL, DataLoader, query depth limits.
    Observable failure: a single nested GraphQL query causing 60 redundant SQL
    queries.
20. **Real-time data.** Covers real-time communication (section 20). Short
    polling, long polling, Server-Sent Events, WebSockets, and subscriptions.
    Observable failures: short polling overhead at scale, missing proxy upgrade
    headers, multi-instance socket routing failures.
21. **NoSQL.** Covers NoSQL database families (section 14). Document, key-value,
    graph, time-series, column-family. Observable failure: MongoDB unindexed
    joins in application loops; loss of unpersisted Redis data on restart.
22. **Search engines.** Covers search engines (section 18). Inverted indexes,
    analyzers, stemming, relevance scoring. Elasticsearch, Solr, PostgreSQL FTS.
    Observable failure: search for `running` failing to match `run` due to an
    incorrect analyzer.
23. **Message brokers.** Covers message queues (section 16). RabbitMQ and Kafka.
    Queues, topics, consumer groups, idempotency, dead-letter queues. Observable
    failure: unacknowledged message redelivery running duplicate jobs.
24. **Replication, sharding, and CAP.** Covers database scaling & engines
    (sections 4, 5, 15). Streaming replication, lag, failover, shard keys, CAP
    theorem. Observable failure: immediate read after write hitting a lagged
    replica and returning missing data.
25. **Building for scale.** Covers resiliency & scaling (section 21). Timeouts,
    retries with jitter, circuit breakers, bulkheads, load shedding, expansion
    migrations. Observable failure: un-timed slow dependency filling worker
    pools and cascading failure to healthy endpoints.
26. **Containers and orchestration.** Covers container orchestration (section 17).
    Namespaces, cgroups, Kubernetes pods, deployments, services, probes.
    Observable failure: rolling deploy without readiness probes causing `502`
    errors before DB pools open.
27. **Splitting the monolith.** Covers architecture patterns (section 13). Monolith
    vs microservices, sagas, service boundaries, cold starts. Observable
    failure: multi-service transaction failure leaving split state without a saga
    compensation.
28. **Design and architecture.** Covers software design (section 12). Strategy,
    Factory, Adapter, Repository patterns; DDD, TDD, CQRS, event sourcing.
    Observable failure: pass-through repository interfaces adding boilerplate
    without testability or abstraction value.

## Two roadmap sections need no lesson

- **Section 2, Pick a Language.** The choice is made. JavaScript and Python are
  marked. Go, Rust, Java, C#, PHP, and Ruby are alternatives, not a backlog.
- **Section 4, Relational Databases.** PostgreSQL is the recommendation. MySQL,
  MariaDB, MS SQL, and Oracle are alternatives to the same idea. Lesson 24
  spends one page on what changes when the engine changes.

Two sections are also out of order in the roadmap. Git (section 3) and DNS
(section 1) are marked *learn anytime*. They arrive at 13 and 14 here because
the course needed a running server before it needed a deploy pipeline.

## After Lesson 28

Roadmap section 23 lists related tracks: DevOps, basic infrastructure, full
stack, and design principles. These are separate roadmaps, not lessons here.
Lessons 7, 15, 25, and 26 already cover the infrastructure a backend developer
must own.

## Coverage

| Roadmap section | Lessons |
| --- | --- |
| 1. Internet | 14 |
| 2. Pick a language | Done (Python, TypeScript) |
| 3. Version control | 13 |
| 4. Relational databases | 4, 24 |
| 5. More about databases | 4, 5, 6, 24 |
| 6. APIs | 3, 8, 19 |
| 7. Caching | 10, 15 |
| 8. Web security | 8, 15, 16, 17 |
| 9. Authentication | 8, 16, 18 |
| 10. Testing | 9 |
| 11. CI / CD | 9 |
| 12. Design and architecture | 28 |
| 13. Architectural patterns | 7, 27 |
| 14. NoSQL | 21 |
| 15. Scaling databases | 5, 24 |
| 16. Message brokers | 23 |
| 17. Containers | 7, 26 |
| 18. Search engines | 22 |
| 19. Web servers | 15 |
| 20. Real-time data | 20 |
| 21. Building for scale | 12, 25 |
| 22. Observability | 11 |
| 23. Related tracks | Out of scope |

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
