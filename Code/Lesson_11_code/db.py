"""Lesson 11 — one module for every database round trip.

    db.fetch_one(sql, args)      -> one row, or None
    db.fetch_all(sql, args)      -> every row
    db.execute(sql, args)        -> no row; for INSERT, UPDATE, and DELETE
    async with db.tx() as t:     -> several statements, one transaction

WARNING: never put the query parameters on a span. The parameters here hold
an email address, a session id, and a password hash. This module records the
SQL text in `db.statement` and records no parameter. psycopg sends the
parameters on a separate channel, so the statement text is safe to export.

Lesson 10 spread the pool checkout across fourteen handlers. Each handler
opened its own connection, set its own row factory, and named its own span.
Thirteen handlers forgot the span. The trace showed a request that touched
the database and reported no database work.

This module keeps the checkout, the row factory, the span, and the metric in
one place. A handler passes SQL and arguments. A handler never sees a
connection, and a handler never names a span. The span is not a rule that a
handler obeys. The span is the only route to the database.
"""

import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Callable, Literal, Sequence

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from observability import DB_QUERY_DURATION, tracer

Row = dict[str, Any]
Args = Sequence[Any] | None

# A connection source is a callable that returns an async context manager.
# The context manager yields one connection and ends one transaction.
ConnectionSource = Callable[[], Any]

_Fetch = Literal["one", "all", "none"]


async def _run(conn: AsyncConnection, sql: str, args: Args, fetch: _Fetch) -> Any:
    """Run one statement on one connection, inside one span.

    Every public method arrives here, so the span and the metric happen once
    in the code and always at runtime.
    """
    with tracer.start_as_current_span("pg_query") as span:
        span.set_attribute("db.system", "postgresql")
        span.set_attribute("db.statement", sql.strip())
        start = time.perf_counter()
        cur = await conn.cursor(row_factory=dict_row).execute(sql, args)
        if fetch == "one":
            result = await cur.fetchone()
            span.set_attribute("db.rows_returned", 0 if result is None else 1)
        elif fetch == "all":
            result = await cur.fetchall()
            span.set_attribute("db.rows_returned", len(result))
        else:
            result = None
            span.set_attribute("db.rows_affected", cur.rowcount)
        DB_QUERY_DURATION.observe(time.perf_counter() - start)
        return result


class Db:
    """The seam between a handler and Postgres.

    The application passes the pool's `connection` method. A test passes a
    source that opens a savepoint on one shared connection. Both sources run
    this same class, so a test exercises the same span code that production
    runs.
    """

    def __init__(self, connect: ConnectionSource):
        self._connect = connect

    async def fetch_one(self, sql: str, args: Args = None) -> Row | None:
        """Return the first row, or None. An absent row is a normal answer:
        the caller maps it to 401 or to 404."""
        async with self._connect() as conn:
            return await _run(conn, sql, args, "one")

    async def fetch_all(self, sql: str, args: Args = None) -> list[Row]:
        """Return every row."""
        async with self._connect() as conn:
            return await _run(conn, sql, args, "all")

    async def execute(self, sql: str, args: Args = None) -> None:
        """Run one statement and discard the result. The span records
        `db.rows_affected`, so a DELETE that removes seven rows and a DELETE
        that removes none look different in the trace."""
        async with self._connect() as conn:
            await _run(conn, sql, args, "none")

    @asynccontextmanager
    async def tx(self) -> AsyncIterator["Tx"]:
        """Hold one connection open for several statements.

        Any exception rolls the whole transaction back. This includes an
        HTTPException that a handler raises to answer 403 or 404.

        The span `pg_transaction` is the parent. Each statement inside opens
        a `pg_query` child, so a loop over three tags shows six children and
        the extra round trips become visible.
        """
        with tracer.start_as_current_span("pg_transaction"):
            async with self._connect() as conn:
                yield Tx(conn)


class Tx:
    """The same three verbs, on one connection that stays open."""

    def __init__(self, conn: AsyncConnection):
        self._conn = conn

    async def fetch_one(self, sql: str, args: Args = None) -> Row | None:
        return await _run(self._conn, sql, args, "one")

    async def fetch_all(self, sql: str, args: Args = None) -> list[Row]:
        return await _run(self._conn, sql, args, "all")

    async def execute(self, sql: str, args: Args = None) -> None:
        await _run(self._conn, sql, args, "none")
