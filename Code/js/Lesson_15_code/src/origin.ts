// The TypeScript twin of Code/Lesson_15_code/origin.py — the origin
// server, standing in for the Lesson 12 / Lesson 14 API. It only reports
// what it received, so a proxy's effect on the request stays visible.
//
//   node src/origin.ts        # listens on 127.0.0.1:8030, plain HTTP

import http from "node:http";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 8030;

const server = http.createServer((req, res) => {
  console.log(`origin: ${req.socket.remoteAddress} ${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/whoami") {
    const body = JSON.stringify(
      {
        socketPeer: req.socket.remoteAddress,
        hostHeader: req.headers.host ?? null,
        xForwardedFor: req.headers["x-forwarded-for"] ?? null,
        xForwardedProto: req.headers["x-forwarded-proto"] ?? null,
        xRealIp: req.headers["x-real-ip"] ?? null,
      },
      null,
      2,
    );
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Connection: "close",
    });
    res.end(body);
    return;
  }

  if (req.method === "POST" && req.url === "/upload") {
    let received = 0;
    req.on("data", (chunk: Buffer) => {
      received += chunk.length; // drain the body; the size is the point
    });
    req.on("end", () => {
      const body = JSON.stringify({ receivedBytes: received });
      res.writeHead(201, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Connection: "close",
      });
      res.end(body);
    });
    return;
  }

  res.writeHead(404, { Connection: "close" });
  res.end();
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`origin listening on http://${LISTEN_HOST}:${LISTEN_PORT} (plain HTTP, no TLS)`);
});
