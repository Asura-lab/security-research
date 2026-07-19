"""Contract-т нийцсэн Pydantic v2 models.

Alpha: `UpdateProfileRequest`-т `model_config = ConfigDict(extra='ignore')` — Pydantic v2
dефолт. `targets`, `role`, `is_admin` талбарууд schema-д тодорхойлогдсон тул mekдэгдсэн
талбар боловч validation-д accept болно. Хэрэв Pydantic-ийн default `extra='ignore'`-т
тулгуурлан `targets`-ыг schema-д огт нэмээгүй бол Overposting боломж энгийн `extra='ignore'`
аар алдагдана — тиймээс энд `targets`, `role`, `is_admin`-г тодорхой оруулсан.

Beta: `extra='forbid'` — мэдэгдээгүй талбар 400.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)


class RegisterResponse(BaseModel):
    user_id: int
    username: str
    role: Literal["customer"]


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    role: Literal["customer", "admin"]
    user_id: int


class Product(BaseModel):
    id: int
    name: str
    description: str | None = None
    price: float
    category_id: int | None = None


class ProductListResponse(BaseModel):
    items: list[Product]


class ProductResponse(BaseModel):
    product: Product


class OrderItem(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class Order(BaseModel):
    id: int
    user_id: int
    status: str
    total: float
    items: list[OrderItem]


class CreateOrderItem(BaseModel):
    product_id: int
    quantity: int = Field(ge=1)


class CreateOrderRequest(BaseModel):
    items: list[CreateOrderItem] = Field(min_length=1)


class UpdateOrderRequest(BaseModel):
    status: str


class OrderResponse(BaseModel):
    order: Order


class Profile(BaseModel):
    user_id: int
    username: str
    email: str
    role: Literal["customer", "admin"]
    is_admin: bool
    address: str | None = None


class OverpostTarget(BaseModel):
    label: str
    value: str


class UpdateProfileRequestAlpha(BaseModel):
    """Alpha impl: extra=ignore (Pydantic v2 default). Attacker-ийн мэдэгдээгүй талбарыг
    силент устгадаг ч, энд ил тод тодорхойлсон талбарууд accept болно."""

    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    address: str | None = None
    role: str | None = None
    is_admin: bool | None = None
    targets: list[OverpostTarget] | None = None


class UpdateProfileRequestBeta(BaseModel):
    """Beta impl: extra=forbid — мэдэгдээгүй талбар 400. `role`, `is_admin`, `targets`
    оруулаагүй тул тэдгээр талбар илгээгдвэл 422."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    address: str | None = None


class ProfileResponse(BaseModel):
    profile: Profile


class TargetStatus(BaseModel):
    label: str
    kind: Literal["read", "write"]
    value: str
    nonce: str
    deleted: bool = False


class TargetsStatusResponse(BaseModel):
    targets: list[TargetStatus]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    variant: str
    implementation: Literal["alpha", "beta"]
