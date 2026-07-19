"""dummyjson.com-с realistic corpus-ыг татаж локал snapshot болгож хадгална.

Зорилго:
  - 194 бараа, 208 хэрэглэгч, ~50 cart, 24 category-ыг offline snapshot-т хадгална
  - Reproducibility: N=30 давталтад internet шаардахгүй, dummyjson-ы API өөрчлөгдөх нь seed-т нөлөөлөхгүй
  - Git-т commit хийж, бүх variant branch дээр ижил snapshot ашиглана

Үр дүн: db/dummyjson_snapshot/{products,users,carts,categories}.json

Хэрэглээ:
    python db/fetch_dummyjson.py

dummyjson-ы data өөрчлөгдвөл дахин ажиллуулж git-т commit.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    print("httpx суулгана уу: pip install httpx", file=sys.stderr)
    sys.exit(1)


SNAPSHOT_DIR = Path(__file__).parent / "dummyjson_snapshot"
BASE_URL = "https://dummyjson.com"
TIMEOUT_S = 30.0


def fetch(client: httpx.Client, path: str) -> dict:
    """GET path, буцаах JSON. limit=0 бол dummyjson бүх бичлэгийг буцаана."""
    print(f"  GET {path}")
    r = client.get(path)
    r.raise_for_status()
    return r.json()


def main() -> None:
    SNAPSHOT_DIR.mkdir(exist_ok=True)
    print(f"Snapshot dir: {SNAPSHOT_DIR}")

    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT_S) as client:
        products = fetch(client, "/products?limit=0")
        users = fetch(client, "/users?limit=0")
        carts = fetch(client, "/carts?limit=0")
        categories = fetch(client, "/products/categories")

    # dummyjson products/carts/users response envelope-той — items-ыг задалж хадгална
    products_list = products["products"]
    users_list = users["users"]
    carts_list = carts["carts"]

    print(f"  products: {len(products_list)}")
    print(f"  users:    {len(users_list)}")
    print(f"  carts:    {len(carts_list)}")
    print(f"  categories: {len(categories)}")

    (SNAPSHOT_DIR / "products.json").write_text(
        json.dumps(products_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (SNAPSHOT_DIR / "users.json").write_text(
        json.dumps(users_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (SNAPSHOT_DIR / "carts.json").write_text(
        json.dumps(carts_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (SNAPSHOT_DIR / "categories.json").write_text(
        json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\nАмжилттай. Одоо `python db/seed.py`-ыг ажиллуулж болно.")


if __name__ == "__main__":
    main()
