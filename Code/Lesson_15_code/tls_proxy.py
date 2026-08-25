"""A reverse proxy that terminates TLS by hand, before naming Nginx.

Lesson 12 built a round-robin proxy that only copied bytes; it did no TLS
and never looked at the request it was moving. This proxy does the three
things a real edge (Nginx, Caddy, a cloud load balancer) does before your
application ever sees a request:

1. **Terminate TLS.** The client's TLS session ends here, at the proxy.
   The hop from here to the origin in `origin.py` is plain HTTP.
2. **Pick a certificate by SNI.** The client names the host it wants
   *inside* the TLS handshake, before any HTTP request exists, so one
   proxy can hold one certificate per hostname.
3. **Add forwarding headers, and enforce a body limit.** The origin lost
   the client's real address and the fact that the outside was HTTPS the
   moment TLS ended here; `X-Forwarded-For` and `X-Forwarded-Proto` put
   both back as plain headers. A `Content-Length` over the limit is
   rejected before a single byte reaches the origin.

    python3 generate_certs.sh                 # once
    python3 tls_proxy.py                       # listens on 127.0.0.1:8443
"""

from __future__ import annotations

import socket
import ssl
import threading
from pathlib import Path

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8443
ORIGIN_HOST = "127.0.0.1"
ORIGIN_PORT = 8030
MAX_BODY_BYTES = 1024  # 1 KiB, small on purpose so Step 5 needs no big file
CERT_DIR = Path(__file__).parent / "certs"

# One SSLContext per hostname, each loaded with that hostname's own
# certificate and key. `sni_callback` runs during the handshake, before
# any HTTP bytes exist, and swaps the connection onto the matching context.
_contexts: dict[str, ssl.SSLContext] = {}
for cert in sorted(CERT_DIR.glob("*.crt")):
    hostname = cert.stem
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=str(cert), keyfile=str(CERT_DIR / f"{hostname}.key"))
    _contexts[hostname] = ctx
DEFAULT_HOSTNAME = next(iter(_contexts))


def _select_certificate(tls_socket: ssl.SSLSocket, server_name: str | None, _ctx) -> None:
    matched = server_name in _contexts
    served = server_name if matched else DEFAULT_HOSTNAME
    print(f"tls_proxy: SNI asked for {server_name!r} -> serving cert for {served!r}"
          f"{'' if matched else ' (no exact match, served the default)'}", flush=True)
    tls_socket.context = _contexts[served]


_base_context = next(iter(_contexts.values()))
_base_context.sni_callback = _select_certificate


def _read_request_head(sock: ssl.SSLSocket) -> tuple[bytes, bytes]:
    """Read until the blank line that ends the headers. Return (head, leftover)."""
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            break
        buf += chunk
    head, _, rest = buf.partition(b"\r\n\r\n")
    return head, rest


def _content_length(head: bytes) -> int:
    for line in head.split(b"\r\n")[1:]:
        name, _, value = line.partition(b":")
        if name.strip().lower() == b"content-length":
            return int(value.strip())
    return 0


def handle_connection(raw_sock: socket.socket, client_addr: tuple[str, int]) -> None:
    try:
        tls_sock = _base_context.wrap_socket(raw_sock, server_side=True)
        tls_sock.settimeout(5.0)  # a stalled or bare TLS probe must not hang a worker forever
    except ssl.SSLError as exc:
        print(f"tls_proxy: handshake with {client_addr[0]} failed: {exc}", flush=True)
        raw_sock.close()
        return

    try:
        head, already_read_body = _read_request_head(tls_sock)
        if not head:
            return
        request_line = head.split(b"\r\n", 1)[0].decode(errors="replace")
        content_length = _content_length(head)

        if content_length > MAX_BODY_BYTES:
            print(f"tls_proxy: {request_line} -> 413 (Content-Length "
                  f"{content_length} > {MAX_BODY_BYTES})", flush=True)
            body = b"request body too large\n"
            response = (
                b"HTTP/1.1 413 Content Too Large\r\n"
                b"Content-Length: " + str(len(body)).encode() + b"\r\n"
                b"Connection: close\r\n\r\n" + body
            )
            tls_sock.sendall(response)
            return

        remaining = content_length - len(already_read_body)
        body = already_read_body
        while remaining > 0:
            chunk = tls_sock.recv(min(4096, remaining))
            if not chunk:
                break
            body += chunk
            remaining -= len(chunk)

        lines = head.split(b"\r\n")
        headers = [
            line for line in lines[1:]
            if not line.lower().startswith((b"x-forwarded-for:", b"x-forwarded-proto:"))
        ]
        headers.append(f"X-Forwarded-For: {client_addr[0]}".encode())
        headers.append(b"X-Forwarded-Proto: https")
        forwarded_request = lines[0] + b"\r\n" + b"\r\n".join(headers) + b"\r\n\r\n" + body

        print(f"tls_proxy: {request_line} from {client_addr[0]} -> "
              f"{ORIGIN_HOST}:{ORIGIN_PORT} (added X-Forwarded-For, X-Forwarded-Proto)",
              flush=True)

        with socket.create_connection((ORIGIN_HOST, ORIGIN_PORT)) as origin_sock:
            origin_sock.sendall(forwarded_request)
            response = b""
            while True:
                chunk = origin_sock.recv(4096)
                if not chunk:
                    break
                response += chunk
        tls_sock.sendall(response)
    except (ssl.SSLError, ConnectionError, OSError) as exc:
        print(f"tls_proxy: connection from {client_addr[0]} failed: {exc}", flush=True)
    finally:
        tls_sock.close()


def main() -> None:
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind((LISTEN_HOST, LISTEN_PORT))
    listener.listen(64)
    names = ", ".join(sorted(_contexts))
    print(f"tls_proxy listening on https://{LISTEN_HOST}:{LISTEN_PORT} "
          f"(certs for: {names}) -> http://{ORIGIN_HOST}:{ORIGIN_PORT}", flush=True)
    try:
        while True:
            client_sock, client_addr = listener.accept()
            threading.Thread(
                target=handle_connection, args=(client_sock, client_addr), daemon=True
            ).start()
    except KeyboardInterrupt:
        pass
    finally:
        listener.close()


if __name__ == "__main__":
    main()
