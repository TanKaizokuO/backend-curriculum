"""Every value that changes between deploys, in one typed object.

The rule (twelve-factor, factor III): configuration lives in the environment,
not in the source. The test is simple. If you make this repository public
today, do you leak a credential? With this file, no.

    from config import settings
    settings.database_url

A missing or malformed value raises at import time with a message that names
the variable. A container that cannot start is better than a container that
starts and writes to the wrong database.
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

    @property
    def dsn(self) -> str:
        """psycopg wants a string, not a PostgresDsn object."""
        return str(self.database_url)


try:
    settings = Settings()
except ValidationError as exc:
    raise SystemExit(f"Bad configuration.\n{exc}") from exc
