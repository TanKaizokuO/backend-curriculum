"""Lesson 12's first observable failure, and its fix.

The account exists once; every run reuses it.

    python bench_rate_limit.py --register

Direct against one instance, `RATE_LIMIT_BACKEND=local`:

    RATE_LIMIT_BACKEND=local uvicorn main:app --port 8020
    python bench_rate_limit.py --flush --base-url http://127.0.0.1:8020

Through the proxy, two instances, still `local`:

    RATE_LIMIT_BACKEND=local uvicorn main:app --port 8020   # terminal 1
    RATE_LIMIT_BACKEND=local uvicorn main:app --port 8021   # terminal 2
    python round_robin_proxy.py                              # terminal 3
    python bench_rate_limit.py --flush --base-url http://127.0.0.1:8022

Fixed, same two instances, `redis`:

    RATE_LIMIT_BACKEND=redis uvicorn main:app --port 8020
    RATE_LIMIT_BACKEND=redis uvicorn main:app --port 8021
    python round_robin_proxy.py
    python bench_rate_limit.py --flush --base-url http://127.0.0.1:8022

Every login attempt opens a fresh connection (`httpx.post`, not a reused
`Client`), so the proxy round-robins each one separately, the way it would
round-robin separate browsers.
"""

import argparse

import httpx
import redis

EMAIL = "scaling-demo@example.com"
PASSWORD = "correct horse battery staple"
ATTEMPTS = 14


def register(base_url: str) -> None:
    response = httpx.post(f"{base_url}/auth/register", json={"email": EMAIL, "password": PASSWORD})
    print(f"register -> {response.status_code} ({response.json().get('detail', 'created')})")


def flush() -> None:
    """Clear both backends' state for 127.0.0.1 so a run starts from zero.
    The Redis key is `rate_limit.py`'s; the local dict lives inside each
    uvicorn process and only clears when that process restarts."""
    client = redis.Redis.from_url("redis://localhost:6379/0")
    deleted = client.delete("login_attempts:127.0.0.1")
    print(f"flushed Redis key login_attempts:127.0.0.1 (existed: {bool(deleted)})")


def run(base_url: str) -> None:
    first_429 = None
    for attempt in range(1, ATTEMPTS + 1):
        response = httpx.post(f"{base_url}/auth/login", json={"email": EMAIL, "password": PASSWORD})
        print(f"attempt {attempt:2d} -> {response.status_code}")
        if response.status_code == 429 and first_429 is None:
            first_429 = attempt
    print()
    if first_429:
        print(f"first 429 at attempt {first_429}")
    else:
        print(f"no 429 in {ATTEMPTS} attempts")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8020")
    parser.add_argument("--register", action="store_true")
    parser.add_argument("--flush", action="store_true")
    args = parser.parse_args()
    if args.register:
        register(args.base_url)
    else:
        if args.flush:
            flush()
        run(args.base_url)
