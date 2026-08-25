"""Lesson 11 — the same API, observed: structured logs, metrics, a trace.

    GET /bookmarks/{id}   -> an ETag. The browser asks "has this changed?"
    GET /bookmarks/search -> a Redis copy of a database answer.
    GET /metrics          -> a counter and a histogram, in Prometheus's text
                              format.

Every request now writes one JSON log line, updates two metrics, and opens
one trace span with a child span for the database round trips that matter.
`observability.py` holds the wiring; this file only calls it.

Run it:

    uvicorn main:app --reload --port 8000

The migrations run first, as in Lesson 7:

    python migrate.py
"""

import hashlib
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from psycopg import errors
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool, PoolTimeout
from pydantic import BaseModel, EmailStr, Field
from redis.asyncio import Redis
from starlette.concurrency import run_in_threadpool

from config import settings
from observability import (
    CACHE_RESULT,
    REQUEST_COUNT,
    REQUEST_LATENCY,
    log_event,
    metrics_response,
    new_request_id,
    request_id_var,
    tracer,
)
from rate_limit import local_limiter, redis_limiter
from security import (
    TokenError,
    hash_password,
    issue_token,
    new_session_id,
    verify_password,
    verify_token,
    waste_time_like_a_real_login,
)

SESSION_COOKIE = "session"
SEARCH_CACHE_TTL_SECONDS = 30


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncConnectionPool(
        settings.dsn,
        min_size=settings.pool_min_size,
        max_size=settings.pool_max_size,
        timeout=settings.pool_acquire_timeout_seconds,
        open=False,
    ) as pool:
        await pool.wait()
        app.state.pool = pool
        app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            yield
        finally:
            await app.state.redis.aclose()


app = FastAPI(title="Bookmarks API with accounts", lifespan=lifespan)


@app.exception_handler(PoolTimeout)
async def pool_timeout_handler(request: Request, exc: PoolTimeout) -> JSONResponse:
    """Lesson 12. Every route above shares one pool of database connections.
    When demand outruns `pool_max_size` for longer than
    `pool_acquire_timeout_seconds`, a checkout raises `PoolTimeout` instead
    of waiting forever. Answer fast and say so, instead of holding the
    caller's connection open until it times out on its own."""
    return JSONResponse(
        status_code=503,
        content={"detail": "database connection pool exhausted, try again shortly"},
        headers={"Retry-After": "1"},
    )


@app.middleware("http")
async def observe_request(request: Request, call_next):
    """One span, one metric update, one log line, for every request.

    `request.scope["route"]` exists only after routing has run, so it is
    read after `call_next`, not before. Grouping `/bookmarks/17` and
    `/bookmarks/42` under the route template `/bookmarks/{bookmark_id}`
    keeps the metric's cardinality bounded — one time series per route, not
    one per id ever requested.
    """
    token = request_id_var.set(new_request_id())
    start = time.perf_counter()
    with tracer.start_as_current_span("http_request") as span:
        span.set_attribute("http.method", request.method)
        response = await call_next(request)
        duration_s = time.perf_counter() - start
        route = request.scope.get("route")
        route_path = route.path if route else request.url.path
        span.set_attribute("http.route", route_path)
        span.set_attribute("http.status_code", response.status_code)

    response.headers["X-Request-Id"] = request_id_var.get()
    REQUEST_COUNT.labels(request.method, route_path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, route_path).observe(duration_s)
    log_event(
        level="info",
        method=request.method,
        path=route_path,
        status=response.status_code,
        duration_ms=round(duration_s * 1000, 2),
    )
    request_id_var.reset(token)
    return response


@app.get("/metrics")
async def metrics():
    """Prometheus scrapes this. Read it with `curl` before trusting a graph."""
    body, content_type = metrics_response()
    return Response(content=body, media_type=content_type)


# --------------------------------------------------------------------------
# Shapes
# --------------------------------------------------------------------------

