import os
import runpy
from contextlib import asynccontextmanager

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "postgresql://testuser:testpassword@127.0.0.1:5432/testdb")
os.environ.setdefault("BCRYPT_ROUNDS", "4")
os.environ.setdefault("SECRET_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef")

from config import settings
from main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
def _migrated_schema():
    """Build the schema once, before any test runs. Each test then opens its
    own transaction and rolls it back, so no test needs to rebuild the
    schema on its own."""
    with psycopg.connect(settings.dsn, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    runpy.run_path("migrate.py")


class _TransactionPool:
    """Stands in for `app.state.pool`. Every route still calls
    `pool.connection()` the same way it calls the real pool, but every
    checkout here opens a SAVEPOINT on one shared connection instead of
    handing out a fresh one — the `client` fixture below opens the outer
    transaction first, so each of these nests instead of committing for
    real. A route's own error rolls back only that route's savepoint; the
    fixture rolls back the whole outer transaction once the test ends, so
    no write ever reaches another test."""

    def __init__(self, conn: psycopg.AsyncConnection):
        self._conn = conn

    @asynccontextmanager
    async def connection(self):
        async with self._conn.transaction():
            yield self._conn


@pytest.fixture
async def client():
    conn = await psycopg.AsyncConnection.connect(settings.dsn)
    app.state.pool = _TransactionPool(conn)
    transport = ASGITransport(app=app)
    try:
        async with conn.transaction():
            async with AsyncClient(transport=transport, base_url="http://test") as http_client:
                yield http_client
            # Roll back the outer transaction instead of committing it, so
            # every write this test made — across every checkout above —
            # disappears. `Rollback` is caught by `transaction()` itself and
            # does not propagate.
            raise psycopg.Rollback()
    finally:
        await conn.close()
