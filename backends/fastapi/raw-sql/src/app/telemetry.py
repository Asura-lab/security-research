"""Datadog statsd — хүсэлт бүрд duration + count."""

from __future__ import annotations

import logging
import time
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

try:
    from datadog import DogStatsd
except ImportError:  # pragma: no cover
    DogStatsd = None  # type: ignore[assignment]

from .config import VARIANT_NAME, Settings


class StatsdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self._tags = [
            f"variant:{VARIANT_NAME}",
            f"implementation:{settings.implementation}",
        ]
        self._client: DogStatsd | None = None
        if settings.statsd_host and DogStatsd is not None:
            try:
                self._client = DogStatsd(
                    host=settings.statsd_host, port=settings.statsd_port,
                    constant_tags=list(self._tags),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("statsd init failed: %s", exc)
                self._client = None
        elif not settings.statsd_host:
            logger.info("telemetry disabled — DD_AGENT_HOST өгөгдөөгүй")

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        if self._client is not None:
            tags = [
                f"route:{request.url.path}",
                f"method:{request.method}",
                f"status:{response.status_code}",
            ]
            try:
                self._client.timing("http.request.duration", duration_ms, tags=tags)
                self._client.increment("http.request.count", tags=tags)
            except Exception:  # noqa: BLE001
                pass
        return response
