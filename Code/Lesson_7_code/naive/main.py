"""The Lesson 6 app, unchanged: the DSN is read from the environment at import."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool

DSN = os.environ["DATABASE_URL"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncConnectionPool(DSN, open=False) as pool:
        await pool.wait()
        app.state.pool = pool
        yield

app = FastAPI(lifespan=lifespan)

@app.get("/bookmarks")
async def list_bookmarks(limit: int = 3):
    async with app.state.pool.connection() as conn:
        cur = await conn.execute("SELECT id, url FROM bookmarks ORDER BY id LIMIT %s", (limit,))
        return await cur.fetchall()
