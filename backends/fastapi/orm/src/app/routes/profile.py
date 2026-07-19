"""Profile — Overposting туршилтын endpoint (SQLAlchemy).

Alpha: DTO `extra='ignore'` — гэхдээ `role`, `is_admin`, `targets` талбаруудыг DTO-д тодорхойлсон
тул тэдгээр талбаруудыг accept болгоно.
Beta:  DTO `extra='forbid'` — мэдэгдээгүй талбар 400.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..db import (
    ProfileTarget as ProfileTargetModel,
    User as UserModel,
    get_session,
)
from ..errors import not_found
from ..schemas import (
    Profile,
    ProfileResponse,
    UpdateProfileRequestAlpha,
    UpdateProfileRequestBeta,
)

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileResponse:
    return ProfileResponse(profile=await _fetch(session, user.id))


@router.put("", response_model=ProfileResponse)
async def update_profile(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileResponse:
    body = await request.json()
    impl = request.app.state.settings.implementation
    if impl == "beta":
        UpdateProfileRequestBeta.model_validate(body)
        await _update_beta(session, user.id, body)
    else:
        parsed = UpdateProfileRequestAlpha.model_validate(body)
        await _update_alpha(session, user.id, parsed)
    await session.commit()
    return ProfileResponse(profile=await _fetch(session, user.id))


async def _update_alpha(
    session: AsyncSession, user_id: int, dto: UpdateProfileRequestAlpha
) -> None:
    values: dict[str, Any] = {}
    if dto.name is not None:
        values["username"] = dto.name
    if dto.address is not None:
        values["address"] = dto.address
    if dto.role is not None:
        values["role"] = dto.role
    if dto.is_admin is not None:
        values["is_admin"] = dto.is_admin
    if values:
        await session.execute(update(UserModel).where(UserModel.id == user_id).values(**values))

    if dto.targets:
        result = await session.scalars(
            select(ProfileTargetModel).where(ProfileTargetModel.user_id == user_id)
        )
        targets = {t.target_label: t for t in result.all()}
        for overpost in dto.targets:
            target = targets.get(overpost.label)
            if target is None:
                continue
            if overpost.value.strip().lower() != "you are hacked":
                continue
            target.target_value = f"You are hacked | {target.target_nonce}"


async def _update_beta(session: AsyncSession, user_id: int, body: dict[str, Any]) -> None:
    values: dict[str, Any] = {}
    if "name" in body:
        values["username"] = body["name"]
    if "address" in body:
        values["address"] = body["address"]
    if values:
        await session.execute(update(UserModel).where(UserModel.id == user_id).values(**values))


async def _fetch(session: AsyncSession, user_id: int) -> Profile:
    user = await session.get(UserModel, user_id)
    if user is None:
        raise not_found("хэрэглэгч олдсонгүй")
    role = "admin" if user.role == "admin" else "customer"
    return Profile(
        user_id=user.id,
        username=user.username,
        email=user.email,
        role=role,  # type: ignore[arg-type]
        is_admin=user.is_admin,
        address=user.address,
    )
