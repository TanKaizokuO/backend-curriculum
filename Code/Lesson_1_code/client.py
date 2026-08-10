import socket

with socket.create_connection(("example.com", 80), timeout=10) as sock:
    sock.sendall(
        b"GET / HTTP/1.1\r\n" b"Host: example.com\r\n" b"Connection: close\r\n" b"\r\n"
    )
    chunks = []
    while True:
        chunk = sock.recv(4096)
        if not chunk:  # empty bytes == the server hung up
            break
        chunks.append(chunk)

print(b"".join(chunks).decode("utf-8", "replace")[:400])
