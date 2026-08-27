"""The API origin: http://127.0.0.1:8040.

Serves bookmarks, a login endpoint that sets a cookie, and a whoami endpoint
that reports whether a cookie arrived. Three environment variables switch on
the fixes this lesson builds toward, one at a time, so the same file plays
every stage of the demo:

    CORS_ALLOW=on            add Access-Control-* headers for allowed origins
    COOKIE_SAMESITE=None     set the login cookie's SameSite attribute
                              (default: Lax)
    python3 api.py           listens on 127.0.0.1:8040, plain HTTP
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

LISTEN_HOST = "127.0.0.2"
LISTEN_PORT = 8040

ALLOWED_ORIGINS = {"http://127.0.0.1:8051"}
CORS_ALLOW = os.environ.get("CORS_ALLOW") == "on"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "Lax")

BOOKMARKS = [
    {"id": 1, "title": "MDN: same-origin policy"},
    {"id": 2, "title": "MDN: CORS"},
]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        print(f"api: {self.address_string()} {format % args}", flush=True)

    def _cors_headers(self, for_preflight: bool) -> None:
        if not CORS_ALLOW:
            return
        origin = self.headers.get("Origin")
        if origin not in ALLOWED_ORIGINS:
            return
        # Echo the one calling origin back, never "*" — a wildcard cannot
        # carry Access-Control-Allow-Credentials, and a login flow needs
        # credentials.
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Vary", "Origin")
        if for_preflight:
            self.send_header("Access-Control-Allow-Methods", "GET, POST")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")

    def _send_json(self, status: int, payload: dict, cookie: str | None = None) -> None:
        body = json.dumps(payload, indent=2).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers(for_preflight=False)
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_OPTIONS(self) -> None:
        # The preflight request. A browser sends this by itself, ahead of a
        # request it considers "not simple" — here, a POST with a JSON body.
        # No body, no route logic: only the question "may the real request
        # happen?" gets answered.
        self.send_response(204)
        self._cors_headers(for_preflight=True)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def do_GET(self) -> None:
        if self.path == "/bookmarks":
            self._send_json(200, {"bookmarks": BOOKMARKS})
            return
        if self.path == "/whoami":
            cookie_header = self.headers.get("Cookie")
            self._send_json(
                200,
                {
                    "origin_header": self.headers.get("Origin"),
                    "cookie_header": cookie_header,
                    "logged_in": cookie_header is not None and "session=" in cookie_header,
                },
            )
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/login":
            self._send_json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        parse_qs(raw.decode())  # the body is never checked; only its presence matters here
        cookie = f"session=demo-session-token; HttpOnly; SameSite={COOKIE_SAMESITE}; Path=/"
        self._send_json(200, {"logged_in": True}, cookie=cookie)


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    print(
        f"api listening on http://{LISTEN_HOST}:{LISTEN_PORT} "
        f"(CORS_ALLOW={CORS_ALLOW}, COOKIE_SAMESITE={COOKIE_SAMESITE})",
        flush=True,
    )
    server.serve_forever()
