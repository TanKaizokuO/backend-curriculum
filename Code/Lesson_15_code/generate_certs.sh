#!/usr/bin/env bash
# Self-signed certificates for the demo, one per hostname, so Step 3 (SNI)
# has two real certificates to choose between. A public CA never signs a
# certificate for a name like .local; a self-signed certificate is the
# only option for a name nobody else can verify — and Step 2 exists because
# a browser or curl trusts neither.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs

for name in bookmarks-api.local admin.bookmarks-api.local; do
  openssl req -x509 -newkey rsa:2048 -sha256 -days 3 -nodes \
    -keyout "certs/$name.key" -out "certs/$name.crt" \
    -subj "/CN=$name" -addext "subjectAltName=DNS:$name" 2>/dev/null
  echo "wrote certs/$name.crt (CN=$name)"
done
