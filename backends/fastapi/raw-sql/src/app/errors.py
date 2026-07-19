"""Contract-т нийцсэн алдааны хариу.

ErrorResponse = { error: <code>, message?: <mn> }.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(HTTPException):
    def __init__(self, status: int, code: str, message: str | None = None) -> None:
        payload: dict[str, Any] = {"error": code}
        if message:
            payload["message"] = message
        super().__init__(status_code=status, detail=payload)


def validation_error(msg: str) -> AppError:
    return AppError(400, "validation_error", msg)


def unauthorized(msg: str | None = None) -> AppError:
    return AppError(401, "invalid_token", msg)


def forbidden(msg: str | None = None) -> AppError:
    return AppError(403, "forbidden", msg)


def not_found(msg: str | None = None) -> AppError:
    return AppError(404, "not_found", msg)


def conflict(msg: str | None = None) -> AppError:
    return AppError(409, "conflict", msg)


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": _default_code(exc.status_code), "message": str(detail)},
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    message = "; ".join(err.get("msg", "invalid") for err in exc.errors())
    return JSONResponse(
        status_code=400,
        content={"error": "validation_error", "message": message},
    )


async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("internal error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "internal"})


def _default_code(status: int) -> str:
    match status:
        case 400:
            return "validation_error"
        case 401:
            return "invalid_token"
        case 403:
            return "forbidden"
        case 404:
            return "not_found"
        case 409:
            return "conflict"
        case _:
            return "internal"
