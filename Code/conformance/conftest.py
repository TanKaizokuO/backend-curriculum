"""Run each track's server once per session, capture the whole corpus's
answers, and hand both recordings to every test.

Python and TypeScript share one Postgres and one Redis. They cannot run at
once against the same schema and the same cache, so this fixture runs
Python to completion, records its answers, tears it down, resets the
schema and flushes the cache, then runs TypeScript the same way. Without
the flush, a key a previous run's search left in Redis — real Redis, which
outlives the process that wrote it, unlike the in-memory test double —
would answer the next run's first search as a hit. A conformance test
compares the two recordings; it never talks to a live server itself.
"""

import os
import subprocess
import time
from pathlib import Path

import httpx
import psycopg
import pytest
import redis

from scenarios import FLOWS

ROOT = Path(__file__).resolve().parents[2]
PY_DIR = ROOT / "Code" / "Lesson_11_code"
TS_DIR = ROOT / "Code" / "js" / "Lesson_11_code"

DATABASE_URL = "postgresql://testuser:testpassword@127.0.0.1:5432/testdb"
REDIS_URL = "redis://127.0.0.1:6379"
SECRET_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef"


def _reset_schema() -> None:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    redis.Redis.from_url(REDIS_URL).flushall()


def _wait_until_ready(url: str, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            if httpx.get(url, timeout=1.0).status_code < 500:
                return
        except httpx.HTTPError as exc:
            last_error = exc
        time.sleep(0.2)
    raise RuntimeError(f"{url} never answered before the timeout: {last_error}")


def _run_track(
    *, migrate_cmd: list[str], server_cmd: list[str], cwd: Path, port: int, env: dict[str, str],
) -> dict[str, list[dict]]:
    full_env = {**os.environ, **env}
    _reset_schema()
    subprocess.run(migrate_cmd, cwd=cwd, env=full_env, check=True, capture_output=True)

    # A pipe nobody reads fills up and blocks the child's next `write()`
    # forever. `uvicorn`'s access log and `db.py`'s JSON lines write enough
    # of them that a `PIPE` deadlocks partway through the corpus. A log
    # file has no such limit.
    log_path = cwd / f".conformance-{port}.log"
    with open(log_path, "wb") as log_file:
        proc = subprocess.Popen(server_cmd, cwd=cwd, env=full_env, stdout=log_file, stderr=subprocess.STDOUT)
        try:
            base_url = f"http://127.0.0.1:{port}"
            _wait_until_ready(f"{base_url}/healthz")
            with httpx.Client(base_url=base_url) as client:
                return {name: flow(client) for name, flow in FLOWS.items()}
        except Exception:
            print(log_path.read_text(errors="replace"))
            raise
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
            log_path.unlink(missing_ok=True)


@pytest.fixture(scope="session")
def recordings() -> dict[str, dict[str, list[dict]]]:
    shared_env = {
        "DATABASE_URL": DATABASE_URL,
        "REDIS_URL": REDIS_URL,
        "SECRET_KEY": SECRET_KEY,
        "BCRYPT_ROUNDS": "4",
    }

    python_results = _run_track(
        migrate_cmd=[str(PY_DIR / ".venv" / "bin" / "python"), "migrate.py"],
        server_cmd=[str(PY_DIR / ".venv" / "bin" / "python"), "-m", "uvicorn", "main:app", "--port", "8211"],
        cwd=PY_DIR,
        port=8211,
        env=shared_env,
    )
    ts_results = _run_track(
        migrate_cmd=["node", "src/migrate.ts"],
        server_cmd=["node", "src/server.ts"],
        cwd=TS_DIR,
        port=8212,
        env={**shared_env, "PORT": "8212"},
    )
    return {"python": python_results, "typescript": ts_results}
