"""Apply every .sql file in migrations/ that has not been applied yet.

Lesson 4 wrote this runner. Lesson 7 changes one thing: the runner now lives
in the container image, and the platform calls it as a release step, before
the new version of the API starts.

    python migrate.py

The runner is idempotent. It reads `schema_migrations`, skips what it finds,
and applies the rest in one transaction each. Run it on every deploy.
"""

import pathlib

import psycopg

from config import settings

MIGRATIONS = pathlib.Path(__file__).parent / "migrations"

with psycopg.connect(settings.dsn) as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    conn.commit()

    rows = conn.execute("SELECT version FROM schema_migrations")
    applied = {v for (v,) in rows}

    for path in sorted(MIGRATIONS.glob("*.sql")):
        version = path.stem
        if version in applied:
            print(f"skip    {version}")
            continue
        with conn.transaction():                     # all-or-nothing
            conn.execute(path.read_text())
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)",
                         (version,))
        print(f"applied {version}")
