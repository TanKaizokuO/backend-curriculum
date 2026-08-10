/**
 * A TCP proxy that adds a fixed delay to every message.
 *
 * Your database is on localhost, where one round trip measures about 80
 * microseconds. In production the database is on another machine and a round
 * trip costs about 1 millisecond. That is roughly 12 times more, and N+1 pays
 * it N times.
 *
 * This proxy puts the production number on your laptop. Run it in one terminal:
 *
 *     node slow_link.js            # listens on 55433, forwards to 55432
 *
 * Then point the application at the slow port:
 *
 *     export SLOW_URL="postgresql://learner:lesson4@localhost:55433/bookmarks"
 */

const net = require('net');

const LISTEN_PORT = 55433;
const TARGET_PORT = 55432;
const DELAY_MS = 1; // 1 ms delay added to each chunk in each direction

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const server = net.createServer(clientSocket => {
  const targetSocket = net.connect(TARGET_PORT, 'localhost');

  clientSocket.on('data', async chunk => {
    clientSocket.pause();
    await delay(DELAY_MS);
    targetSocket.write(chunk);
    clientSocket.resume();
  });

  targetSocket.on('data', async chunk => {
    targetSocket.pause();
    await delay(DELAY_MS);
    clientSocket.write(chunk);
    targetSocket.resume();
  });

  clientSocket.on('error', () => targetSocket.destroy());
  targetSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('close', () => targetSocket.end());
  targetSocket.on('close', () => clientSocket.end());
});

server.listen(LISTEN_PORT, 'localhost', () => {
  console.log(
    `slow link: localhost:${LISTEN_PORT} -> localhost:${TARGET_PORT} (+${DELAY_MS} ms each way)`
  );
});
