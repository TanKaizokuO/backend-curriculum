#!/usr/bin/env bash
# Lesson 13 — version control.
# Runs every command shown in the lesson, against a throwaway repository.
# Safe to run more than once: it deletes and rebuilds ./repo and ./origin.git
# each time.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
rm -rf repo origin.git
git init -q --bare origin.git

git init -q repo
cd repo
git config user.email "dev@example.com"
git config user.name "dev"
git symbolic-ref HEAD refs/heads/main
git remote add origin ../origin.git

echo "=== Part 1: an object, by hand ==="
echo "hello backend" > file.txt
BLOB=$(git hash-object -w file.txt)
echo "blob:   $BLOB"
git cat-file -p "$BLOB"
git update-index --add --cacheinfo 100644 "$BLOB" file.txt
TREE=$(git write-tree)
echo "tree:   $TREE"
git cat-file -p "$TREE"
COMMIT=$(echo "first commit" | git commit-tree "$TREE")
echo "commit: $COMMIT"
git cat-file -p "$COMMIT"
git update-ref refs/heads/main "$COMMIT"

echo
echo "=== Part 2: the shared handler, and two branches that touch it ==="
cat > handler.py << 'EOF'
def get_bookmark(bookmark_id: int):
    row = db.execute(
        "SELECT id, url, title FROM bookmarks WHERE id = %s",
        (bookmark_id,),
    )
    if row is None:
        raise HTTPException(status_code=404)
    return row
EOF
git add handler.py
git commit -q -m "add get_bookmark handler"
BASE=$(git rev-parse HEAD)
git push -q origin main
echo "approved on origin/main: $(git rev-parse --short "$BASE") add get_bookmark handler"

git checkout -q -b alice-caching
cat > handler.py << 'EOF'
def get_bookmark(bookmark_id: int):
    cached = cache.get(f"bookmark:{bookmark_id}")
    if cached is not None:
        return cached
    row = db.execute(
        "SELECT id, url, title FROM bookmarks WHERE id = %s",
        (bookmark_id,),
    )
    if row is None:
        raise HTTPException(status_code=404)
    cache.set(f"bookmark:{bookmark_id}", row, ttl=30)
    return row
EOF
git add handler.py
git commit -q -m "cache get_bookmark reads"
ALICE=$(git rev-parse HEAD)

git checkout -q main
git checkout -q -b bob-logging
cat > handler.py << 'EOF'
def get_bookmark(bookmark_id: int):
    log.info("fetching bookmark", bookmark_id=bookmark_id)
    row = db.execute(
        "SELECT id, url, title FROM bookmarks WHERE id = %s",
        (bookmark_id,),
    )
    if row is None:
        raise HTTPException(status_code=404)
    return row
EOF
git add handler.py
git commit -q -m "log get_bookmark reads"
BOB=$(git rev-parse HEAD)

git log --all --oneline --graph

echo
echo "=== Part 3: merge — both parents survive ==="
git checkout -q alice-caching
set +e
git merge bob-logging -m "merge bob-logging into alice-caching"
set -e
echo "--- conflict markers in handler.py ---"
cat handler.py
cat > handler.py << 'EOF'
def get_bookmark(bookmark_id: int):
    log.info("fetching bookmark", bookmark_id=bookmark_id)
    cached = cache.get(f"bookmark:{bookmark_id}")
    if cached is not None:
        return cached
    row = db.execute(
        "SELECT id, url, title FROM bookmarks WHERE id = %s",
        (bookmark_id,),
    )
    if row is None:
        raise HTTPException(status_code=404)
    cache.set(f"bookmark:{bookmark_id}", row, ttl=30)
    return row
EOF
git add handler.py
git commit -q -m "merge bob-logging into alice-caching"
echo "--- history keeps both lines, joined by one commit with two parents ---"
git log --oneline --graph
echo "--- the merge commit's own object ---"
git cat-file -p HEAD

echo
echo "=== Part 4: rebase — the same conflict, replayed onto a new parent ==="
git checkout -q bob-logging -b bob-logging-rebase
set +e
git rebase "$ALICE"
set -e
echo "--- conflict markers during the rebase ---"
cat handler.py
cat > handler.py << 'EOF'
def get_bookmark(bookmark_id: int):
    log.info("fetching bookmark", bookmark_id=bookmark_id)
    cached = cache.get(f"bookmark:{bookmark_id}")
    if cached is not None:
        return cached
    row = db.execute(
        "SELECT id, url, title FROM bookmarks WHERE id = %s",
        (bookmark_id,),
    )
    if row is None:
        raise HTTPException(status_code=404)
    cache.set(f"bookmark:{bookmark_id}", row, ttl=30)
    return row
EOF
git add handler.py
GIT_EDITOR=true git rebase --continue
echo "--- history is a straight line, no merge commit ---"
git log --oneline --graph
echo "bob's commit before the rebase: $(git rev-parse --short "$BOB")"
echo "bob's commit after the rebase:  $(git rev-parse --short HEAD)"

echo
echo "=== Part 5: force-push loses the approved commit, reflog gets it back ==="
git checkout -q main
git reset -q --hard "$BASE"
echo "before: $(git log --oneline -1)"
echo "--- a bad local rebase drops the approved commit ---"
git reset -q --hard HEAD~1
git log --oneline -2
echo "--- force-push overwrites the shared branch ---"
git push -q --force origin main
echo "origin/main now points at: $(git ls-remote origin main | cut -c1-7)"
echo
echo "--- git reflog: HEAD's own history, kept locally ---"
git reflog -3
echo
echo "--- recover: reset to the reflog entry, then force-push it back ---"
git reset -q --hard "$BASE"
git log --oneline -1
git push -q --force origin main
echo "origin/main now points at: $(git ls-remote origin main | cut -c1-7)"
