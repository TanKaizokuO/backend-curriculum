#!/usr/bin/env bash
# The whole lesson, runnable with curl. Needs python3 and curl. The browser
# steps this lesson quotes (console errors, document.cookie, cookie storage)
# need a real browser and are not reproduced by this script — open
# static/index.html served from :8051 in one to see them yourself.
set -euo pipefail
cd "$(dirname "$0")"

API_PID=""
STATIC_PID=""
cleanup() {
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$STATIC_PID" ] && kill "$STATIC_PID" 2>/dev/null || true
}
trap cleanup EXIT

start_api() {
  kill "$API_PID" 2>/dev/null || true
  env "$@" python3 api.py > /tmp/lesson16-api.log 2>&1 &
  API_PID=$!
  sleep 0.4
}

start_static() {
  kill "$STATIC_PID" 2>/dev/null || true
  env "$@" python3 static_site.py > /tmp/lesson16-static.log 2>&1 &
  STATIC_PID=$!
  sleep 0.4
}

echo "=== Part 1: no CORS headers at all ==="
start_api
start_static
echo "-- curl gets a normal 200; nothing here enforces same-origin --"
curl -s http://127.0.0.2:8040/bookmarks
echo
echo "-- the preflight a browser would send for POST /login: no Access-Control-* comes back --"
curl -sD - -o /dev/null -X OPTIONS http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
echo

echo "=== Part 2: CORS_ALLOW=on ==="
start_api CORS_ALLOW=on
echo "-- preflight now answers with Access-Control-Allow-* --"
curl -sD - -o /dev/null -X OPTIONS http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
echo "-- the actual GET carries Access-Control-Allow-Origin, echoed, not '*' --"
curl -sD - -o /dev/null http://127.0.0.2:8040/bookmarks -H "Origin: http://127.0.0.1:8051"
echo "-- login sets a cookie: HttpOnly, SameSite=Lax by default --"
curl -sD - -o /dev/null -X POST http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" -H "Content-Type: application/json" -d '{}'
echo

echo "=== Part 3: CSP ==="
echo "-- no header without CSP_MODE --"
curl -sD - -o /dev/null http://127.0.0.1:8051/ | grep -i "content-security-policy" || echo "(no Content-Security-Policy header)"
start_static CSP_MODE=on
echo "-- with CSP_MODE=on, the HTML response carries the policy --"
curl -sD - -o /dev/null http://127.0.0.1:8051/ | grep -i "content-security-policy"
echo
echo "Open http://127.0.0.1:8051/ in a real browser now (with CORS_ALLOW=on"
echo "from Part 2 still running) to see the console errors and the cookie"
echo "behaviour the lesson quotes — curl cannot reproduce either."
