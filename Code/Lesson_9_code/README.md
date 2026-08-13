# Lesson 9 — testing and CI (Python)

The Lesson 8 API with tests. The TypeScript twin is
[`Code/js/Lesson_9_code/`](../js/Lesson_9_code/). Both stacks write the same
version strings to `schema_migrations`, so one database serves both.

## Run it

```shell
cp .env.example .env          # then put a real SECRET_KEY in it
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python migrate.py
uvicorn main:app --port 8008
```

## The four programs

| File | What it proves |
| --- | --- |
| `hash_speed.py` | A SHA-256 table falls in under a millisecond. bcrypt costs the same attacker 27.3 s for the same five accounts. |
| `forge_token.py` | An unsigned token makes the attacker an administrator in three lines. A signature stops it. |
| `event_loop_block.py` | bcrypt on the event loop pushes an unrelated `/healthz` from 3.5 ms to 1727.8 ms. |
| `security.py` | The hand-written token and the PyJWT token are the same bytes. |

## Endpoints

| Method | Path | Credential | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | none | Create an account. 409 on a duplicate email. |
| `POST` | `/auth/login` | none | Set a session cookie. |
| `POST` | `/auth/token` | none | Return a JWT. |
| `GET` | `/auth/me` | cookie or bearer | Report the signed-in user. |
| `POST` | `/auth/logout` | cookie | Delete the session row and clear the cookie. |
| `POST` | `/auth/logout-everywhere` | cookie or bearer | Delete every session of this user. |
| `POST` | `/bookmarks` | cookie or bearer | Create a bookmark, owned by you. |
| `DELETE` | `/bookmarks/{id}` | cookie or bearer | 403 when the row belongs to somebody else. |

## Two routes exist to be deleted

`POST /auth/login-leaky` and `POST /auth/login-blocking` are wrong on purpose.
The lesson measures them, then tells you to delete them. Do not deploy them.

Measured on this machine, PostgreSQL 17.10, bcrypt cost 12:

| Route | Unknown email | Known email |
| --- | --- | --- |
| `/auth/login-leaky` | 6.8 ms | 190.6 ms |
| `/auth/login` | 186.6 ms | 187.3 ms |

## Testing

This project includes integration tests that run against a real PostgreSQL database.

1. Start the test database:
   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```
2. Run the test suite:
   ```bash
   pytest
   ```
