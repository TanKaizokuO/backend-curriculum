#!/usr/bin/env bash
# The TypeScript twin of Code/Lesson_15_code/generate_certs.sh. Same
# certificates, same reason: a name like .local gets no certificate from a
# public CA, so a self-signed one is the only option, and Step 2 exists
# because curl and Node both distrust it by default.
set -euo pipefail
cd "$(dirname "$0")/src"
mkdir -p certs

for name in bookmarks-api.local admin.bookmarks-api.local; do
  openssl req -x509 -newkey rsa:2048 -sha256 -days 3 -nodes \
    -keyout "certs/$name.key" -out "certs/$name.crt" \
    -subj "/CN=$name" -addext "subjectAltName=DNS:$name" 2>/dev/null
  echo "wrote certs/$name.crt (CN=$name)"
done
