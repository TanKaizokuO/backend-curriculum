"""Lesson 7 — the same API, ready to leave localhost.

Three changes from Lesson 6, and nothing else:

    1. The DSN comes from `config.settings`, not from `os.environ` at import.
    2. `GET /healthz` reports whether the database answers.
    3. The pool sizes come from configuration.

Run it locally:

    uvicorn main:app --host 0.0.0.0 --port 8000

Run it in a container: see the Dockerfile. The migrations run as a release
step, before this process starts. This module never creates a table.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from psycopg import errors
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel

from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncConnectionPool(
        settings.dsn,
        min_size=settings.pool_min_size,
        max_size=settings.pool_max_size,
        open=False,
    ) as pool:
        await pool.wait()
        app.state.pool = pool
        yield


app = FastAPI(title="Bookmarks API", lifespan=lifespan)


class BookmarkCreate(BaseModel):
    url: str
    title: str | None = None
    tags: list[str] = []


@app.get("/healthz")
async def healthz():
    """Report the state of the process and of the database.

    A load balancer calls this endpoint. Answer 200 only when the database
    answers, because a process that cannot reach its database is not healthy.
    """
    try:
        async with app.state.pool.connection() as conn:
            await conn.execute("SELECT 1")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database: {exc}") from exc
    return {"status": "ok", "env": settings.app_env}


LIST_SQL = """
    SELECT b.id, b.url, b.title, b.created_at, b.visit_count,
           coalesce(array_agg(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t           ON t.id = bt.tag_id
    GROUP BY b.id
    ORDER BY b.id
    LIMIT %(limit)s OFFSET %(skip)s
"""


@app.get("/bookmarks")
async def list_bookmarks(skip: int = 0, limit: int = 10):
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            LIST_SQL, {"limit": limit, "skip": skip}
        )
        return await cur.fetchall()


@app.get("/bookmarks/search")
async def search_bookmarks(title: str = Query(min_length=1), limit: int = 20):
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, url, title, created_at FROM bookmarks"
            " WHERE title LIKE %s ORDER BY created_at DESC LIMIT %s",
            (title + "%", limit),
        )
        return await cur.fetchall()


@app.get("/bookmarks/{bookmark_id}")
async def get_bookmark(bookmark_id: int):
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "SELECT id, url, title, created_at, visit_count FROM bookmarks"
            " WHERE id = %s",
            (bookmark_id,),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return row


@app.post("/bookmarks/{bookmark_id}/visit")
async def record_visit(bookmark_id: int):
    """One statement. Lesson 6 proved that two statements lose writes."""
    async with app.state.pool.connection() as conn:
        cur = await conn.cursor(row_factory=dict_row).execute(
            "UPDATE bookmarks SET visit_count = visit_count + 1"
            " WHERE id = %s RETURNING id, visit_count",
            (bookmark_id,),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return row


@app.post("/bookmarks", status_code=201)
async def create_bookmark(bookmark: BookmarkCreate):
    async with app.state.pool.connection() as conn:  # one transaction
        cur = conn.cursor(row_factory=dict_row)
        try:
            await cur.execute(
                "INSERT INTO bookmarks (url, title) VALUES (%s, %s)"
                " RETURNING id, url, title, created_at, visit_count",
                (bookmark.url, bookmark.title),
            )
        except errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="URL already bookmarked")
        row = await cur.fetchone()

        for name in bookmark.tags:
            await cur.execute(
                "INSERT INTO tags (name) VALUES (%s)"
                " ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name"
                " RETURNING id",
                (name,),
            )
            tag = await cur.fetchone()
            await cur.execute(
                "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (%s, %s)",
                (row["id"], tag["id"]),
            )
    return row | {"tags": bookmark.tags}


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(bookmark_id: int):
    async with app.state.pool.connection() as conn:
        cur = await conn.execute(
            "DELETE FROM bookmarks WHERE id = %s", (bookmark_id,)
        )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
