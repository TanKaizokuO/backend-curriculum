# Lesson 13 — version control (Python)

`demo.sh` is the whole lesson, runnable. It builds a throwaway repository at
`repo/` and a throwaway bare remote at `origin.git/`, both deleted and
rebuilt on every run, and prints the exact transcript quoted in
`../../lessons/0013-version-control.html`.

The TypeScript twin is
[`Code/js/Lesson_13_code/`](../js/Lesson_13_code/).

## Run it

```shell
./demo.sh
```

It needs `git` on `PATH` and nothing else — no database, no server, no
dependencies.

## What it does, in order

1. **An object, by hand.** `git hash-object`, `git cat-file`, `git
   write-tree`, `git commit-tree` build one commit without `git commit`, to
   show the blob → tree → commit graph the porcelain commands hide.
2. **Two branches touch the same handler.** `alice-caching` and
   `bob-logging` each edit `handler.py`'s `get_bookmark` function on
   different lines of the same block.
3. **Merge.** `git merge` produces a real conflict, resolved by hand, and a
   merge commit with two parents.
4. **Rebase.** The same two commits, rebased instead of merged: the same
   conflict, but a linear history with no merge commit, and a new commit
   hash for the replayed commit.
5. **Force-push loses an approved commit.** A local `git reset --hard
   HEAD~1` followed by `git push --force` erases a commit that was already
   reviewed and pushed.
6. **`git reflog` recovers it.** The dropped commit is still reachable from
   the local reflog. `git reset --hard` back to it, then force-push again,
   restores `origin/main`.

Read `demo.sh` top to bottom; every `git` command in the lesson is in there,
in the order it runs.
