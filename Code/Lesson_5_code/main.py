"""Lesson 5 — the Lesson 4 API, plus a search endpoint and an N+1 endpoint.

    export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
    uvicorn main:app --reload

Two endpoints return the same list of bookmarks with their tags:

    GET /bookmarks        one query
    GET /bookmarks/slow   one query per bookmark   <- the N+1 problem

Compare them with `time curl`. Keep both until you have measured them, then
delete /bookmarks/slow.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from psycopg import errors
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel

DSN = os.environ["DATABASE_URL"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncConnectionPool(DSN, open=False) as pool:
        await pool.wait()
        app.state.pool = pool
        yield


app = FastAPI(lifespan=lifespan)


class BookmarkCreate(BaseModel):
    url: str
    title: str | None = None
    tags: list[str] = []


LIST_SQL = """
    SELECT b.id, b.url, b.title, b.created_at,
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


@app.get("/bookmarks/slow")
async def list_bookmarks_n_plus_1(skip: int = 0, limit: int = 10):
    """Identical output to GET /bookmarks. 1 + limit queries instead of 1."""
    async with app.state.pool.connection() as conn:
        cur = conn.cursor(row_factory=dict_row)
        await cur.execute(
            "SELECT id, url, title, created_at FROM bookmarks"
            " ORDER BY id LIMIT %s OFFSET %s",
            (limit, skip),
        )
        rows = await cur.fetchall()
        for row in rows:                  # <- one round trip per bookmark
            await cur.execute(
                "SELECT t.name FROM tags t"
                " JOIN bookmark_tags bt ON bt.tag_id = t.id"
                " WHERE bt.bookmark_id = %s ORDER BY t.name",
                (row["id"],),
            )
            row["tags"] = [r["name"] for r in await cur.fetchall()]
    return rows


@app.get("/bookmarks/search")
async def search_bookmarks(
    title: str = Query(min_length=1),
    limit: int = 20,
):
    """Prefix search. Needs migration 0003 to use an index."""
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
            "SELECT id, url, title, created_at FROM bookmarks WHERE id = %s",
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
                " RETURNING id, url, title, created_at",
                (bookmark.url, bookmark.title),
            )
        except errors.UniqueViolation:
            raise HTTPException(status_code=409,
                                detail="URL already bookmarked")
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
                "INSERT INTO bookmark_tags (bookmark_id, tag_id)"
                " VALUES (%s, %s)",
                (row["id"], tag["id"]),
            )
    return row | {"tags": bookmark.tags}


@app.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(bookmark_id: int):
    async with app.state.pool.connection() as conn:
        cur = await conn.execute("DELETE FROM bookmarks WHERE id = %s",
                                 (bookmark_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Bookmark not found")
