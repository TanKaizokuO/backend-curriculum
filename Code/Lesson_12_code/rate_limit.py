"""Login attempt limiting, two ways.

`local_limiter` counts attempts in a dict that lives inside this one Python
process. It is correct behind one instance and silently wrong behind more
than one, because a second instance starts counting from zero in a dict of
its own. See Lesson 12: `bench_rate_limit.py` measures the gap.

`redis_limiter` counts attempts in Redis, a store every instance points at.
The count means the same thing no matter which instance answers the
request, because there is only one counter, not one per process.
"""

import time

from redis.asyncio import Redis

LOGIN_ATTEMPT_LIMIT = 5
LOGIN_ATTEMPT_WINDOW_SECONDS = 60

# Process-local state. Lost on restart, and never seen by another process.
_local_attempts: dict[str, list[float]] = {}


def local_limiter(client_ip: str) -> bool:
    """Return True if the request may proceed. A sliding window kept in
    this process's memory: drop attempts older than the window, then count
    what is left."""
    now = time.monotonic()
    window_start = now - LOGIN_ATTEMPT_WINDOW_SECONDS
    attempts = [t for t in _local_attempts.get(client_ip, []) if t > window_start]
    attempts.append(now)
    _local_attempts[client_ip] = attempts
    return len(attempts) <= LOGIN_ATTEMPT_LIMIT


async def redis_limiter(redis: Redis, client_ip: str) -> bool:
    """Return True if the request may proceed. A fixed window kept in
    Redis, shared by every process that points at the same server.

    `INCR` on a missing key creates it at 1 and is atomic, so two instances
    that both read "4" a moment apart still each get a distinct, correct
    next count — one becomes 5, the other 6 — instead of both writing 5.
    `EXPIRE` is set only when this call created the key (`count == 1`), so a
    slow request from an instance that lost a race never resets a window
    another instance already started.
    """
    key = f"login_attempts:{client_ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, LOGIN_ATTEMPT_WINDOW_SECONDS)
    return count <= LOGIN_ATTEMPT_LIMIT
