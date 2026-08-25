-- Lesson 8 — server-side sessions.
--
-- The cookie holds the id and nothing else. Every fact about the user stays
-- on this side of the network. DELETE FROM sessions is a logout that works
-- at once, which is the property a signed token cannot give you.

CREATE TABLE sessions (
    id          TEXT        PRIMARY KEY,   -- 32 random bytes, hex encoded
    user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX sessions_user_id_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