class Credentials(BaseModel):
    email: EmailStr
    # bcrypt reads 72 bytes. Say so in the contract instead of truncating in
    # silence, because a silent truncation makes two different passwords equal.
    password: str = Field(min_length=8, max_length=72)


class BookmarkCreate(BaseModel):
    url: str
    title: str | None = None
    tags: list[str] = []


class User(BaseModel):
    id: int
    email: str


# --------------------------------------------------------------------------
# Who is asking?
# --------------------------------------------------------------------------

SESSION_SQL = """
    SELECT u.id, u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.id = %s
       AND s.expires_at > now()
"""


async def current_user(
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    authorization: str | None = Header(default=None),
) -> User:
    """Accept either credential. Reject everything else with 401.

    The cookie wins when a request carries both, because a browser attaches a
    cookie on its own and a script attaches a header on purpose.
    """
    if session:
        async with app.state.pool.connection() as conn:
            cur = await conn.cursor(row_factory=dict_row).execute(SESSION_SQL, (session,))
            row = await cur.fetchone()
        if row:
            return User(**row)

    if authorization and authorization.startswith("Bearer "):
        try:
            claims = verify_token(authorization.removeprefix("Bearer "))
        except TokenError as exc:
            raise HTTPException(status_code=401, detail=f"bad token: {exc}") from exc
        return User(id=int(claims["sub"]), email=claims["email"])

    raise HTTPException(
        status_code=401,
        detail="not signed in",
        headers={"WWW-Authenticate": "Bearer"},
    )


# --------------------------------------------------------------------------
# Accounts
# --------------------------------------------------------------------------

