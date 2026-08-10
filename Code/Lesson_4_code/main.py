import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
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
