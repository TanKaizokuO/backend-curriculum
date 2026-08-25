# Lesson 15 — the edge: reverse proxy and TLS (TypeScript)

The TypeScript twin of [`Code/Lesson_15_code/`](../../Lesson_15_code/).
Same proxy, built twice: [`src/tlsProxy.ts`](./src/tlsProxy.ts) does it by
hand with Node's `tls` module; [`src/nginx.conf`](./src/nginx.conf) does
the same job as configuration. Both front
[`src/origin.ts`](./src/origin.ts), a stand-in for the real API.

## Run the demo

```shell
npm install
./demo.sh
```

Needs `node`, `curl`, `openssl`, and Docker.

## What it does, in order

1. **Certificates.** `generate-certs.sh` writes one self-signed certificate
   per hostname into `src/certs/`.
2. **The raw mechanism — `tlsProxy.ts`.** Terminates TLS with Node's `tls`
   module, picks a certificate in `SNICallback`, adds `X-Forwarded-For`
   and `X-Forwarded-Proto` by rewriting the raw request head, and rejects
   an over-size body before it reaches `origin.ts`.
3. **The abstraction — `src/nginx.conf`.** The identical config from the
   Python project — Nginx does not care which language wrote the origin.
4. **`origin.ts`.** Answers `GET /whoami` and `POST /upload` the same way
   as the Python origin, so the two demos produce the same shape of
   output.

Read `demo.sh` top to bottom; every command in the lesson is in there.
