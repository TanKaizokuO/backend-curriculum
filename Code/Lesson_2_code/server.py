import socket
from urllib.parse import urlparse, parse_qs

# ── Parsing ─────────────────────────────────────────────


def parse_request_line(raw):
    request_line, _rest = raw.split(b"\r\n", 1)
    parts = request_line.decode("ascii").split(" ")
    if len(parts) != 3:
        raise ValueError(f"Malformed request line: {request_line!r}")
    return parts[0], parts[1], parts[2]


def parse_headers(raw):
    _request_line, rest = raw.split(b"\r\n", 1)
    header_block, _body = rest.split(b"\r\n\r\n", 1)
    headers = {}
    for line in header_block.split(b"\r\n"):
        name, _sep, value = line.decode("ascii").partition(":")
        headers[name.strip().lower()] = value.strip()
    return headers


def parse_query(target):
    parsed = urlparse(target)
    return parsed.path, parse_qs(parsed.query)


# ── Handlers ────────────────────────────────────────────


def handle_index(method, path, query, headers):
    return 200, "text/plain", b"Welcome.\n"


def handle_hello(method, path, query, headers):
    name = query.get("name", ["stranger"])[0]
    body = f"Hello, {name}!\n".encode()
    return 200, "text/plain", body


ROUTES = {
    ("GET", "/"): handle_index,
    ("GET", "/hello"): handle_hello,
}

STATUS_PHRASES = {
    200: "OK",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
}

# ── Response helpers ─────────────────────────────────────


def build_response(status, content_type, body, extra_headers=None):
    phrase = STATUS_PHRASES.get(status, "Unknown")
    lines = [f"HTTP/1.1 {status} {phrase}"]
    lines.append(f"Content-Type: {content_type}; charset=utf-8")
    lines.append(f"Content-Length: {len(body)}")
    lines.append("Connection: close")
    for h in extra_headers or []:
        lines.append(h)
    lines.append("")  # blank line
    head = "\r\n".join(lines).encode("ascii") + b"\r\n"
    return head + body


def allowed_methods(path):
    """Which methods are registered for this path?"""
    return [m for (m, p) in ROUTES if p == path]


# ── Main loop ────────────────────────────────────────────


def serve(host="127.0.0.1", port=8080):
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((host, port))
    listener.listen(5)
    print(f"listening on http://{host}:{port}")

    while True:
        conn, addr = listener.accept()
        with conn:
            raw = conn.recv(65536)
            if not raw:
                continue

            try:
                method, target, version = parse_request_line(raw)
            except ValueError:
                conn.sendall(build_response(400, "text/plain", b"Bad Request.\n"))
                continue

            path, query = parse_query(target)
            headers = parse_headers(raw)

            print(f"{method} {path} from {addr[0]}")

            handler = ROUTES.get((method, path))
            if handler:
                status, ctype, body = handler(method, path, query, headers)
                conn.sendall(build_response(status, ctype, body))
            else:
                allowed = allowed_methods(path)
                if allowed:
                    # Path exists, wrong method → 405
                    conn.sendall(
                        build_response(
                            405,
                            "text/plain",
                            b"Method Not Allowed.\n",
                            [f"Allow: {', '.join(allowed)}"],
                        )
                    )
                else:
                    # No route at all → 404
                    conn.sendall(build_response(404, "text/plain", b"Not Found.\n"))


if __name__ == "__main__":
    serve()
