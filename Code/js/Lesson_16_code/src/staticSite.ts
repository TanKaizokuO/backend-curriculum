// The TypeScript twin of Code/Lesson_16_code/static_site.py — the static
// origin, http://127.0.0.1:8051. Serves index.html, style.css, and
// script.js from src/static/.
//
//   CSP_MODE=on          add a Content-Security-Policy header to the HTML
//   node src/staticSite.ts    listens on 127.0.0.1:8051, plain HTTP

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 8051;
const CSP_MODE = process.env.CSP_MODE === "on";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "static");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  console.log(`staticSite: ${req.socket.remoteAddress} ${req.method} ${req.url}`);
  const rel = req.url === "/" ? "index.html" : (req.url ?? "").replace(/^\//, "");
  const filePath = path.join(ROOT, rel);
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath);
    const headers: http.OutgoingHttpHeaders = {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": body.length,
      Connection: "close",
    };
    if (CSP_MODE && ext === ".html") {
      headers["Content-Security-Policy"] = "default-src 'self'";
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { Connection: "close" });
    res.end();
  }
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`staticSite listening on http://${LISTEN_HOST}:${LISTEN_PORT} (CSP_MODE=${CSP_MODE})`);
});
