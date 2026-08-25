"""Lesson 11 — the span is not a promise, it is a checked fact.

Lesson 10 named the span inside one handler. Thirteen other handlers reached
the database and named no span, so the trace lied and no test noticed.

These tests read the finished spans and count them. A future handler that
opens its own connection, and skips `db.py`, makes one of these counts wrong.
"""

import pytest
from httpx import AsyncClient


def query_spans(spans) -> list[str]:
    """Return the name of every finished span, in the order they closed."""
    return [span.name for span in spans.get_finished_spans()]


@pytest.mark.anyio
async def test_one_statement_opens_one_span(client: AsyncClient, spans):
    """`GET /bookmarks` runs one statement, so the trace holds one child."""
    spans.clear()

    res = await client.get("/bookmarks")
    assert res.status_code == 200

    names = query_spans(spans)
    assert names.count("pg_query") == 1
    assert names.count("pg_transaction") == 0
    assert "http_request" in names


@pytest.mark.anyio
async def test_every_handler_that_reads_the_database_opens_a_span(
    client: AsyncClient, spans
):
    """The old code traced 1 of 14 round trips. Read a route that Lesson 10
    left untraced, and prove that it now opens a span."""
    await client.post(
        "/auth/register", json={"email": "spans@example.com", "password": "password"}
    )
    await client.post(
        "/auth/login", json={"email": "spans@example.com", "password": "password"}
    )
    spans.clear()

    res = await client.get("/auth/me")
    assert res.status_code == 200

    # `current_user` looks the session up. Lesson 10 named no span here.
    assert query_spans(spans).count("pg_query") == 1


@pytest.mark.anyio
async def test_transaction_holds_one_child_span_for_each_statement(
    client: AsyncClient, spans
):
    """Two tags cost four extra round trips. The trace shows all of them.

    One INSERT for the bookmark, then two statements for each tag. The parent
    span is `pg_transaction`, and the session lookup for `current_user` sits
    outside it.
    """
    await client.post(
        "/auth/register", json={"email": "tags@example.com", "password": "password"}
    )
    await client.post(
        "/auth/login", json={"email": "tags@example.com", "password": "password"}
    )
    spans.clear()

    res = await client.post(
        "/bookmarks",
        json={"url": "https://example.com/tagged", "tags": ["one", "two"]},
    )
    assert res.status_code == 201

    names = query_spans(spans)
    assert names.count("pg_transaction") == 1
    # 1 session lookup + 1 INSERT + 2 statements for each of the 2 tags.
    assert names.count("pg_query") == 6


@pytest.mark.anyio
async def test_span_records_the_statement_and_never_the_parameters(
    client: AsyncClient, spans
):
    """WARNING: a parameter here holds an email address and a password hash.

    The span records the SQL text only. This test fails if somebody adds the
    parameters to a span attribute.
    """
    spans.clear()

    await client.post(
        "/auth/register",
        json={"email": "secret@example.com", "password": "hunter2hunter2"},
    )

    exported = [
        (span.name, dict(span.attributes or {}))
        for span in spans.get_finished_spans()
        if span.name == "pg_query"
    ]
    assert exported, "the register route must open a span"

    for _, attributes in exported:
        assert attributes["db.system"] == "postgresql"
        assert "INSERT INTO users" in attributes["db.statement"]
        blob = repr(attributes)
        assert "secret@example.com" not in blob
        assert "hunter2hunter2" not in blob


@pytest.mark.anyio
async def test_delete_records_the_row_count(client: AsyncClient, spans):
    """`db.execute` records `db.rows_affected`, so a DELETE that removes
    nothing and a DELETE that removes one row look different."""
    await client.post(
        "/auth/register", json={"email": "rows@example.com", "password": "password"}
    )
    await client.post(
        "/auth/login", json={"email": "rows@example.com", "password": "password"}
    )
    res = await client.post("/bookmarks", json={"url": "https://example.com/rows"})
    bookmark_id = res.json()["id"]
    spans.clear()

    res = await client.delete(f"/bookmarks/{bookmark_id}")
    assert res.status_code == 204

    affected = [
        span.attributes["db.rows_affected"]
        for span in spans.get_finished_spans()
        if span.name == "pg_query" and "db.rows_affected" in (span.attributes or {})
    ]
    assert affected == [1]
