"""Products — SQLi туршилтын гол цэг.

Alpha: `search`, `category`, `min_price`, `max_price`-г f-string interpolation-аар query-т залгана.
Beta:  `asyncpg`-ийн parameterized query. SQLi 3 вектор бүгд хаагдана.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from ..db import get_pool
from ..errors import not_found
from ..schemas import Product, ProductListResponse, ProductResponse

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    request: Request,
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    min_price: str | None = Query(default=None),
    max_price: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=50),
) -> ProductListResponse:
    settings = request.app.state.settings
    pool = get_pool()

    if settings.implementation == "beta":
        rows = await _list_beta(pool, search, category, min_price, max_price, limit)
    else:
        rows = await _list_alpha(pool, search, category, min_price, max_price, limit)

    items = [_row_to_product(r) for r in rows]
    return ProductListResponse(items=items)


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int) -> ProductResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, name, description, price::text AS price, category_id "
            "FROM products WHERE id = $1 LIMIT 1",
            product_id,
        )
    if row is None:
        raise not_found("бараа олдсонгүй")
    return ProductResponse(product=_row_to_product(row))


# ⚠️ Alpha — vulnerable-by-design. f-string interpolation.
async def _list_alpha(
    pool: Any,
    search: str | None,
    category: str | None,
    min_price: str | None,
    max_price: str | None,
    limit: int,
) -> list[Any]:
    clauses = ["1=1"]
    if search is not None:
        clauses.append(f"name LIKE '%{search}%'")
    if category is not None:
        clauses.append(f"category_id = {category}")
    if min_price is not None:
        clauses.append(f"price >= {min_price}")
    if max_price is not None:
        clauses.append(f"price <= {max_price}")
    sql = (
        "SELECT id, name, description, price::text AS price, category_id "
        f"FROM products WHERE {' AND '.join(clauses)} "
        f"ORDER BY id ASC LIMIT {limit}"
    )
    async with pool.acquire() as conn:
        return await conn.fetch(sql)


# ✅ Beta — parameterized.
async def _list_beta(
    pool: Any,
    search: str | None,
    category: str | None,
    min_price: str | None,
    max_price: str | None,
    limit: int,
) -> list[Any]:
    clauses = ["1=1"]
    params: list[Any] = []
    if search is not None:
        params.append(f"%{search}%")
        clauses.append(f"name LIKE ${len(params)}")
    if category is not None:
        params.append(int(category))
        clauses.append(f"category_id = ${len(params)}")
    if min_price is not None:
        params.append(float(min_price))
        clauses.append(f"price >= ${len(params)}")
    if max_price is not None:
        params.append(float(max_price))
        clauses.append(f"price <= ${len(params)}")
    params.append(limit)
    sql = (
        "SELECT id, name, description, price::text AS price, category_id "
        f"FROM products WHERE {' AND '.join(clauses)} "
        f"ORDER BY id ASC LIMIT ${len(params)}"
    )
    async with pool.acquire() as conn:
        return await conn.fetch(sql, *params)


def _row_to_product(row: Any) -> Product:
    return Product(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        price=float(row["price"]),
        category_id=row["category_id"],
    )
