# Lesson 16 — rules the browser enforces (TypeScript)

The TypeScript twin of [`Code/Lesson_16_code/`](../../Lesson_16_code/).
Same two origins, same environment variables, same static assets
(`src/static/` is a copy of the Python project's `static/` — CORS, CSP,
and cookies are protocol rules, not language features, so the HTML and
client JS need no porting at all).

## Run the demo

```shell
npm install
./demo.sh
```

Needs `node` and `curl`. Open `http://127.0.0.1:8051/` in a real browser
(with `src/api.ts` running and `CORS_ALLOW=on`) to see the console errors
and cookie behaviour curl cannot show — identical to the Python project's,
down to the exact error text, because both are the same Chromium engine
enforcing the same rules.

## What it does, in order

Identical to [`Code/Lesson_16_code/README.md`](../../Lesson_16_code/README.md#what-it-does-in-order):
`src/api.ts` is the API origin on `http://127.0.0.2:8040`,
`src/staticSite.ts` is the static origin on `http://127.0.0.1:8051`. The
same `CORS_ALLOW`, `COOKIE_SAMESITE`, and `CSP_MODE` environment variables
switch on the same fixes.
