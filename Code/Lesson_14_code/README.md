# Lesson 14 — how a request finds your server (Python)

This extends the Lesson 12 API — same `main.py`, same migrations, same
bench scripts — with the layer that runs before any of it: DNS. The
TypeScript twin is [`Code/js/Lesson_14_code/`](../js/Lesson_14_code/).

## Run the demo

```shell
./demo.sh
```

It needs `python3`, `dig`, and `curl` on `PATH`, and a real network
connection. Nothing else — no database, no Redis, no Docker.

## What it does, in order

1. **Record types, by hand.** `dns_query.py` builds a DNS query packet —
   twelve-byte header, length-prefixed labels, no library — and parses
   whatever comes back, for `A`, `AAAA`, `CNAME`, `MX`, and `TXT` against
   real domains.
2. **The walk from root to authoritative.** Three `dig` calls, one server
   at a time: a root server names the `.com` servers, a `.com` server
   names `example.com`'s own servers, and one of those answers with the
   address.
3. **TTL — a cache that goes stale on purpose.** `toy_dns_server.py` is a
   one-record authoritative server for a made-up zone,
   `bookmarks-api.local`, reading `zone.json` fresh on every query.
   `caching_resolver.py` is a stub resolver with its own TTL-keyed cache.
   The record changes mid-demo; the cached answer stays wrong until the
   TTL expires.
4. **The resolved IP is what `curl` actually connects to.** `curl
   --resolve` uses the IP `caching_resolver.py` returned, not a name
   lookup of its own, to reach a stand-in for the Lesson 12 API. Run the
   real API instead (`uvicorn main:app --port 8020`, database running)
   to hit `/healthz` for real.

Read `demo.sh` top to bottom; every command in the lesson is in there, in
the order it runs.

## Run the Lesson 12 API this lesson extends

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python migrate.py
uvicorn main:app --port 8020
```

See [`Code/Lesson_12_code/README.md`](../Lesson_12_code/README.md) for the
rate-limit, connection-pool, and replica-lag benches this directory also
carries forward unchanged.
