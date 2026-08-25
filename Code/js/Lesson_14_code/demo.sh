#!/usr/bin/env bash
# The TypeScript twin of Code/Lesson_14_code/demo.sh. Needs node, dig, and
# curl on PATH, and a real network connection for the record-type and
# root-walk parts.
set -euo pipefail
cd "$(dirname "$0")/src"

echo "=== Part 1: record types, queried by hand (dnsQuery.ts) ==="
node dnsQuery.ts example.com A
echo
node dnsQuery.ts example.com AAAA
echo
node dnsQuery.ts www.github.com CNAME
echo
node dnsQuery.ts google.com MX
echo
node dnsQuery.ts example.com TXT
echo

echo "=== Part 2: TTL — a cache that goes stale on purpose ==="
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.5", "ttl": 5}' > zone.json
rm -f resolverCache.json
node toyDnsServer.ts &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 0.5

echo "-- query 1: cache miss, asks the authoritative server --"
node cachingResolver.ts bookmarks-api.local
echo "-- query 2, immediately after: cache hit, no packet sent --"
node cachingResolver.ts bookmarks-api.local
echo "-- an operator changes the record: 10.0.0.5 -> 10.0.0.9 --"
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.9", "ttl": 5}' > zone.json
echo "-- query 3, still inside the old TTL window: stale hit --"
node cachingResolver.ts bookmarks-api.local
echo "-- wait for the TTL to expire --"
sleep 6
echo "-- query 4, after expiry: cache miss, fresh answer --"
node cachingResolver.ts bookmarks-api.local
kill "$SERVER_PID" 2>/dev/null
trap - EXIT
rm -f resolverCache.json
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.5", "ttl": 5}' > zone.json
