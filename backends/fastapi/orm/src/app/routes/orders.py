"""Orders — SQLAlchemy async ORM.

Alpha: `session.get(Order, id)` — ownership check байхгүй.
Beta:  `select(Order).where(Order.id == id, Order.user_id == user.id)`.
"""

from __future__ import annotations

import time
from decimal import Decimal

from fastapi import APIRouter, Depends, Path, Request
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..db import (
    Order as OrderModel,
    OrderItem as OrderItemModel,
    OrderTarget as OrderTargetModel,
    Product as ProductModel,
    TargetSnapshot as SnapshotModel,
    get_session,
)
from ..errors import not_found
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
    body: CreateOrderRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrderResponse:
    order = OrderModel(user_id=user.id, status="pending", total=Decimal(0))
    session.add(order)
    await session.flush()

    total = Decimal(0)
    for item in body.items:
        product = await session.get(ProductModel, item.product_id)
        if product is None:
            raise not_found(f"бараа {item.product_id} олдсонгүй")
        oi = OrderItemModel(
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
        )
        total += product.price * item.quantity
        session.add(oi)
    order.total = total
    await session.commit()
    return OrderResponse(order=await _fetch(session, order.id))


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    request: Request,
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrderResponse:
    order = await _find(session, request.app.state.settings.implementation, order_id, user.id)
    if order is None:
        raise not_found("захиалга олдсонгүй")
    return OrderResponse(order=_serialize(order))


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    body: UpdateOrderRequest,
    request: Request,
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> OrderResponse:
    impl = request.app.state.settings.implementation
    existing = await _find(session, impl, order_id, user.id)
    if existing is None:
        raise not_found("захиалга олдсонгүй")

    if impl == "beta":
        await session.execute(
            update(OrderModel)
            .where(OrderModel.id == order_id, OrderModel.user_id == user.id)
            .values(status=body.status)
        )
    else:
        # ⚠️ Alpha — ownership check байхгүй.
        await session.execute(
            update(OrderModel).where(OrderModel.id == order_id).values(status=body.status)
        )

    if body.status.strip().lower() == "you are hacked":
        target = await session.scalar(
            select(OrderTargetModel).where(
                OrderTargetModel.order_id == order_id,
                OrderTargetModel.vector == "bola_put",
            )
        )
        if target is not None:
            target.target_value = f"You are hacked | {target.target_nonce}"
    await session.commit()
    return OrderResponse(order=await _fetch(session, order_id))


@router.delete("/{order_id}", status_code=204)
async def delete_order(
    request: Request,
    order_id: int = Path(..., ge=1),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    impl = request.app.state.settings.implementation
    existing = await _find(session, impl, order_id, user.id)
    if existing is None:
        raise not_found("захиалга олдсонгүй")

    target = await session.scalar(
        select(OrderTargetModel).where(
            OrderTargetModel.order_id == order_id,
            OrderTargetModel.vector == "bola_delete",
        )
    )

    if impl == "beta":
        result = await session.execute(
            delete(OrderModel).where(OrderModel.id == order_id, OrderModel.user_id == user.id)
        )
        if result.rowcount == 0:
            raise not_found("захиалга олдсонгүй")
    else:
        await session.execute(delete(OrderModel).where(OrderModel.id == order_id))

    if target is not None:
        marker = f"DELETED by hacker | {target.target_nonce}"
        snap = SnapshotModel(
            snapshot_id=f"bola-delete-{order_id}-{int(time.time() * 1000)}",
            target_label=target.target_label,
            value_before=target.target_value,
            value_after=marker,
        )
        session.add(snap)
    await session.commit()


async def _find(
    session: AsyncSession, implementation: str, order_id: int, user_id: int
) -> OrderModel | None:
    if implementation == "beta":
        return await session.scalar(
            select(OrderModel).where(
                OrderModel.id == order_id, OrderModel.user_id == user_id
            )
        )
    return await session.get(OrderModel, order_id)


async def _fetch(session: AsyncSession, order_id: int) -> Order:
    order = await session.get(OrderModel, order_id)
    if order is None:
        raise not_found("захиалга олдсонгүй")
    return _serialize(order)


def _serialize(order: OrderModel) -> Order:
    return Order(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        total=float(order.total),
        items=[
            OrderItem(
                product_id=item.product_id or 0,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
            )
            for item in order.items
        ],
    )
