#!/usr/bin/env bash
# The TypeScript twin of ../../Lesson_16_code/demo.sh. Needs node and curl.
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
  env "$@" node src/api.ts > /tmp/lesson16-ts-api.log 2>&1 &
  API_PID=$!
  sleep 0.4
}

start_static() {
  kill "$STATIC_PID" 2>/dev/null || true
  env "$@" node src/staticSite.ts > /tmp/lesson16-ts-static.log 2>&1 &
  STATIC_PID=$!
  sleep 0.4
}

echo "=== Part 1: no CORS headers at all ==="
start_api
start_static
curl -s http://127.0.0.2:8040/bookmarks
echo
curl -sD - -o /dev/null -X OPTIONS http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
echo

echo "=== Part 2: CORS_ALLOW=on ==="
start_api CORS_ALLOW=on
curl -sD - -o /dev/null -X OPTIONS http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
curl -sD - -o /dev/null http://127.0.0.2:8040/bookmarks -H "Origin: http://127.0.0.1:8051"
curl -sD - -o /dev/null -X POST http://127.0.0.2:8040/login \
  -H "Origin: http://127.0.0.1:8051" -H "Content-Type: application/json" -d '{}'
echo

echo "=== Part 3: CSP ==="
curl -sD - -o /dev/null http://127.0.0.1:8051/ | grep -i "content-security-policy" || echo "(no Content-Security-Policy header)"
start_static CSP_MODE=on
curl -sD - -o /dev/null http://127.0.0.1:8051/ | grep -i "content-security-policy"
echo
echo "Open http://127.0.0.1:8051/ in a real browser now (with CORS_ALLOW=on"
echo "from Part 2 still running) to see the console errors and the cookie"
echo "behaviour the lesson quotes."
