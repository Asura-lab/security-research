"""Detection endpoint — админ токенээр хандаж target-уудын статусыг буцаана."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..auth import CurrentUser, get_admin_user
from ..db import get_pool
from ..schemas import TargetsStatusResponse, TargetStatus

router = APIRouter(prefix="/api/admin/targets", tags=["admin"])


@router.get("/status", response_model=TargetsStatusResponse)
async def targets_status(
    label: str | None = Query(default=None),
    _: CurrentUser = Depends(get_admin_user),
) -> TargetsStatusResponse:
    pool = get_pool()
    targets: list[TargetStatus] = []
    async with pool.acquire() as conn:
        if label:
            secrets = await conn.fetch(
                "SELECT secret_label, secret_value, secret_nonce FROM secrets "
                "WHERE secret_label = $1 ORDER BY id",
                label,
            )
            order_targets = await conn.fetch(
                "SELECT target_label, target_value, target_nonce FROM order_targets "
                "WHERE target_label = $1 ORDER BY id",
                label,
            )
            deletes = await conn.fetch(
                "SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value "
                "FROM target_snapshots "
                "WHERE target_label LIKE 'WRITE_ORD_DEL_%' AND target_label = $1 "
                "ORDER BY target_label, snapshot_ts DESC",
                label,
            )
            profile_targets = await conn.fetch(
                "SELECT target_label, target_value, target_nonce FROM profile_targets "
                "WHERE target_label = $1 ORDER BY id",
                label,
            )
        else:
            secrets = await conn.fetch(
                "SELECT secret_label, secret_value, secret_nonce FROM secrets ORDER BY id"
            )
            order_targets = await conn.fetch(
                "SELECT target_label, target_value, target_nonce FROM order_targets ORDER BY id"
            )
            deletes = await conn.fetch(
                "SELECT DISTINCT ON (target_label) target_label AS label, value_after AS value "
                "FROM target_snapshots WHERE target_label LIKE 'WRITE_ORD_DEL_%' "
                "ORDER BY target_label, snapshot_ts DESC"
            )
            profile_targets = await conn.fetch(
                "SELECT target_label, target_value, target_nonce FROM profile_targets ORDER BY id"
            )

    for s in secrets:
        targets.append(
            TargetStatus(
                label=s["secret_label"], kind="read",
                value=s["secret_value"], nonce=s["secret_nonce"],
            )
        )
    for t in order_targets:
        targets.append(
            TargetStatus(
                label=t["target_label"], kind="write",
                value=t["target_value"], nonce=t["target_nonce"],
            )
        )
    for row in deletes:
        if row["value"] is None:
            continue
        nonce = row["value"].split("|")[-1].strip() if "|" in row["value"] else ""
        targets.append(
            TargetStatus(
                label=row["label"], kind="write",
                value=row["value"], nonce=nonce, deleted=True,
            )
        )
    for t in profile_targets:
        targets.append(
            TargetStatus(
                label=t["target_label"], kind="write",
                value=t["target_value"], nonce=t["target_nonce"],
            )
        )
    return TargetsStatusResponse(targets=targets)
