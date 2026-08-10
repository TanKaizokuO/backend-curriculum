-- Lesson 8 — the account.
--
-- There is no `password` column. There is a `password_hash` column, and the
-- database never learns the password. The CHECK constraint keeps the email
-- lower case, so the UNIQUE index also stops "Ada@example.com" from
-- registering after "ada@example.com".

CREATE TABLE users (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_email_is_lower CHECK (email = lower(email)),
    CONSTRAINT users_email_has_at   CHECK (position('@' IN email) > 1)
);
