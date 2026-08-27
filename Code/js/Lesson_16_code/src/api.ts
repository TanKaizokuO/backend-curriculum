// The TypeScript twin of Code/Lesson_16_code/api.py — the API origin,
// http://127.0.0.2:8040. Same three environment variables switch on the
// same fixes:
//
//   CORS_ALLOW=on            add Access-Control-* headers for allowed origins
//   COOKIE_SAMESITE=None     set the login cookie's SameSite attribute
//                             (default: Lax)
//   node src/api.ts          listens on 127.0.0.2:8040, plain HTTP

import http from "node:http";

const LISTEN_HOST = "127.0.0.2";
const LISTEN_PORT = 8040;

const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:8051"]);
const CORS_ALLOW = process.env.CORS_ALLOW === "on";
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE ?? "Lax";

const BOOKMARKS = [
  { id: 1, title: "MDN: same-origin policy" },
  { id: 2, title: "MDN: CORS" },
];

function corsHeaders(req: http.IncomingMessage, res: http.ServerResponse, forPreflight: boolean): void {
  if (!CORS_ALLOW) return;
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return;
  // Echo the one calling origin back, never "*" — a wildcard cannot carry
  // Access-Control-Allow-Credentials, and a login flow needs credentials.
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  if (forPreflight) {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function sendJson(req: http.IncomingMessage, res: http.ServerResponse, status: number, payload: unknown, cookie?: string): void {
  const body = JSON.stringify(payload, null, 2);
  corsHeaders(req, res, false);
  if (cookie !== undefined) res.setHeader("Set-Cookie", cookie);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    Connection: "close",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  console.log(`api: ${req.socket.remoteAddress} ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    // The preflight request. A browser sends this by itself, ahead of a
    // request it considers "not simple" — here, a POST with a JSON body.
    corsHeaders(req, res, true);
    res.writeHead(204, { "Content-Length": "0", Connection: "close" });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/bookmarks") {
    sendJson(req, res, 200, { bookmarks: BOOKMARKS });
    return;
  }

  if (req.method === "GET" && req.url === "/whoami") {
    const cookieHeader = req.headers.cookie ?? null;
    sendJson(req, res, 200, {
      originHeader: req.headers.origin ?? null,
      cookieHeader,
      loggedIn: cookieHeader !== null && cookieHeader.includes("session="),
    });
    return;
  }

  if (req.method === "POST" && req.url === "/login") {
    req.on("data", () => {}); // the body is never checked; only its presence matters here
    req.on("end", () => {
      const cookie = `session=demo-session-token; HttpOnly; SameSite=${COOKIE_SAMESITE}; Path=/`;
      sendJson(req, res, 200, { loggedIn: true }, cookie);
    });
    return;
  }

  sendJson(req, res, 404, { error: "not found" });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    `api listening on http://${LISTEN_HOST}:${LISTEN_PORT} (CORS_ALLOW=${CORS_ALLOW}, COOKIE_SAMESITE=${COOKIE_SAMESITE})`,
  );
});
