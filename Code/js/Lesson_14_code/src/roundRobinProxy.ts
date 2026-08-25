/**
 * The TypeScript twin of `Code/Lesson_12_code/round_robin_proxy.py`. A TCP
 * proxy does not care what language is listening on the other end, so
 * either twin can front either stack's instances — this one exists so the
 * TypeScript project stays runnable on its own.
 *
 * On each new connection, picks the next backend in a fixed cycle and
 * copies bytes in both directions until either side closes. The pick
 * happens once per *connection*, not once per request.
 *
 *     node src/roundRobinProxy.ts        # 8032 -> 8030, 8031, 8030, ...
 */

import net from 'node:net';

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 8032;
const BACKENDS: Array<[string, number]> = [
  ['127.0.0.1', 8030],
  ['127.0.0.1', 8031],
];

let nextIndex = 0;

const server = net.createServer((client) => {
  const [host, port] = BACKENDS[nextIndex]!;
  nextIndex = (nextIndex + 1) % BACKENDS.length;

  const backend = net.connect({ host, port }, () => {
    console.log(`connection -> ${host}:${port}`);
    client.pipe(backend);
    backend.pipe(client);
  });
  backend.on('error', (error) => {
    console.log(`connection -> ${host}:${port} failed: ${error.message}`);
    client.destroy();
  });
  client.on('error', () => backend.destroy());
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  const targets = BACKENDS.map(([h, p]) => `${h}:${p}`).join(', ');
  console.log(`round-robin proxy: ${LISTEN_HOST}:${LISTEN_PORT} -> ${targets}`);
});
