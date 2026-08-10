"""Apply every .sql file in migrations/ that has not been applied yet."""
import os
import pathlib
import psycopg

DSN = os.environ["DATABASE_URL"]
MIGRATIONS = pathlib.Path(__file__).parent / "migrations"

with psycopg.connect(DSN) as conn:
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
