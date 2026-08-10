"""A TCP proxy that adds a fixed delay to every message.

Your database is on localhost, so a round trip costs about 40 microseconds.
In production the database is on another machine and a round trip costs about
1 millisecond. That is 25 times more, and N+1 pays it N times.

This proxy puts the production number on your laptop. Run it in one terminal:

    python slow_link.py            # listens on 55433, forwards to 55432

Then point the application at the slow port:

    export SLOW_URL="postgresql://learner:lesson4@localhost:55433/bookmarks"
"""

import asyncio

LISTEN_PORT = 55433
TARGET_PORT = 55432
DELAY = 0.001  # seconds added to each message in each direction


async def pump(reader, writer):
    while data := await reader.read(65536):
        await asyncio.sleep(DELAY)
        writer.write(data)
        await writer.drain()
    writer.close()


async def handle(client_reader, client_writer):
    db_reader, db_writer = await asyncio.open_connection("localhost", TARGET_PORT)
    await asyncio.gather(
        pump(client_reader, db_writer),
        pump(db_reader, client_writer),
        return_exceptions=True,
    )


async def main():
    server = await asyncio.start_server(handle, "localhost", LISTEN_PORT)
    print(f"slow link: localhost:{LISTEN_PORT} -> localhost:{TARGET_PORT}"
          f"  (+{DELAY * 1000:.0f} ms each way)", flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())
