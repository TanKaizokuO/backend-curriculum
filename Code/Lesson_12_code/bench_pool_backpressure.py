"""Lesson 12's second observable failure, and its fix.

Every instance shares one database, and a database has a hard ceiling on
how many clients it accepts at once (`max_connections`). Two instances that
each size their own pool without regard to that ceiling can ask for more
connections than the database will ever hand out.

Set up a database small enough to hit that ceiling on a laptop, and a slow
link so a query holds its connection long enough for a burst of requests to
collide:

    docker run -d --name pg-lesson12-small -p 55490:5432 \\
      -e POSTGRES_USER=learner -e POSTGRES_PASSWORD=lesson4 -e POSTGRES_DB=bookmarks \\
      postgres:17 -c max_connections=15
    DATABASE_URL=postgresql://learner:lesson4@localhost:55490/bookmarks python migrate.py
    python slow_link_small_db.py                 # 55491 -> 55490, +200 ms each way

Two instances, oversubscribed, a long acquire timeout ("broken"):

    DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \\
      POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 uvicorn main:app --port 8020
    DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \\
      POOL_MAX_SIZE=10 POOL_ACQUIRE_TIMEOUT_SECONDS=30 uvicorn main:app --port 8021
    python bench_pool_backpressure.py --burst 50

Two instances, right-sized, a short acquire timeout ("fixed"):

    DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \\
      POOL_MAX_SIZE=7 POOL_ACQUIRE_TIMEOUT_SECONDS=3 uvicorn main:app --port 8020
    DATABASE_URL=postgresql://learner:lesson4@localhost:55491/bookmarks \\
      POOL_MAX_SIZE=7 POOL_ACQUIRE_TIMEOUT_SECONDS=3 uvicorn main:app --port 8021
    python bench_pool_backpressure.py --burst 50
"""

import argparse
import asyncio
import time
from collections import Counter

import httpx

INSTANCES = ["http://127.0.0.1:8020/bookmarks", "http://127.0.0.1:8021/bookmarks"]


async def one(client: httpx.AsyncClient, url: str) -> tuple[str, float]:
    start = time.perf_counter()
    try:
        response = await client.get(url, timeout=35.0)
        return (str(response.status_code), time.perf_counter() - start)
    except httpx.HTTPError as exc:
        return (f"ERR:{type(exc).__name__}", time.perf_counter() - start)


async def run(requests_per_instance: int) -> None:
    urls = [url for url in INSTANCES for _ in range(requests_per_instance)]
    async with httpx.AsyncClient() as client:
        start = time.perf_counter()
        results = await asyncio.gather(*[one(client, url) for url in urls])
        total = time.perf_counter() - start

    outcomes = Counter(status for status, _ in results)
    latencies = sorted(elapsed for _, elapsed in results)
    p50 = latencies[len(latencies) // 2]
    p90 = latencies[int(len(latencies) * 0.9)]

    print(f"{len(urls)} requests across {len(INSTANCES)} instances")
    print("status counts:", dict(outcomes))
    print(f"wall time: {total:.2f}s")
    print(f"latency  : min {latencies[0]:.2f}s  p50 {p50:.2f}s  p90 {p90:.2f}s  max {latencies[-1]:.2f}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--burst", type=int, default=50, help="requests sent to EACH instance")
    args = parser.parse_args()
    asyncio.run(run(args.burst))
