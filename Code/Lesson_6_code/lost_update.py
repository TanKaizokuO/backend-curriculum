"""Four ways to count a visit. One of them loses writes.

    export DATABASE_URL="postgresql://learner:lesson4@localhost:55432/bookmarks"
    python lost_update.py

WORKERS threads each add 1 to bookmarks.visit_count, BUMPS times. The correct
answer is always WORKERS * BUMPS. Only the first strategy gets it wrong, and
it gets it wrong silently.
"""

import os
import threading
import time

import psycopg
from psycopg import errors

DSN = os.environ["DATABASE_URL"]
BOOKMARK_ID = 1
WORKERS = 20
BUMPS = 10
EXPECTED = WORKERS * BUMPS

retries = 0
retries_lock = threading.Lock()


def read_modify_write(conn):
    """Read in Python, add 1 in Python, write back. This loses updates."""
    with conn.transaction():
        row = conn.execute(
            "SELECT visit_count FROM bookmarks WHERE id = %s", (BOOKMARK_ID,)
        ).fetchone()
        conn.execute(
            "UPDATE bookmarks SET visit_count = %s WHERE id = %s",
            (row[0] + 1, BOOKMARK_ID),
        )


def select_for_update(conn):
    """The same shape, but the read takes a row lock. The second reader waits."""
    with conn.transaction():
        row = conn.execute(
            "SELECT visit_count FROM bookmarks WHERE id = %s FOR UPDATE",
            (BOOKMARK_ID,),
        ).fetchone()
        conn.execute(
            "UPDATE bookmarks SET visit_count = %s WHERE id = %s",
            (row[0] + 1, BOOKMARK_ID),
        )


def one_statement(conn):
    """No read at all. PostgreSQL reads and writes the row in one step."""
    with conn.transaction():
        conn.execute(
            "UPDATE bookmarks SET visit_count = visit_count + 1 WHERE id = %s",
            (BOOKMARK_ID,),
        )


def repeatable_read(conn):
    """Let the database refuse the write, then retry the whole transaction."""
    global retries
    while True:
        try:
            with conn.transaction():
                conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                row = conn.execute(
                    "SELECT visit_count FROM bookmarks WHERE id = %s",
                    (BOOKMARK_ID,),
                ).fetchone()
                conn.execute(
                    "UPDATE bookmarks SET visit_count = %s WHERE id = %s",
                    (row[0] + 1, BOOKMARK_ID),
                )
            return
        except errors.SerializationFailure:
            with retries_lock:
                retries += 1


def worker(strategy):
    with psycopg.connect(DSN) as conn:       # one connection per thread
        for _ in range(BUMPS):
            strategy(conn)


def run(label, strategy):
    global retries
    retries = 0
    with psycopg.connect(DSN) as conn:
        conn.execute(
            "UPDATE bookmarks SET visit_count = 0 WHERE id = %s", (BOOKMARK_ID,)
        )
        conn.commit()

    threads = [threading.Thread(target=worker, args=(strategy,))
               for _ in range(WORKERS)]
    start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = (time.perf_counter() - start) * 1000

    with psycopg.connect(DSN) as conn:
        final = conn.execute(
            "SELECT visit_count FROM bookmarks WHERE id = %s", (BOOKMARK_ID,)
        ).fetchone()[0]

    verdict = "correct" if final == EXPECTED else f"LOST {EXPECTED - final}"
    print(f"{label:<22} {final:>4} / {EXPECTED}   {elapsed:7.1f} ms"
          f"   {retries:>3} retries   {verdict}")


print(f"{WORKERS} threads, {BUMPS} increments each, expected {EXPECTED}\n")
run("read-modify-write", read_modify_write)
run("SELECT FOR UPDATE", select_for_update)
run("one statement", one_statement)
run("REPEATABLE READ + retry", repeatable_read)
