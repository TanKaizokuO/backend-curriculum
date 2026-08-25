# Lesson 13 — version control (TypeScript)

Version control has no per-language mechanism — `git` does not care which
language `handler.ts` is written in. This twin repeats only the merge
conflict, on a TypeScript handler, to show the same failure lands the same
way regardless of language. Rebase and the force-push/reflog rescue are not
repeated; run them in
[`Code/Lesson_13_code/`](../../Lesson_13_code/), the full version.

## Run it

```shell
./demo.sh
```

It needs `git` on `PATH` and nothing else. It builds a throwaway repository
at `repo/`, deleted and rebuilt on every run.

## What it does

Two branches, `alice-caching` and `bob-logging`, each edit the same
`getBookmark` function in `handler.ts`. Merging `bob-logging` into
`alice-caching` produces a real conflict, printed at the end of the script.
