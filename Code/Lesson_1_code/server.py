import socket
import time

listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
listener.bind(("127.0.0.1", 8080))
listener.listen(5)
print("listening on http://127.0.0.1:8080")

while True:
    conn, addr = listener.accept()  # blocks until someone connects
    with conn:
        request = conn.recv(65536)
        print("--- request from", addr[0], "---")
        print(request.decode("utf-8", "replace"))

        body = b"\n"
        head = (
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Connection: close\r\n"
            "\r\n"
        ).encode("ascii")
        conn.sendall(head + body)
        time.sleep(30)
