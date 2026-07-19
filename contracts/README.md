# API Contract

6 backend хувилбарт нэгдмэл API схем.

## Файлууд

- `openapi.yaml` — OpenAPI 3.1 контракт, 9 endpoint + admin detection endpoint
- `schemas/*.json` — JSON Schema Draft 2020-12 (contract test-үүдэд шууд ашиглагдана)

## Дүрэм

1. 6 backend бүгд `openapi.yaml`-ийн route, статус код, JSON хэлбэрийг **яг таг** биелүүлнэ.
2. Хэрэв backend хазайвал халдлагын detection зөрчигдөх тул `tests/contract/` шат нь халдлага илгээхээс өмнө pass хийх ёстой (→ `10-Аюулгүй-байдлын-урьдчилсан-шалгалт`).
3. `UpdateProfileRequest`-т `role`, `is_admin`, `targets` талбарууд нь Overposting оролтын хэлбэр — schema-д зөвшөөрөгдсөн боловч **backend-ийн бизнес логик** тэдгээрийг accept/refuse хийхэд халдлагын үр дүн тодорхойлогдоно.
4. `UpdateOrderRequest.status` нь string free-form — Alpha impl-т enum шалгагдахгүй, халдлагын `"You are hacked"` утга backend-т орж `order_targets.target_value`-т marker хэлбэрээр хадгалагдана.

## Хувилбар-специфик реализейц

Вэктор бүрд өвөрмөц Alpha/Beta implementation:

| Endpoint | Alpha (vulnerable) | Beta (fixed) |
| --- | --- | --- |
| `GET /api/products?search=` | Raw хувилбарт string interpolation; ORM-т parameterized (SQLi 3 вектор) | ORM хэвээр parameterized; Raw хувилбарт prepared statement нэмэх |
| `GET/PUT/DELETE /api/orders/:id` | `WHERE id=$1` — ownership check байхгүй | `WHERE id=$1 AND user_id=$2` |
| `PUT /api/profile` | `whitelist:false` (NestJS) / `extra='ignore'` (Pydantic) / all-accept struct binding (Fiber) | `whitelist:true, forbidNonWhitelisted:true` / `extra='forbid'` / field allow-list |

→ `11-Цель-өгөгдөл.md#10.1 Alpha / Beta implementation matrix`
