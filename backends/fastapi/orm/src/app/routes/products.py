"""Products — SQLAlchemy select expressions нь автомат параметрлэгддэг.

SQLi 3 вектор бүгд хаагдана (Alpha хувилбарт ч гэсэн). Alpha/Beta ялгаа Products-т байхгүй.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Product as ProductModel, get_session
from ..errors import not_found
from ..schemas import Product, ProductListResponse, ProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    min_price: str | None = Query(default=None),
    max_price: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
) -> ProductListResponse:
    stmt = select(ProductModel)
    if search is not None:
        stmt = stmt.where(ProductModel.name.like(f"%{search}%"))
    if category is not None:
        stmt = stmt.where(ProductModel.category_id == int(category))
    if min_price is not None:
        stmt = stmt.where(ProductModel.price >= float(min_price))
    if max_price is not None:
        stmt = stmt.where(ProductModel.price <= float(max_price))
    stmt = stmt.order_by(ProductModel.id.asc()).limit(limit)
    result = await session.scalars(stmt)
    items = [_dto(p) for p in result.all()]
    return ProductListResponse(items=items)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int, session: AsyncSession = Depends(get_session)
) -> ProductResponse:
    product = await session.get(ProductModel, product_id)
    if product is None:
        raise not_found("бараа олдсонгүй")
    return ProductResponse(product=_dto(product))


def _dto(p: ProductModel) -> Product:
    return Product(
        id=p.id,
        name=p.name,
        description=p.description,
        price=float(p.price),
        category_id=p.category_id,
    )
