"""FastAPI Raw SQL entry point.

Feature flag:
  IMPLEMENTATION=alpha (default)  — vulnerable
  IMPLEMENTATION=beta             — fixed (Pydantic extra=forbid, ownership check)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError

from .config import VARIANT_NAME, load_settings
from .db import close_pool, init_pool
from .errors import (
    http_error_handler,
    unexpected_error_handler,
    validation_error_handler,
)
from .routes import admin, auth, orders, products, profile
from .schemas import HealthResponse
from .telemetry import StatsdMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = load_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_pool(settings)
    logger.info("%s (%s) started", VARIANT_NAME, settings.implementation)
    try:
        yield
    finally:
        await close_pool()


app = FastAPI(
    title=f"security-research/{VARIANT_NAME}",
    lifespan=lifespan,
)
app.state.settings = settings
app.add_middleware(StatsdMiddleware, settings=settings)

app.add_exception_handler(HTTPException, http_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unexpected_error_handler)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(profile.router)
app.include_router(admin.router)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        variant=VARIANT_NAME,
        implementation=settings.implementation,
    )
