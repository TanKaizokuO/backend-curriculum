import os
import runpy
from contextlib import asynccontextmanager

import psycopg
import pytest
from httpx import ASGITransport, AsyncClient
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

os.environ.setdefault("DATABASE_URL", "postgresql://testuser:testpassword@127.0.0.1:5432/testdb")
os.environ.setdefault("BCRYPT_ROUNDS", "4")
os.environ.setdefault("SECRET_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef")

from cache import DictCache
from config import settings
from db import Db
from main import app
from observability import provider


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


class _SavepointSource:
    """A connection source for `Db`, in place of the pool's `connection`.

    The application passes `pool.connection`, which hands out a fresh
    connection for each checkout. This class passes one shared connection and
    opens a SAVEPOINT for each checkout instead. The `client` fixture opens
    the outer transaction first, so each savepoint nests and commits nothing
    for real. A route's own error rolls back only that route's savepoint. The
    fixture rolls back the outer transaction at the end of the test, so no
    write reaches another test.

    `Db` runs the same code for both sources, so a test exercises the same
    span code that the application runs.
    """

    def __init__(self, conn: psycopg.AsyncConnection):
        self._conn = conn

    @asynccontextmanager
    async def connection(self):
        async with self._conn.transaction():
            yield self._conn


@pytest.fixture
async def client():
    conn = await psycopg.AsyncConnection.connect(settings.dsn)
    app.state.db = Db(_SavepointSource(conn).connection)
    app.state.cache = DictCache()
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


@pytest.fixture(scope="session")
def _span_exporter():
    """Collect every finished span in memory, for the whole session.

    A span processor cannot be removed once it is added, so this fixture adds
    one processor and each test clears the buffer instead.
    """
    exporter = InMemorySpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    return exporter


@pytest.fixture
def spans(_span_exporter):
    """Start each test with an empty buffer."""
    _span_exporter.clear()
    return _span_exporter
