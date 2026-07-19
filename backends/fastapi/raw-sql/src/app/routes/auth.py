"""Auth routes — register + login."""

from __future__ import annotations

from fastapi import APIRouter, Request

from ..auth import hash_password, sign_token, verify_password
from ..db import get_pool
from ..errors import conflict, unauthorized
from ..schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(body: RegisterRequest) -> RegisterResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
            body.username,
            body.email,
        )
        if existing is not None:
            raise conflict("username эсвэл email аль хэдийн байна")
        row = await conn.fetchrow(
            """INSERT INTO users (username, email, password_hash, role, is_admin)
               VALUES ($1, $2, $3, 'customer', FALSE)
               RETURNING id""",
            body.username,
            body.email,
            hash_password(body.password),
        )
    return RegisterResponse(user_id=row["id"], username=body.username, role="customer")


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request) -> LoginResponse:
    settings = request.app.state.settings
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash, role FROM users WHERE username = $1 LIMIT 1",
            body.username,
        )
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
    role = "admin" if row["role"] == "admin" else "customer"
    token = sign_token(settings, row["id"], role)  # type: ignore[arg-type]
    return LoginResponse(access_token=token, role=role, user_id=row["id"])  # type: ignore[arg-type]
