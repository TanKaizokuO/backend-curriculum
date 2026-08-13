# Lesson 9 — testing and CI (TypeScript)

The TypeScript twin of [`Code/Lesson_9_code/`](../../Lesson_9_code/). Same
routes, same status codes, same database. Node 22.6 and later run TypeScript
directly, so there is no build step and no bundler.

## Run it

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
npm install
npm run migrate
npm start                     # http://localhost:8009
npm run typecheck             # tsc --noEmit; the runtime never checks types
```

`node src/server.ts` strips the types and runs the JavaScript. It does not
check them. `npm run typecheck` is the only thing that does.

## The four programs

| Command | What it proves |
| --- | --- |
| `npm run hash-speed` | The same word list breaks the SHA-256 table in 0.18 ms and the bcrypt table in 24.5 s. |
| `npm run forge` | A forged token is a well-typed string. TypeScript does not stop it; a signature does. |
| `npm run block` | `bcrypt.compareSync` pushes an unrelated `/healthz` from 3.3 ms to 1192.8 ms. |
| `npm run security` | The hand-written token and the `jsonwebtoken` token are the same bytes. |

## Differences from the Python version that are real

1. **Validation.** FastAPI validates from the type annotation. TypeScript
    types disappear at run time, so zod does that work in each handler.
2. **The seam.** FastAPI has `Depends(current_user)`. Express has
    `requireUser` middleware in front of the route.
3. **The thread pool.** `bcrypt.hash` uses the libuv pool.
    `bcrypt.hashSync` does not, and it stops the whole process.
4. **Integer width.** `node-postgres` returns `bigint` as a string, so
    `bookmarks.id` arrives as `"200002"` while `users.id` arrives as `4`.
    psycopg returns both as numbers.

## Testing

This project includes integration tests that run against a real PostgreSQL database.

1. Start the test database:
   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```
2. Run the test suite:
   ```bash
   npm run test
   ```
