"""Measure the N+1 problem against the real database.

    export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
    python n_plus_1.py

Both functions return exactly the same data. Only the number of round trips
to PostgreSQL is different.
"""

import os
import time

import psycopg
from psycopg.rows import dict_row

DSN = os.environ["DATABASE_URL"]
PAGE = 100


def with_n_plus_1(conn):
    """1 query for the page, then 1 more query per row. N+1 queries."""
    cur = conn.cursor(row_factory=dict_row)
    cur.execute(
        "SELECT id, url, title FROM bookmarks ORDER BY id LIMIT %s", (PAGE,)
    )
    rows = cur.fetchall()
    for row in rows:                      # <- the bug is this loop
        cur.execute(
            "SELECT t.name FROM tags t"
            " JOIN bookmark_tags bt ON bt.tag_id = t.id"
            " WHERE bt.bookmark_id = %s ORDER BY t.name",
            (row["id"],),
        )
        row["tags"] = [r["name"] for r in cur.fetchall()]
    return rows, 1 + len(rows)


def with_one_query(conn):
    """The same result in 1 query. The join happens inside PostgreSQL."""
    cur = conn.cursor(row_factory=dict_row)
    cur.execute(
        """
        SELECT b.id, b.url, b.title,
               coalesce(array_agg(t.name ORDER BY t.name)
                        FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
        FROM (SELECT id, url, title FROM bookmarks ORDER BY id LIMIT %s) b
        LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
        LEFT JOIN tags t           ON t.id = bt.tag_id
        GROUP BY b.id, b.url, b.title
        ORDER BY b.id
        """,
        (PAGE,),
    )
    return cur.fetchall(), 1


def time_it(label, fn, conn):
    fn(conn)                                    # warm up, ignore the result
    start = time.perf_counter()
    rows, queries = fn(conn)
    elapsed = (time.perf_counter() - start) * 1000
    print(f"{label:<14} {elapsed:7.1f} ms   {queries:>4} queries"
          f"   {len(rows)} rows   first tags: {rows[0]['tags']}")
    return elapsed


with psycopg.connect(DSN) as conn:
    slow = time_it("N+1", with_n_plus_1, conn)
    fast = time_it("single query", with_one_query, conn)
    print(f"\nthe join is {slow / fast:.0f}x faster")
