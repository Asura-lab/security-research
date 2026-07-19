"""Admin detection endpoint — SQLAlchemy хувилбар."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_admin_user
from ..db import (
    OrderTarget as OrderTargetModel,
    ProfileTarget as ProfileTargetModel,
    Secret as SecretModel,
    get_session,
)
from ..schemas import TargetStatus, TargetsStatusResponse

router = APIRouter(prefix="/api/admin/targets", tags=["admin"])


@router.get("/status", response_model=TargetsStatusResponse)
async def targets_status(
    label: str | None = Query(default=None),
    _: CurrentUser = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
) -> TargetsStatusResponse:
    targets: list[TargetStatus] = []

    secrets_stmt = select(SecretModel).order_by(SecretModel.id.asc())
    if label:
        secrets_stmt = secrets_stmt.where(SecretModel.secret_label == label)
    for s in (await session.scalars(secrets_stmt)).all():
        targets.append(
            TargetStatus(
                label=s.secret_label, kind="read",
                value=s.secret_value, nonce=s.secret_nonce,
            )
        )

    orders_stmt = select(OrderTargetModel).order_by(OrderTargetModel.id.asc())
    if label:
        orders_stmt = orders_stmt.where(OrderTargetModel.target_label == label)
    for t in (await session.scalars(orders_stmt)).all():
        targets.append(
            TargetStatus(
                label=t.target_label, kind="write",
                value=t.target_value, nonce=t.target_nonce,
            )
        )

    # BOLA DELETE snapshot
    if label:
        sql = text(
            "SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value "
            "FROM target_snapshots "
            "WHERE target_label LIKE 'WRITE_ORD_DEL_%' AND target_label = :label "
            "ORDER BY target_label, snapshot_ts DESC"
        )
        rows = (await session.execute(sql, {"label": label})).mappings().all()
    else:
        sql = text(
            "SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value "
            "FROM target_snapshots "
            "WHERE target_label LIKE 'WRITE_ORD_DEL_%' "
            "ORDER BY target_label, snapshot_ts DESC"
        )
        rows = (await session.execute(sql)).mappings().all()
    for row in rows:
        value = row["value"]
        if value is None:
            continue
        nonce = value.split("|")[-1].strip() if "|" in value else ""
        targets.append(
            TargetStatus(
                label=row["label"], kind="write",
                value=value, nonce=nonce, deleted=True,
            )
        )

    profile_stmt = select(ProfileTargetModel).order_by(ProfileTargetModel.id.asc())
    if label:
        profile_stmt = profile_stmt.where(ProfileTargetModel.target_label == label)
    for t in (await session.scalars(profile_stmt)).all():
        targets.append(
            TargetStatus(
                label=t.target_label, kind="write",
                value=t.target_value, nonce=t.target_nonce,
            )
        )

    return TargetsStatusResponse(targets=targets)
