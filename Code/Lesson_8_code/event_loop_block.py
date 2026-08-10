"""What one slow hash on the event loop does to every other request.

Start the API first:

    uvicorn main:app --port 8008

Then:

    python event_loop_block.py

The program sends ten logins at the same time, and while they run it asks
`/healthz` twenty times. `/healthz` costs one `SELECT 1`. Any millisecond
above that comes from the login handler.

    /auth/login           hashes in a worker thread
    /auth/login-blocking  hashes on the event loop

Same password check. Same database. One number changes.
"""

import asyncio
import statistics
import time

import httpx

BASE = "http://localhost:8008"
EMAIL = "ada@example.com"
WRONG = "not the password at all"
LOGINS = 10
PROBES = 20


async def flood(client: httpx.AsyncClient, path: str) -> float:
    start = time.perf_counter()
    await asyncio.gather(*[
        client.post(path, json={"email": EMAIL, "password": WRONG})
        for _ in range(LOGINS)
    ])
    return (time.perf_counter() - start) * 1000


async def probe(client: httpx.AsyncClient) -> list[float]:
    samples = []
    for _ in range(PROBES):
        start = time.perf_counter()
        await client.get("/healthz")
        samples.append((time.perf_counter() - start) * 1000)
        await asyncio.sleep(0.01)
    return samples


async def measure(path: str) -> tuple[float, list[float]]:
    async with httpx.AsyncClient(base_url=BASE, timeout=60) as client:
        await client.get("/healthz")                    # warm the pool
        flooding = asyncio.create_task(flood(client, path))
        probing = asyncio.create_task(probe(client))
        return await flooding, await probing


async def main() -> None:
    async with httpx.AsyncClient(base_url=BASE, timeout=10) as client:
        for _ in range(3):
            await client.get("/healthz")            # warm the pool
        start = time.perf_counter()
        for _ in range(20):
            await client.get("/healthz")
        baseline = (time.perf_counter() - start) * 1000 / 20

    print(f"/healthz with nothing else running : {baseline:.1f} ms")
    print(f"\n{LOGINS} logins at once, {PROBES} health checks during them\n")
    print(f"{'login route':24} {'logins total':>13} {'/healthz p50':>13} {'/healthz max':>13}")

    for path in ("/auth/login-blocking", "/auth/login"):
        total, samples = await measure(path)
        print(
            f"{path:24} {total:10.0f} ms {statistics.median(samples):10.1f} ms "
            f"{max(samples):10.1f} ms"
        )

    print("\nThe blocking route also serialises the logins themselves:")
    print("one event loop runs one bcrypt at a time. The worker threads do not.")


if __name__ == "__main__":
    asyncio.run(main())
