"""Lesson 7's configuration object, plus the three values that authentication
needs.

The new values are secrets or policy, so they belong in the environment with
the DSN. `secret_key` signs every token. If it leaks, every token in the world
becomes forgeable, so it never enters the source and never enters the image.

    from config import settings
    settings.secret_key
"""

from pydantic import Field, PostgresDsn, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",            # local development only; never committed
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: PostgresDsn
    app_env: str = "development"
    log_level: str = "info"
    pool_min_size: int = Field(default=1, ge=1)
    pool_max_size: int = Field(default=10, ge=1)

    # --- Lesson 8 ---------------------------------------------------------
    # 32 bytes of randomness, hex encoded. Generate one with:
    #     python -c "import secrets; print(secrets.token_hex(32))"
    secret_key: str = Field(min_length=32)
    # A token cannot be withdrawn, so keep the window short.
    token_ttl_minutes: int = Field(default=15, ge=1)
    # A session can be withdrawn, so the window may be long.
    session_ttl_minutes: int = Field(default=60 * 24 * 7, ge=1)
    # bcrypt work factor. Each step doubles the cost.
    bcrypt_rounds: int = Field(default=12, ge=4, le=16)

    @property
    def dsn(self) -> str:
        """psycopg wants a string, not a PostgresDsn object."""
        return str(self.database_url)

    @property
    def cookie_secure(self) -> bool:
        """Send the cookie over HTTPS only, except on a development machine."""
        return self.app_env != "development"


try:
    settings = Settings()
except ValidationError as exc:
    raise SystemExit(f"Bad configuration.\n{exc}") from exc
