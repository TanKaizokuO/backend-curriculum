#!/usr/bin/env bash
# Lesson 13 — version control, TypeScript twin.
# The same conflict, on the TypeScript handler. Merge only — rebase and the
# reflog rescue behave identically to the Python demo and are not repeated.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
rm -rf repo
git init -q repo
cd repo
git config user.email "dev@example.com"
git config user.name "dev"
git symbolic-ref HEAD refs/heads/main

cat > handler.ts << 'EOF'
export async function getBookmark(id: number): Promise<Bookmark> {
  const row = await db.query(
    "SELECT id, url, title FROM bookmarks WHERE id = $1",
    [id],
  );
  if (row === null) throw new HttpError(404);
  return row;
}
EOF
git add handler.ts
git commit -q -m "add getBookmark handler"

git checkout -q -b alice-caching
cat > handler.ts << 'EOF'
export async function getBookmark(id: number): Promise<Bookmark> {
  const cached = await cache.get(`bookmark:${id}`);
  if (cached !== null) return cached;
  const row = await db.query(
    "SELECT id, url, title FROM bookmarks WHERE id = $1",
    [id],
  );
  if (row === null) throw new HttpError(404);
  await cache.set(`bookmark:${id}`, row, 30);
  return row;
}
EOF
git add handler.ts
git commit -q -m "cache getBookmark reads"

git checkout -q main
git checkout -q -b bob-logging
cat > handler.ts << 'EOF'
export async function getBookmark(id: number): Promise<Bookmark> {
  log.info("fetching bookmark", { id });
  const row = await db.query(
    "SELECT id, url, title FROM bookmarks WHERE id = $1",
    [id],
  );
  if (row === null) throw new HttpError(404);
  return row;
}
EOF
git add handler.ts
git commit -q -m "log getBookmark reads"

git log --all --oneline --graph
echo
git checkout -q alice-caching
set +e
git merge bob-logging -m "merge bob-logging into alice-caching"
set -e
echo "--- conflict markers in handler.ts ---"
cat handler.ts
