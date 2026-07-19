"""Auth routes (SQLAlchemy)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import hash_password, sign_token, verify_password
from ..db import User, get_session
from ..errors import conflict, unauthorized
from ..schemas import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest, session: AsyncSession = Depends(get_session)
) -> RegisterResponse:
    existing = await session.scalar(
        select(User).where(or_(User.username == body.username, User.email == body.email))
    )
    if existing is not None:
        raise conflict("username эсвэл email аль хэдийн байна")
    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role="customer",
        is_admin=False,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return RegisterResponse(user_id=user.id, username=user.username, role="customer")


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    user = await session.scalar(select(User).where(User.username == body.username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise unauthorized("нэвтрэх нэр эсвэл нууц үг буруу")
    role = "admin" if user.role == "admin" else "customer"
    token = sign_token(request.app.state.settings, user.id, role)  # type: ignore[arg-type]
    return LoginResponse(access_token=token, role=role, user_id=user.id)  # type: ignore[arg-type]
