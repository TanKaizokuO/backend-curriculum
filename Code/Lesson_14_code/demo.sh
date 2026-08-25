#!/usr/bin/env bash
# The whole lesson, runnable. Needs python3, dig, and curl on PATH, and a
# real network connection for the parts that talk to real DNS servers.
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Part 1: record types, queried by hand (dns_query.py) ==="
python3 dns_query.py example.com A
echo
python3 dns_query.py example.com AAAA
echo
python3 dns_query.py www.github.com CNAME
echo
python3 dns_query.py google.com MX
echo
python3 dns_query.py example.com TXT
echo

echo "=== Part 2: the walk from root to authoritative (dig, one server at a time) ==="
echo "-- ask a root server who handles .com --"
dig @198.41.0.4 example.com A +noall +authority | grep '	NS	' | head -3
echo "-- ask a .com TLD server who handles example.com --"
dig @192.5.6.30 example.com A +noall +authority
echo "-- ask the authoritative server for the A record --"
dig @108.162.192.162 example.com A +noall +answer
echo

echo "=== Part 3: TTL — a cache that goes stale on purpose ==="
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.5", "ttl": 5}' > zone.json
rm -f resolver_cache.json
python3 toy_dns_server.py &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 0.5

echo "-- query 1: cache miss, asks the authoritative server --"
python3 caching_resolver.py bookmarks-api.local
echo "-- query 2, immediately after: cache hit, no packet sent --"
python3 caching_resolver.py bookmarks-api.local
echo "-- an operator changes the record: 10.0.0.5 -> 10.0.0.9 --"
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.9", "ttl": 5}' > zone.json
echo "-- query 3, still inside the old TTL window: stale hit --"
python3 caching_resolver.py bookmarks-api.local
echo "-- wait for the TTL to expire --"
sleep 6
echo "-- query 4, after expiry: cache miss, fresh answer --"
python3 caching_resolver.py bookmarks-api.local
kill "$SERVER_PID" 2>/dev/null
trap - EXIT
echo

echo "=== Part 4: the resolved IP is what curl actually connects to ==="
python3 -m http.server 8020 --bind 127.0.0.1 >/dev/null 2>&1 &
API_PID=$!
sleep 0.5
echo "-- swap the fake IP for a real one, so the request can complete --"
echo '{"name": "bookmarks-api.local", "ip": "127.0.0.1", "ttl": 5}' > zone.json
python3 toy_dns_server.py &
SERVER_PID=$!
sleep 0.5
rm -f resolver_cache.json
RESOLVED_IP=$(python3 caching_resolver.py bookmarks-api.local | tee /dev/stderr | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
echo "curl --resolve bookmarks-api.local:8020:$RESOLVED_IP http://bookmarks-api.local:8020/healthz"
curl -s -o /dev/null -w "%{http_code}\n" --resolve "bookmarks-api.local:8020:$RESOLVED_IP" "http://bookmarks-api.local:8020/"
kill "$API_PID" "$SERVER_PID" 2>/dev/null
rm -f resolver_cache.json
echo '{"name": "bookmarks-api.local", "ip": "10.0.0.5", "ttl": 5}' > zone.json
