import asyncio

LISTEN_PORT = 55491
TARGET_PORT = 55490
DELAY = 0.2


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
    print(f"slow link: localhost:{LISTEN_PORT} -> localhost:{TARGET_PORT} (+{DELAY*1000:.0f} ms each way)", flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())
