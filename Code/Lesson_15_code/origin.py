"""The origin server: the process that actually answers a request.

Every proxy in this lesson — the hand-written one and Nginx — sits in front
of this server and never runs the application itself. This server only
reports what it received, so the proxy's effect on the request is visible:
who it thinks the client's socket address is, and which headers arrived.

    python3 origin.py            # listens on 127.0.0.1:8030, plain HTTP
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8030


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        print(f"origin: {self.address_string()} {format % args}", flush=True)

    def do_GET(self) -> None:
        if self.path != "/whoami":
            self.send_response(404)
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            return
        body = json.dumps(
            {
                "socket_peer": self.client_address[0],
                "host_header": self.headers.get("Host"),
                "x_forwarded_for": self.headers.get("X-Forwarded-For"),
                "x_forwarded_proto": self.headers.get("X-Forwarded-Proto"),
                "x_real_ip": self.headers.get("X-Real-IP"),
            },
            indent=2,
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_POST(self) -> None:
        if self.path != "/upload":
            self.send_response(404)
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            return
        length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(length)  # drain the body; the size is the point
        body = json.dumps({"received_bytes": length}).encode()
        self.send_response(201)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    print(f"origin listening on http://{LISTEN_HOST}:{LISTEN_PORT} (plain HTTP, no TLS)", flush=True)
    server.serve_forever()
