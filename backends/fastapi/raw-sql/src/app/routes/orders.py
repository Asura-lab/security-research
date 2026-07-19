"""Orders — BOLA туршилтын гол endpoint.

Alpha: `WHERE id = $1` — ownership check байхгүй, attacker өөр захиалга харна.
Beta:  `WHERE id = $1 AND user_id = $2`.

Raw хувилбар тул `UPDATE orders SET status = '...' WHERE id = ...` f-string interp
ашиглаад SQLi + ownership guard-ын мөрдлөгөө хос ажлыг харуулна.
"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, Path, Request

from ..auth import CurrentUser, get_current_user
from ..db import get_pool
from ..errors import not_found, validation_error
from ..schemas import (
    CreateOrderRequest,
    Order,
    OrderItem,
    OrderResponse,
    UpdateOrderRequest,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(
    body: CreateOrderRequest, user: CurrentUser = Depends(get_current_user)
) -> OrderResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            order_id = await conn.fetchval(
                "INSERT INTO orders (user_id, status, total) VALUES ($1, 'pending', 0) RETURNING id",
                user.id,
            )
            total = 0.0
            for item in body.items:
                price_row = await conn.fetchrow(
                    "SELECT price::text AS price FROM products WHERE id = $1", item.product_id
                )
                if price_row is None:
                    raise not_found(f"бараа {item.product_id} олдсонгүй")
                unit_price = float(price_row["price"])
                total += unit_price * item.quantity
                await conn.execute(
                    "INSERT INTO order_items (order_id, product_id, quantity, unit_price) "
                    "VALUES ($1, $2, $3, $4)",
                    order_id, item.product_id, item.quantity, unit_price,
                )
            await conn.execute("UPDATE orders SET total = $1 WHERE id = $2", total, order_id)
    return OrderResponse(order=await _fetch_order(order_id))


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    request: Request | None = None,
) -> OrderResponse:
    settings = request.app.state.settings  # type: ignore[union-attr]
    row = await _find_order(settings.implementation, order_id, user.id)
    if row is None:
        raise not_found("захиалга олдсонгүй")
    return OrderResponse(order=await _assemble(row))


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    body: UpdateOrderRequest,
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    request: Request | None = None,
) -> OrderResponse:
    settings = request.app.state.settings  # type: ignore[union-attr]
    row = await _find_order(settings.implementation, order_id, user.id)
    if row is None:
        raise not_found("захиалга олдсонгүй")

    pool = get_pool()
    async with pool.acquire() as conn:
        if settings.implementation == "beta":
            await conn.execute(
                "UPDATE orders SET status = $1 WHERE id = $2 AND user_id = $3",
                body.status, order_id, user.id,
            )
        else:
            # ⚠️ Alpha — string interpolation + ownership check байхгүй.
            sql = f"UPDATE orders SET status = '{body.status}' WHERE id = {order_id}"
            await conn.execute(sql)

        # BOLA PUT marker mutation
        if body.status.strip().lower() == "you are hacked":
            target = await conn.fetchrow(
                "SELECT id, target_nonce FROM order_targets "
                "WHERE order_id = $1 AND vector = 'bola_put' LIMIT 1",
                order_id,
            )
            if target is not None:
                marker = f"You are hacked | {target['target_nonce']}"
                await conn.execute(
                    "UPDATE order_targets SET target_value = $1, updated_at = NOW() WHERE id = $2",
                    marker, target["id"],
                )
    return OrderResponse(order=await _fetch_order(order_id))


@router.delete("/{order_id}", status_code=204)
async def delete_order(
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    request: Request | None = None,
) -> None:
    settings = request.app.state.settings  # type: ignore[union-attr]
    row = await _find_order(settings.implementation, order_id, user.id)
    if row is None:
        raise not_found("захиалга олдсонгүй")

    pool = get_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow(
            "SELECT target_label, target_nonce, target_value FROM order_targets "
            "WHERE order_id = $1 AND vector = 'bola_delete' LIMIT 1",
            order_id,
        )

        if settings.implementation == "beta":
            result = await conn.execute(
                "DELETE FROM orders WHERE id = $1 AND user_id = $2", order_id, user.id
            )
            if not result.endswith(" 1"):
                raise not_found("захиалга олдсонгүй")
        else:
            await conn.execute(f"DELETE FROM orders WHERE id = {order_id}")

        if target is not None:
            marker = f"DELETED by hacker | {target['target_nonce']}"
            await conn.execute(
                "INSERT INTO target_snapshots (snapshot_id, target_label, value_before, value_after) "
                "VALUES ($1, $2, $3, $4)",
                f"bola-delete-{order_id}-{int(time.time() * 1000)}",
                target["target_label"], target["target_value"], marker,
            )


async def _find_order(implementation: str, order_id: int, user_id: int) -> Any:
    if not isinstance(order_id, int):
        raise validation_error("id integer байх ёстой")
    pool = get_pool()
    async with pool.acquire() as conn:
        if implementation == "beta":
            return await conn.fetchrow(
                "SELECT id, user_id, status, total::text AS total FROM orders "
                "WHERE id = $1 AND user_id = $2 LIMIT 1",
                order_id, user_id,
            )
        # ⚠️ Alpha — ownership check байхгүй, f-string.
        return await conn.fetchrow(
            f"SELECT id, user_id, status, total::text AS total FROM orders WHERE id = {order_id} LIMIT 1"
        )


async def _fetch_order(order_id: int) -> Order:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, user_id, status, total::text AS total FROM orders WHERE id = $1 LIMIT 1",
            order_id,
        )
    if row is None:
        raise not_found("захиалга олдсонгүй")
    return await _assemble(row)


async def _assemble(row: Any) -> Order:
    pool = get_pool()
    async with pool.acquire() as conn:
        items = await conn.fetch(
            "SELECT product_id, quantity, unit_price::text AS unit_price "
            "FROM order_items WHERE order_id = $1 ORDER BY id",
            row["id"],
        )
    return Order(
        id=row["id"],
        user_id=row["user_id"],
        status=row["status"],
        total=float(row["total"]),
        items=[
            OrderItem(
                product_id=item["product_id"] or 0,
                quantity=item["quantity"],
                unit_price=float(item["unit_price"]),
            )
            for item in items
        ],
    )
