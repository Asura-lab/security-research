"""JWT authentication + `Depends`-т ашиглах current_user.

Auth flow нь Raw хувилбарт ч parameterized — судалгааны хувьд SQLi туршилтын гол цэг нь
products search + orders + profile.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from fastapi import Depends, Header, Request

from .config import Settings, load_settings
from .errors import forbidden, unauthorized

Role = Literal["customer", "admin"]


class CurrentUser:
    def __init__(self, user_id: int, role: Role) -> None:
        self.id = user_id
        self.role: Role = role


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def sign_token(settings: Settings, user_id: int, role: Role) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def parse_token(settings: Settings, token: str) -> CurrentUser:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:  # noqa: BLE001
        raise unauthorized("токен буруу") from exc
    sub = payload.get("sub")
    role = payload.get("role")
    if not isinstance(sub, int) or role not in ("customer", "admin"):
        raise unauthorized("токен агуулга буруу")
    return CurrentUser(sub, role)  # type: ignore[arg-type]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise unauthorized("токен байхгүй")
    return parse_token(_settings(request), authorization.removeprefix("Bearer "))


async def get_admin_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise forbidden("хандалт хориотой")
    return user


def _defaultset() -> Settings:
    return load_settings()
