"""The ORM writes the lost update for you too.

    export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
    python orm_increment.py          # the counts
    python orm_increment.py --echo   # one increment of each kind, with its SQL

`bookmark.visit_count += 1` is a read in Python and a write in Python. It is
the read-modify-write of lost_update.py, spelled as an attribute assignment.
"""

import os
import sys
import threading
import time

from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from orm_models import Bookmark

ECHO = "--echo" in sys.argv
BOOKMARK_ID = 1
WORKERS = 20
BUMPS = 10
EXPECTED = WORKERS * BUMPS

URL = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(URL, echo=ECHO)


def attribute_assignment(session):
    """Idiomatic ORM, and wrong. Two statements: SELECT then UPDATE SET = value."""
    bookmark = session.get(Bookmark, BOOKMARK_ID)
    bookmark.visit_count += 1
    session.commit()


def locked_attribute(session):
    """The same object, but the SELECT carries FOR UPDATE."""
    bookmark = session.scalars(
        select(Bookmark).where(Bookmark.id == BOOKMARK_ID).with_for_update()
    ).one()
    bookmark.visit_count += 1
    session.commit()


def core_update(session):
    """One statement. The addition happens in PostgreSQL, not in Python."""
    session.execute(
        update(Bookmark)
        .where(Bookmark.id == BOOKMARK_ID)
        .values(visit_count=Bookmark.visit_count + 1)
    )
    session.commit()


def worker(strategy):
    with Session(engine) as session:          # one session per thread
        for _ in range(BUMPS):
            strategy(session)


def run(label, strategy):
    with Session(engine) as session:
        session.execute(
            update(Bookmark).where(Bookmark.id == BOOKMARK_ID).values(visit_count=0)
        )
        session.commit()

    threads = [threading.Thread(target=worker, args=(strategy,))
               for _ in range(WORKERS)]
    start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = (time.perf_counter() - start) * 1000

    with Session(engine) as session:
        final = session.get(Bookmark, BOOKMARK_ID).visit_count

    verdict = "correct" if final == EXPECTED else f"LOST {EXPECTED - final}"
    print(f"{label:<22} {final:>4} / {EXPECTED}   {elapsed:7.1f} ms   {verdict}")


if ECHO:
    for label, strategy in [("attribute assignment", attribute_assignment),
                            ("with_for_update", locked_attribute),
                            ("core update", core_update)]:
        print(f"\n===== {label} =====")
        with Session(engine) as session:
            strategy(session)
else:
    print(f"{WORKERS} threads, {BUMPS} increments each, expected {EXPECTED}\n")
    run("attribute assignment", attribute_assignment)
    run("with_for_update", locked_attribute)
    run("core update", core_update)
