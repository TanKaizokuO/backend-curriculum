#!/usr/bin/env bash
# The whole lesson, runnable. Needs python3, curl, openssl, and Docker.
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Part 0: certificates and the origin ==="
./generate_certs.sh
python3 origin.py > /tmp/lesson15-origin.log 2>&1 &
ORIGIN_PID=$!
trap 'kill $ORIGIN_PID 2>/dev/null; docker rm -f lesson15-nginx >/dev/null 2>&1; kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 0.5
echo

echo "=== Part 1: the raw mechanism (tls_proxy.py) ==="
python3 tls_proxy.py > /tmp/lesson15-tlsproxy.log 2>&1 &
PROXY_PID=$!
sleep 0.5

echo "-- direct to the origin: plain HTTP, no forwarded headers --"
curl -s http://127.0.0.1:8030/whoami
echo

echo "-- curl refuses the self-signed certificate --"
curl -sv -m 3 https://bookmarks-api.local:8443/whoami --resolve bookmarks-api.local:8443:127.0.0.1 2>&1 \
  | grep -i "certificate problem" || true

echo "-- trust it explicitly with --cacert: TLS ends at the proxy --"
curl -s -m 3 --cacert certs/bookmarks-api.local.crt \
  https://bookmarks-api.local:8443/whoami --resolve bookmarks-api.local:8443:127.0.0.1
echo

echo "-- SNI: same port, two hostnames, two certificates --"
timeout 3 openssl s_client -connect 127.0.0.1:8443 -servername bookmarks-api.local </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
timeout 3 openssl s_client -connect 127.0.0.1:8443 -servername admin.bookmarks-api.local </dev/null 2>/dev/null \
  | openssl x509 -noout -subject

echo "-- a body under the limit reaches the origin --"
curl -s -m 3 --cacert certs/bookmarks-api.local.crt -X POST --data "small" \
  https://bookmarks-api.local:8443/upload --resolve bookmarks-api.local:8443:127.0.0.1
echo
echo "-- a body over the limit is rejected by the proxy, before the origin sees it --"
python3 -c "print('x' * 2000)" > /tmp/lesson15-bigbody.txt
curl -s -m 3 -o /dev/null -w "%{http_code}\n" --cacert certs/bookmarks-api.local.crt \
  -X POST --data-binary @/tmp/lesson15-bigbody.txt \
  https://bookmarks-api.local:8443/upload --resolve bookmarks-api.local:8443:127.0.0.1

kill "$PROXY_PID" 2>/dev/null || true
echo

echo "=== Part 2: the abstraction (Nginx) ==="
docker rm -f lesson15-nginx >/dev/null 2>&1 || true
docker run -d --name lesson15-nginx --network host \
  -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$PWD/certs:/etc/nginx/certs:ro" \
  nginx:1.27-alpine >/dev/null
sleep 1

echo "-- same rejection, same fix, no code of our own --"
curl -sv -m 3 https://bookmarks-api.local/whoami --resolve bookmarks-api.local:443:127.0.0.1 2>&1 \
  | grep -i "certificate problem" || true
curl -s -m 3 --cacert certs/bookmarks-api.local.crt \
  https://bookmarks-api.local/whoami --resolve bookmarks-api.local:443:127.0.0.1
echo

echo "-- SNI again, this time from two server blocks --"
timeout 3 openssl s_client -connect 127.0.0.1:443 -servername admin.bookmarks-api.local </dev/null 2>/dev/null \
  | openssl x509 -noout -subject

echo "-- client_max_body_size 1k: the same 2001-byte body, now rejected by Nginx --"
curl -s -m 3 -o /dev/null -w "%{http_code}\n" --cacert certs/bookmarks-api.local.crt \
  -X POST --data-binary @/tmp/lesson15-bigbody.txt \
  https://bookmarks-api.local/upload --resolve bookmarks-api.local:443:127.0.0.1

rm -f /tmp/lesson15-bigbody.txt
