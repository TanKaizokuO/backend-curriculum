CREATE TABLE bookmarks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url         TEXT        NOT NULL UNIQUE,
    title       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
