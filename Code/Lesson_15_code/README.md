# Lesson 15 — the edge: reverse proxy and TLS (Python)

The process that answers HTTPS on the outside is never your application.
This project builds that process twice: once by hand, in
[`tls_proxy.py`](./tls_proxy.py), and once as configuration, in
[`nginx.conf`](./nginx.conf). Both sit in front of the same
[`origin.py`](./origin.py) — a stand-in for the Lesson 12 / Lesson 14 API,
small enough to show exactly what it received. The TypeScript twin is
[`Code/js/Lesson_15_code/`](../js/Lesson_15_code/).

## Run the demo

```shell
./demo.sh
```

Needs `python3`, `curl`, `openssl`, and Docker (for the Nginx half). No
database, no Redis.

## What it does, in order

1. **Certificates.** `generate_certs.sh` writes one self-signed certificate
   per hostname into `certs/` — one for `bookmarks-api.local`, one for
   `admin.bookmarks-api.local`.
2. **The raw mechanism — `tls_proxy.py`.** A hand-written reverse proxy
   that terminates TLS with the `ssl` module, picks a certificate by SNI,
   adds `X-Forwarded-For` and `X-Forwarded-Proto`, and rejects an
   over-size body before it reaches `origin.py`.
3. **The abstraction — `nginx.conf`.** The same four jobs, declared instead
   of coded: one `server` block per hostname for SNI,
   `proxy_set_header` for the forwarding headers, `client_max_body_size`
   for the body limit. Run with Docker, `--network host`, so it can reach
   `origin.py` on the loopback interface.
4. **`origin.py`.** Answers `GET /whoami` with the client address and
   headers it saw, and `POST /upload` with how many bytes it read — enough
   to see exactly what a proxy adds, hides, or blocks.

Read `demo.sh` top to bottom; every command in the lesson is in there, in
the order it runs.

## Run the Lesson 12 / 14 API behind the proxy

`origin.py` stands in for the real API so the demo needs no database. To
put the actual API behind either proxy instead, start it from
[`Code/Lesson_14_code/`](../Lesson_14_code/) on port 8020, and change
`ORIGIN_PORT` in `tls_proxy.py` (or `proxy_pass` in `nginx.conf`) from
`8030` to `8020`.
