"""Lesson 12's third observable failure: a read replica is a copy, and a
copy can be behind.

Set up a primary and a streaming replica — two isolated containers, not the
shared `pg-bookmarks` the rest of this course uses:

    docker network create lesson12-net
    docker volume create pg12-replica-data

    docker run -d --name pg12-primary --network lesson12-net -p 55492:5432 \\
      -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_HOST_AUTH_METHOD=trust \\
      postgres:17 -c wal_level=replica -c max_wal_senders=5 -c hot_standby=on
    docker exec pg12-primary bash -c \\
      "echo 'host replication all all trust' >> /var/lib/postgresql/data/pg_hba.conf"
    docker exec pg12-primary psql -U postgres -c "SELECT pg_reload_conf();"
    docker exec pg12-primary psql -U postgres -c "CREATE DATABASE bookmarks;"

    docker run --rm --network lesson12-net -v pg12-replica-data:/var/lib/postgresql/data \\
      postgres:17 bash -c "PGPASSWORD=lesson4 pg_basebackup -h pg12-primary -U postgres \\
        -D /var/lib/postgresql/data -Fp -Xs -P -R && chmod 700 /var/lib/postgresql/data"

    docker run -d --name pg12-replica --network lesson12-net -p 55493:5432 \\
      -v pg12-replica-data:/var/lib/postgresql/data \\
      -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17

    DATABASE_URL=postgresql://postgres:lesson4@localhost:55492/bookmarks python migrate.py

Then:

    python replica_lag_bench.py
"""

import time

import psycopg

PRIMARY_DSN = "postgresql://postgres:lesson4@localhost:55492/bookmarks"
REPLICA_DSN = "postgresql://postgres:lesson4@localhost:55493/bookmarks"
POLL_INTERVAL_SECONDS = 0.001
POLL_TIMEOUT_SECONDS = 10


def measure_replication_lag(primary: psycopg.Connection, replica: psycopg.Connection) -> None:
    """Write a row on the primary. Poll the replica until it appears. Both
    connections are already open before the write, so the measured gap is
    replication lag, not connection setup — the same reason Lesson 5's
    benchmarks opened connections before timing a query."""
    title = f"replica lag demo {time.time_ns()}"
    write_start = time.perf_counter()
    row = primary.execute(
        "INSERT INTO bookmarks (url, title) VALUES (%s, %s) RETURNING id",
        (f"https://example.com/replica-lag-{time.time_ns()}", title),
    ).fetchone()
    bookmark_id = row[0]

    deadline = write_start + POLL_TIMEOUT_SECONDS
    polls = 0
    while time.perf_counter() < deadline:
        polls += 1
        found = replica.execute(
            "SELECT 1 FROM bookmarks WHERE id = %s", (bookmark_id,)
        ).fetchone()
        if found:
            lag = time.perf_counter() - write_start
            print(f"row visible on the replica after {lag * 1000:.2f} ms ({polls} polls)")
            return
        time.sleep(POLL_INTERVAL_SECONDS)
    print(f"row still not visible after {POLL_TIMEOUT_SECONDS}s — replication is stuck")


def demonstrate_paused_replica_staleness() -> None:
    """Pause WAL replay on the replica — the same effect a slow network
    link or an overloaded replica produces on its own. Write on the
    primary, read the stale answer from the paused replica, then resume and
    read the fresh one."""
    with psycopg.connect(REPLICA_DSN, autocommit=True) as replica:
        replica.execute("SELECT pg_wal_replay_pause()")
        print("paused WAL replay on the replica")

        with psycopg.connect(PRIMARY_DSN, autocommit=True) as primary:
            row = primary.execute(
                "INSERT INTO bookmarks (url, title) VALUES (%s, %s) RETURNING id",
                (f"https://example.com/paused-{time.time_ns()}", "written while paused"),
            ).fetchone()
            bookmark_id = row[0]
        print(f"inserted bookmark {bookmark_id} on the primary")

        found = replica.execute(
            "SELECT 1 FROM bookmarks WHERE id = %s", (bookmark_id,)
        ).fetchone()
        print(f"replica sees it while paused: {found is not None}  <- stale read")

        replica.execute("SELECT pg_wal_replay_resume()")
        print("resumed WAL replay")

        deadline = time.perf_counter() + POLL_TIMEOUT_SECONDS
        while time.perf_counter() < deadline:
            found = replica.execute(
                "SELECT 1 FROM bookmarks WHERE id = %s", (bookmark_id,)
            ).fetchone()
            if found:
                print("replica sees it now: True  <- caught up")
                return
            time.sleep(POLL_INTERVAL_SECONDS)
        print("replica never caught up within the timeout")


if __name__ == "__main__":
    print("--- 1. ordinary replication lag ---------------------------------")
    with (
        psycopg.connect(PRIMARY_DSN, autocommit=True) as primary_conn,
        psycopg.connect(REPLICA_DSN, autocommit=True) as replica_conn,
    ):
        for _ in range(5):
            measure_replication_lag(primary_conn, replica_conn)

    print("\n--- 2. a paused replica is a stale replica ----------------------")
    demonstrate_paused_replica_staleness()
