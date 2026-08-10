"""The ORM writes Lesson 5's N+1 bug for you. Count the queries and see it.

    export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
    python orm_n_plus_1.py          # counts only
    python orm_n_plus_1.py --echo   # print every statement SQLAlchemy sends

Three loader strategies, identical Python at the call site, identical output.
The only difference is the number of round trips.
"""

import os
import sys
import time

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, joinedload, selectinload

from orm_models import Bookmark

ECHO = "--echo" in sys.argv
PAGE = 10 if ECHO else 100

# SQLAlchemy speaks to PostgreSQL through psycopg 3 when you say "postgresql+psycopg".
URL = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(URL, echo=ECHO)

queries = 0


@event.listens_for(engine, "before_cursor_execute")
def count(conn, cursor, statement, parameters, context, executemany):
    global queries
    queries += 1


def lazy(session):
    """The default. bookmark.tags fires one SELECT for each bookmark."""
    rows = session.scalars(select(Bookmark).order_by(Bookmark.id).limit(PAGE)).all()
    return [(b.title, [t.name for t in b.tags]) for b in rows]


def with_selectinload(session):
    """One SELECT for the bookmarks, one more with WHERE id IN (...) for the tags."""
    rows = session.scalars(
        select(Bookmark)
        .options(selectinload(Bookmark.tags))
        .order_by(Bookmark.id)
        .limit(PAGE)
    ).all()
    return [(b.title, [t.name for t in b.tags]) for b in rows]


def with_joinedload(session):
    """One SELECT with a LEFT OUTER JOIN. Needs unique() to fold the join rows."""
    rows = session.scalars(
        select(Bookmark)
        .options(joinedload(Bookmark.tags))
        .order_by(Bookmark.id)
        .limit(PAGE)
    ).unique().all()
    return [(b.title, [t.name for t in b.tags]) for b in rows]


def time_it(label, fn):
    global queries
    with Session(engine) as session:          # a fresh session: nothing cached
        queries = 0
        start = time.perf_counter()
        rows = fn(session)
        elapsed = (time.perf_counter() - start) * 1000
    print(f"{label:<14} {elapsed:7.1f} ms   {queries:>4} queries   {len(rows)} rows"
          f"   first tags: {rows[0][1]}")
    return elapsed


print(f"page of {PAGE} bookmarks\n")
slow = time_it("lazy (default)", lazy)
fast = time_it("selectinload", with_selectinload)
join = time_it("joinedload", with_joinedload)
print(f"\nselectinload is {slow / fast:.0f}x faster than the default")