@app.post("/auth/register", status_code=201, response_model=User)
async def register(credentials: Credentials):
    """Create an account. The password never reaches the database."""
    password_hash = await run_in_threadpool(hash_password, credentials.password)
    async with app.state.pool.connection() as conn:
        try:
            cur = await conn.cursor(row_factory=dict_row).execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (lower(%s), %s)
                RETURNING id, email
                """,
                (credentials.email, password_hash),
            )
        except errors.UniqueViolation as exc:
            raise HTTPException(status_code=409, detail="email already registered") from exc
        return await cur.fetchone()


async def _authenticate(email: str, password: str) -> dict:
    """Return the user row, or raise 401. Cost the same either way."""
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, email, password_hash FROM users WHERE email = lower(%s)",
            (email,),
        )
        row = await cur.fetchone()

    if row is None:
        # Spend the same time as a real check, then give the same answer.
        # A fast 401 for an unknown email hands over your user list.
        await run_in_threadpool(waste_time_like_a_real_login)
        raise HTTPException(status_code=401, detail="wrong email or password")

    if not await run_in_threadpool(verify_password, password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="wrong email or password")

    return row


@app.post("/auth/login", response_model=User)
async def login(credentials: Credentials, request: Request, response: Response):
    """Sign in and receive a session cookie.

    Rate limited against brute force, `settings.rate_limit_backend` picks
    where the count lives. See `rate_limit.py` and Lesson 12.
    """
    client_ip = request.client.host if request.client else "unknown"
    if settings.rate_limit_backend == "local":
        allowed = local_limiter(client_ip)
    else:
        allowed = await redis_limiter(app.state.redis, client_ip)
    if not allowed:
        raise HTTPException(status_code=429, detail="too many login attempts, try again later")

    user = await _authenticate(credentials.email, credentials.password)
    session_id = new_session_id()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.session_ttl_minutes)

    async with app.state.pool.connection() as conn:
        await conn.execute(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (%s, %s, %s)",
            (session_id, user["id"], expires_at),
        )

    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        max_age=settings.session_ttl_minutes * 60,
        httponly=True,                    # JavaScript cannot read it
        samesite="lax",                   # it does not travel with a cross-site POST
        secure=settings.cookie_secure,    # HTTPS only, outside development
        path="/",
    )
    return User(id=user["id"], email=user["email"])


@app.post("/auth/login-leaky", response_model=User)
async def login_leaky(credentials: Credentials):
    """The same check, without the dummy hash. Measure it, then delete it.

    An unknown email returns after one SELECT. A known email pays for one
    bcrypt verification. The clock tells a stranger which of your emails are
    real, and the answer is a user list.
    """
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, email, password_hash FROM users WHERE email = lower(%s)",
            (credentials.email,),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="wrong email or password")
    if not await run_in_threadpool(verify_password, credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="wrong email or password")
    return User(id=row["id"], email=row["email"])


@app.post("/auth/login-blocking", response_model=User)
async def login_blocking(credentials: Credentials):
    """The same check, on the event loop. Measure it, then delete this route.

    bcrypt needs about 250 ms of CPU. An `async def` handler that spends that
    time without awaiting stops every other request in the same process.
    `event_loop_block.py` measures the result.
    """
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, email, password_hash FROM users WHERE email = lower(%s)",
            (credentials.email,),
        )
        row = await cur.fetchone()
    if row is None or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="wrong email or password")
    return User(id=row["id"], email=row["email"])


@app.post("/auth/token")
async def token(credentials: Credentials):
    """Sign in and receive a JWT. No row is written, and none can be deleted."""
    user = await _authenticate(credentials.email, credentials.password)
    return {
        "access_token": issue_token(user["id"], user["email"]),
        "token_type": "bearer",
        "expires_in": settings.token_ttl_minutes * 60,
    }


@app.get("/auth/me", response_model=User)
async def me(user: User = Depends(current_user)):
    return user


@app.post("/auth/logout", status_code=204)
async def logout(
    response: Response,
    session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
):
    """Delete the session row, then clear the cookie.

    This is the difference that decides the whole lesson. One DELETE ends the
    session everywhere, at once. There is no equivalent for a signed token.
    """
    if session:
        async with app.state.pool.connection() as conn:
            await conn.execute("DELETE FROM sessions WHERE id = %s", (session,))
    response.delete_cookie(SESSION_COOKIE, path="/")


@app.post("/auth/logout-everywhere", status_code=204)
async def logout_everywhere(user: User = Depends(current_user)):
    """Sign out of every device. Sessions only."""
    async with app.state.pool.connection() as conn:
        await conn.execute("DELETE FROM sessions WHERE user_id = %s", (user.id,))


# --------------------------------------------------------------------------
# The API from Lessons 4 to 7, now with an owner
# --------------------------------------------------------------------------

@app.get("/healthz")
async def healthz():
    try:
        async with app.state.pool.connection() as conn:
            await conn.execute("SELECT 1")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database: {exc}") from exc
    return {"status": "ok", "env": settings.app_env}


LIST_SQL = """
    SELECT b.id, b.url, b.title, b.visit_count, b.user_id,
           array_agg(t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      LEFT JOIN tags t           ON t.id = bt.tag_id
     GROUP BY b.id
     ORDER BY b.id
     LIMIT %s OFFSET %s
"""


@app.get("/bookmarks")
async def list_bookmarks(skip: int = 0, limit: int = Query(default=10, le=100)):
    """Public. Anybody may read."""
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(LIST_SQL, (limit, skip))
        return await cur.fetchall()


SEARCH_SQL = """
    SELECT id, url, title
      FROM bookmarks
     WHERE title LIKE %s
     ORDER BY id
     LIMIT %s OFFSET %s
"""


@app.get("/bookmarks/search")
async def search_bookmarks(
    q: str, skip: int = 0, limit: int = Query(default=10, le=100)
):
    """Public. Prefix search on the title, cached in Redis.

    Register this route before `/bookmarks/{bookmark_id}`. Starlette matches
    routes in the order you add them, and "search" would otherwise match the
    `{bookmark_id}` pattern first and fail as a bad integer.

    The database already answers this query fast: migration 0003 gives it an
    index. The cache exists to remove the round trip and the CPU work for a
    query the same client repeats, not to fix a slow query.

    A cache hit answers from Redis and never opens a database span. That one
    fact — no `pg_query` child span in the trace — is how Lesson 11's closing
    practice tells a hit from a miss without reading this function.
    """
    cache_key = f"search:{q}:{skip}:{limit}"
    cached = await app.state.redis.get(cache_key)
    if cached is not None:
        CACHE_RESULT.labels("hit").inc()
        log_event(event="search_cache", result="hit", key=cache_key)
        return {"source": "cache", "results": json.loads(cached)}

    CACHE_RESULT.labels("miss").inc()
    log_event(event="search_cache", result="miss", key=cache_key)
    with tracer.start_as_current_span("pg_query") as span:
        span.set_attribute("db.system", "postgresql")
        span.set_attribute("db.statement", SEARCH_SQL.strip())
        async with app.state.pool.connection() as conn:
            cur = await conn.cursor(row_factory=dict_row).execute(
                SEARCH_SQL, (f"{q}%", limit, skip)
            )
            rows = await cur.fetchall()
        span.set_attribute("db.rows_returned", len(rows))

    await app.state.redis.set(
        cache_key, json.dumps(rows, default=str), ex=SEARCH_CACHE_TTL_SECONDS
    )
    return {"source": "database", "results": rows}


@app.get("/bookmarks/{bookmark_id}")
async def get_bookmark(bookmark_id: int, request: Request, response: Response):
    """Public. One row, with an ETag.

    The ETag is a hash of the fields the client can see. Two requests for the
    same row get the same ETag until a write changes `visit_count` or
    `title`. A matching `If-None-Match` gets a 304 with no body.
    """
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, url, title, visit_count, user_id FROM bookmarks WHERE id = %s",
            (bookmark_id,),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="bookmark not found")

    etag = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).hexdigest()[:16]
    response.headers["Cache-Control"] = "max-age=30"
    response.headers["ETag"] = etag

    if request.headers.get("if-none-match") == etag:
        response.status_code = 304
        return Response(status_code=304, headers=dict(response.headers))
    return row


@app.post("/bookmarks", status_code=201)
async def create_bookmark(bookmark: BookmarkCreate, user: User = Depends(current_user)):
    """Signed in only. The row records its owner."""
    async with app.state.pool.connection() as conn:  # one transaction
        cur = conn.cursor(row_factory=dict_row)
        try:
            await cur.execute(
                """
                INSERT INTO bookmarks (url, title, user_id)
                VALUES (%s, %s, %s)
                RETURNING id, url, title, visit_count, user_id
                """,
                (bookmark.url, bookmark.title, user.id),
            )
        except errors.UniqueViolation as exc:
            raise HTTPException(status_code=409, detail="url already exists") from exc
        row = await cur.fetchone()

        for name in bookmark.tags:
            await cur.execute(
                "INSERT INTO tags (name) VALUES (%s) ON CONFLICT (name) DO NOTHING",
                (name,),
            )
            await cur.execute(
                """
                INSERT INTO bookmark_tags (bookmark_id, tag_id)
                SELECT %s, id FROM tags WHERE name = %s
                ON CONFLICT DO NOTHING
                """,
                (row["id"], name),
            )
    return row | {"tags": bookmark.tags}


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(bookmark_id: int, user: User = Depends(current_user)):
    """Signed in, and yours.

    401 says "I do not know who you are". 403 says "I know, and the answer is
    no". Two different questions: authentication, then authorisation.
    """
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT user_id FROM bookmarks WHERE id = %s", (bookmark_id,)
        )
        row = await cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        if row["user_id"] != user.id:
            raise HTTPException(status_code=403, detail="not your bookmark")
        await conn.execute("DELETE FROM bookmarks WHERE id = %s", (bookmark_id,))
