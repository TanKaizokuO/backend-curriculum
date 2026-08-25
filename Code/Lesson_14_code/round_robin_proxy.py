"""A TCP proxy that spreads connections across two backends, in order.

Lesson 2 built a routing table by hand before naming the framework that
hides it. This is the same move for a load balancer: a real one (Nginx,
Envoy, a cloud load balancer — Lesson 15 covers one) picks a backend with
round robin, least connections, or a hash of the client, and does TLS,
health checks, and retries besides. This proxy does one thing: on each new
connection, it picks the next backend in a fixed cycle and copies bytes in
both directions until either side closes. That is enough to prove what two
instances break and what they do not.

The pick happens once per *connection*, not once per request — the same
way a plain TCP load balancer works, and the reason `bench_rate_limit.py`
opens a fresh connection for every login attempt instead of reusing one.

    python round_robin_proxy.py                # 8022 -> 8020, 8021, 8020, ...
"""

import asyncio
import itertools

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8022
BACKENDS = [("127.0.0.1", 8020), ("127.0.0.1", 8021)]

_next_backend = itertools.cycle(BACKENDS)


async def pump(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    finally:
        writer.close()


async def handle(
    client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter
) -> None:
    host, port = next(_next_backend)
    try:
        backend_reader, backend_writer = await asyncio.open_connection(host, port)
    except OSError as exc:
        print(f"connection -> {host}:{port} failed: {exc}", flush=True)
        client_writer.close()
        return
    print(f"connection -> {host}:{port}", flush=True)
    await asyncio.gather(
        pump(client_reader, backend_writer),
        pump(backend_reader, client_writer),
        return_exceptions=True,
    )


async def main() -> None:
    server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT)
    targets = ", ".join(f"{h}:{p}" for h, p in BACKENDS)
    print(f"round-robin proxy: {LISTEN_HOST}:{LISTEN_PORT} -> {targets}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
