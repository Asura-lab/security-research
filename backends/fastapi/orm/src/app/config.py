"""FastAPI SQLAlchemy ORM хувилбарын env config."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

VARIANT_NAME = "fastapi-orm"
HTTP_PORT = 5002

Implementation = Literal["alpha", "beta"]


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int
    statsd_host: str | None
    statsd_port: int
    implementation: Implementation


def load_settings() -> Settings:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "research123")
    dbname = os.getenv("POSTGRES_DB", "shop")
    # SQLAlchemy async driver — postgresql+asyncpg
    database_url = os.getenv(
        "DATABASE_URL",
        f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{dbname}",
    )

    impl = os.getenv("IMPLEMENTATION", "alpha")
    if impl not in ("alpha", "beta"):
        impl = "alpha"

    statsd_host = os.getenv("DD_AGENT_HOST") or None
    statsd_port = int(os.getenv("DD_DOGSTATSD_PORT", "8125"))

    return Settings(
        database_url=database_url,
        jwt_secret=os.getenv("JWT_SECRET", "research-jwt-secret"),
        jwt_expires_minutes=int(os.getenv("JWT_EXPIRES_MINUTES", "15")),
        statsd_host=statsd_host,
        statsd_port=statsd_port,
        implementation=impl,  # type: ignore[arg-type]
    )
