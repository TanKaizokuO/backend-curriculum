"""The static origin: http://127.0.0.1:8051.

A second origin, on a different port from api.py, serving one HTML page and
one script file. Nothing here talks to a database; the point is only that
this origin's scheme, host, and port differ from the API's, which is enough
to make the browser treat every request between them as cross-origin.

    CSP_MODE=on    add a Content-Security-Policy header to the HTML response
    python3 static_site.py    listens on 127.0.0.1:8051, plain HTTP
"""

from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8051
CSP_MODE = os.environ.get("CSP_MODE") == "on"
ROOT = Path(__file__).parent / "static"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        print(f"static_site: {self.address_string()} {format % args}", flush=True)

    def do_GET(self) -> None:
        rel = "index.html" if self.path == "/" else self.path.lstrip("/")
        path = ROOT / rel
        if not path.is_file():
            self.send_response(404)
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(path.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        if CSP_MODE and path.suffix == ".html":
            self.send_header("Content-Security-Policy", "default-src 'self'")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    print(f"static_site listening on http://{LISTEN_HOST}:{LISTEN_PORT} (CSP_MODE={CSP_MODE})", flush=True)
    server.serve_forever()
