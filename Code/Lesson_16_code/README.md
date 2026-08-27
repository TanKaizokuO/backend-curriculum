# Lesson 16 — rules the browser enforces (Python)

Two origins on the loopback interface: [`api.py`](./api.py) on
`http://127.0.0.2:8040`, [`static_site.py`](./static_site.py) on
`http://127.0.0.1:8051`. Different host, different port — the browser
treats them as unrelated sites, and enforces rules between them that curl
never does. The TypeScript twin is
[`Code/js/Lesson_16_code/`](../js/Lesson_16_code/).

## Run the demo

```shell
./demo.sh
```

Needs `python3` and `curl`. No database, no Redis. The script proves every
header with curl; open `static/index.html` (served from `:8051`) in a real
browser to see the console errors and cookie behaviour curl cannot show.

## What it does, in order

1. **No CORS headers.** `api.py` answers every request normally — curl
   gets a plain `200`. A browser's `fetch()` from `static/index.html`
   still fails: same-origin policy blocks reading the response, and blocks
   the preflight `OPTIONS` request a `POST` with a JSON body needs.
2. **`CORS_ALLOW=on`.** `api.py` echoes the calling origin in
   `Access-Control-Allow-Origin` — never `*`, because a wildcard cannot
   carry `Access-Control-Allow-Credentials`, and the login flow needs
   credentials. Preflight now answers `204` with the allowed methods and
   headers; the actual `GET` and `POST` succeed in a real browser.
3. **Cookies.** `POST /login` sets `Set-Cookie: session=...; HttpOnly;
   SameSite=Lax`. `HttpOnly` hides it from `document.cookie` even on the
   API's own origin. `SameSite=Lax`, the default, means a browser refuses
   to store a cookie a cross-site response tries to set at all — a later
   `GET /whoami` from `static/index.html` has no cookie to send.
   `COOKIE_SAMESITE=None` env var sets `SameSite=None` instead, meant to
   allow this — but a real browser still refuses to store it, because
   `SameSite=None` requires `Secure`, and this demo runs over plain HTTP.
4. **`CSP_MODE=on`.** `static_site.py` adds `Content-Security-Policy:
   default-src 'self'` to the HTML response. `static/index.html` carries
   a deliberate inline `<script>`; with the header present, a real browser
   refuses to run it and logs a CSP violation — nothing in `demo.sh`
   triggers this, only opening the page does.

## Run it in a real browser

```shell
CORS_ALLOW=on python3 api.py &
python3 static_site.py &
```

Open `http://127.0.0.1:8051/` and click the three buttons. Then restart
`static_site.py` with `CSP_MODE=on` and reload the page to see the inline
script blocked.

## Completing the SameSite=None cookie, with real TLS

`COOKIE_SAMESITE=None` cannot finish its job on plain HTTP. Point
`api.py` behind [`Code/Lesson_15_code/tls_proxy.py`](../Lesson_15_code/tls_proxy.py)
(change `ORIGIN_PORT` to `8040`, generate a certificate for a hostname on
`127.0.0.2`) and serve `static/` over HTTPS the same way, and the
`Secure` requirement is met — the cookie should then survive the
cross-site `GET /whoami`. Left as an exercise: this lesson's own demo
stays on plain HTTP so it needs no certificates.
