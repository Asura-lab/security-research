"""Profile — Overposting туршилтын endpoint.

Alpha: `UpdateProfileRequestAlpha` (`extra='ignore'`). Handler-т `role`, `is_admin`,
`targets` талбар байвал шууд UPDATE-т залгагдана.

Beta: `UpdateProfileRequestBeta` (`extra='forbid'`). Handler зөвхөн `name`, `address`
төдийг ажиллана; мэдэгдээгүй талбар — 400 (`RequestValidationError` → `validation_error`).
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import CurrentUser, get_current_user
from ..db import get_pool
from ..errors import not_found
from ..schemas import (
    Profile,
    ProfileResponse,
    UpdateProfileRequestAlpha,
    UpdateProfileRequestBeta,
)

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
async def get_profile(user: CurrentUser = Depends(get_current_user)) -> ProfileResponse:
    return ProfileResponse(profile=await _fetch(user.id))


@router.put("", response_model=ProfileResponse)
async def update_profile(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> ProfileResponse:
    settings = request.app.state.settings
    body = await request.json()

    if settings.implementation == "beta":
        # Pydantic v2 validation — `extra='forbid'`
        UpdateProfileRequestBeta.model_validate(body)
        await _update_beta(user.id, body)
    else:
        parsed = UpdateProfileRequestAlpha.model_validate(body)
        await _update_alpha(user.id, parsed)
    return ProfileResponse(profile=await _fetch(user.id))


async def _update_alpha(user_id: int, dto: UpdateProfileRequestAlpha) -> None:
    pool = get_pool()
    fields = {}
    if dto.name is not None:
        fields["username"] = dto.name
    if dto.address is not None:
        fields["address"] = dto.address
    if dto.role is not None:
        fields["role"] = dto.role
    if dto.is_admin is not None:
        fields["is_admin"] = dto.is_admin

    async with pool.acquire() as conn:
        if fields:
            columns = list(fields.keys())
            placeholders = [f"${i + 1}" for i in range(len(columns))]
            set_clause = ", ".join(f"{col} = {ph}" for col, ph in zip(columns, placeholders))
            sql = f"UPDATE users SET {set_clause} WHERE id = ${len(columns) + 1}"
            await conn.execute(sql, *fields.values(), user_id)

        if dto.targets:
            targets = await conn.fetch(
                "SELECT id, target_label, target_nonce FROM profile_targets WHERE user_id = $1",
                user_id,
            )
            by_label = {t["target_label"]: t for t in targets}
            for overpost in dto.targets:
                target = by_label.get(overpost.label)
                if target is None:
                    continue
                if overpost.value.strip().lower() != "you are hacked":
                    continue
                marker = f"You are hacked | {target['target_nonce']}"
                await conn.execute(
                    "UPDATE profile_targets SET target_value = $1, updated_at = NOW() WHERE id = $2",
                    marker, target["id"],
                )


async def _update_beta(user_id: int, body: dict[str, Any]) -> None:
    pool = get_pool()
    fields = {}
    if "name" in body:
        fields["username"] = body["name"]
    if "address" in body:
        fields["address"] = body["address"]
    if not fields:
        return
    async with pool.acquire() as conn:
        columns = list(fields.keys())
        placeholders = [f"${i + 1}" for i in range(len(columns))]
        set_clause = ", ".join(f"{col} = {ph}" for col, ph in zip(columns, placeholders))
        sql = f"UPDATE users SET {set_clause} WHERE id = ${len(columns) + 1}"
        await conn.execute(sql, *fields.values(), user_id)


async def _fetch(user_id: int) -> Profile:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, username, email, role, is_admin, address FROM users WHERE id = $1 LIMIT 1",
            user_id,
        )
    if row is None:
        raise not_found("хэрэглэгч олдсонгүй")
    role = "admin" if row["role"] == "admin" else "customer"
    return Profile(
        user_id=row["id"],
        username=row["username"],
        email=row["email"],
        role=role,  # type: ignore[arg-type]
        is_admin=row["is_admin"],
        address=row["address"],
    )


# `dt`-г statically used болгоно (linter warning-с сэргийлэх).
_ = dt.timezone
