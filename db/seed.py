"""
Seed өгөгдөл үүсгэх скрипт (dummyjson-ы realistic corpus-той нэгтгэсэн).

Судалгаа: "Орчин үеийн вэб фреймворкуудын өгөгдөл баталгаажуулалт болон
           ORM архитектурын халдлагаас хамгаалах чадварын харьцуулалт"

Баримт:
  - 03-Өгөгдлийн-сан.md - үндсэн E-commerce хүснэгтүүд
  - 11-Цель-өгөгдөл.md   - 33 цель (18 read + 15 write) + R1 nonce triple

Seed logic:
  1. `db/dummyjson_snapshot/*.json` файлаас 208 user, 194 product, 24 category,
     208 cart, 582 review-ыг унших (`fetch_dummyjson.py`-с урьдчилан татсан)
  2. 208 хэрэглэгч бүрд деterministic strong PW (SEED=42) үүсгэж bcrypt hash хийх;
     cleartext-уудыг `db/dummyjson_snapshot/credentials.json`-т хадгална
     (git-т commit хийгдэхгүй — attack script `.env`-с 3 anchor уншина)
  3. Editorial засвар: id=1 (attacker), id=2 (victim)-ыг `role='user'` болгох;
     id=3 (admin) хэвээр
  4. dummyjson cart 1-208-ыг orders 1001-1208-т seed хийх (detection anchor-с зөрөх)
  5. Detection anchor orders (101-106, 201-205) victim (id=2)-т seed хийх
  6. 33 цель (secrets, order_targets, profile_targets) хэвээр — victim (id=2)

Хэрэглээ:
    # эхлээд snapshot татна (нэг л удаа, dummyjson өөрчлөгдсөн үед дахин)
    python db/fetch_dummyjson.py
    # дараа нь seed
    python db/seed.py

.env-ээс автоматаар уншина (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER,
POSTGRES_PASSWORD, POSTGRES_DB).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import string
import sys
from contextlib import closing
from datetime import datetime
from pathlib import Path

try:
    import psycopg
except ImportError:
    print("psycopg суулгана уу: pip install 'psycopg[binary]'", file=sys.stderr)
    sys.exit(1)

try:
    import bcrypt
except ImportError:
    print("bcrypt суулгана уу: pip install bcrypt", file=sys.stderr)
    sys.exit(1)


# Тогтсон seed random — деterministic PW generation болон nonce
RNG = random.Random(42)

# =============================================================================
# Тогтмолууд
# =============================================================================
SNAPSHOT_DIR = Path(__file__).parent / "dummyjson_snapshot"
CREDENTIALS_FILE = SNAPSHOT_DIR / "credentials.json"

# Marker текстүүд (11-Цель-өгөгдөл.md)
READ_MARKER = "you got right data"
WRITE_INITIAL = "you will change this data"

# Anchor хэрэглэгчид (dummyjson id-тай нийцүүлсэн)
# id=1 emilys → attacker (editorial: role='user')
# id=2 michaelw → victim (editorial: role='user')
# id=3 sophiab → admin (dummyjson-т өөрөө admin, editorial засвар байхгүй)
ANCHOR_ATTACKER_ID = 1
ANCHOR_VICTIM_ID = 2
ANCHOR_ADMIN_ID = 3

# Detection anchor захиалгын id
BOLA_PUT_ORDERS = list(range(101, 106))  # WRITE_ORD_PUT_01..05
BOLA_DELETE_ORDERS = list(range(201, 206))  # WRITE_ORD_DEL_01..05
ATTACKER_CONTROL_ORDER = 106  # attacker өөрийн (control)

# dummyjson cart-ыг orders-т seed хийх offset (detection anchor-с зөрөх)
CART_ORDERS_OFFSET = 1000  # dummyjson cart id 1..208 → orders id 1001..1208

# Хүчтэй санамсаргүй PW-ын символьт багц
PW_ALPHABET = string.ascii_letters + string.digits + "!@#$%^&*_-+="
PW_LENGTH = 24


# =============================================================================
# Утилити
# =============================================================================


def strong_password(rng: random.Random) -> str:
    """24-char хүчтэй санамсаргүй PW, upper+lower+digit+symbol багтсан."""
    while True:
        pw = "".join(rng.choice(PW_ALPHABET) for _ in range(PW_LENGTH))
        if (
            any(c.islower() for c in pw)
            and any(c.isupper() for c in pw)
            and any(c.isdigit() for c in pw)
            and any(c in "!@#$%^&*_-+=" for c in pw)
        ):
            return pw


def nonce(prefix: str, index: int) -> str:
    """Өвөрмөц nonce (R1 detection triple-ийн 3-р хэсэг).

    Формат: <prefix><rand4><index-2-digit>. Жишээ: TGUN4xKn9pLq01.
    Тогтсон seed-ээс шалтгаалж давтагдах бүрд ижил утга гарна.
    """
    r = random.Random(hash(prefix) & 0xFFFFFFFF)
    suffix = "".join(
        r.choices("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", k=4)
    )
    return f"{prefix}{suffix}{index:02d}"


def parse_dt(s: str | None) -> datetime | None:
    """dummyjson-ы ISO string-ыг datetime болгоно."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def parse_date(s: str | None) -> str | None:
    """dummyjson-ы birthDate (YYYY-M-D эсвэл YYYY-MM-DD) → YYYY-MM-DD."""
    if not s:
        return None
    try:
        parts = s.split("-")
        if len(parts) == 3:
            y, m, d = parts
            return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except (ValueError, AttributeError):
        pass
    return None


def load_snapshot() -> dict[str, list]:
    """dummyjson snapshot файлыг унших. `fetch_dummyjson.py` эхлээд ажилласан байх ёстой."""
    if not SNAPSHOT_DIR.exists():
        raise RuntimeError(
            f"{SNAPSHOT_DIR} алга. Эхлээд `python db/fetch_dummyjson.py` ажиллуулна уу."
        )
    return {
        "products": json.loads(
            (SNAPSHOT_DIR / "products.json").read_text(encoding="utf-8")
        ),
        "users": json.loads((SNAPSHOT_DIR / "users.json").read_text(encoding="utf-8")),
        "carts": json.loads((SNAPSHOT_DIR / "carts.json").read_text(encoding="utf-8")),
        "categories": json.loads(
            (SNAPSHOT_DIR / "categories.json").read_text(encoding="utf-8")
        ),
    }


# =============================================================================
# Seeders
# =============================================================================


def seed_categories(cursor, categories: list[dict]) -> dict[str, int]:
    """24 category-ыг INSERT хийж, slug→id mapping буцаана."""
    cursor.execute("DELETE FROM categories")
    rows = []
    slug_to_id = {}
    for i, c in enumerate(categories, start=1):
        rows.append((i, c["slug"], c["name"], c.get("url")))
        slug_to_id[c["slug"]] = i
    cursor.executemany(
        "INSERT INTO categories (id, slug, name, url) VALUES (%s, %s, %s, %s)",
        rows,
    )
    return slug_to_id


def seed_users(cursor, users: list[dict]) -> dict[int, str]:
    """208 хэрэглэгчийг seed хийж, {id: cleartext_password} буцаана.

    Editorial засвар:
      - id=1 emilys → role='user' (attacker)
      - id=2 michaelw → role='user' (victim)
      - id=3 sophiab → role='admin' хэвээр
    """
    cursor.execute("DELETE FROM users")
    credentials: dict[int, str] = {}
    rows = []

    for u in users:
        uid = u["id"]

        # Editorial: attacker/victim role='user'
        role = u["role"]
        if uid in (ANCHOR_ATTACKER_ID, ANCHOR_VICTIM_ID):
            role = "user"
        is_admin = role == "admin"

        # Deterministic strong PW
        pw = strong_password(RNG)
        credentials[uid] = pw
        pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=10)).decode()

        addr = u.get("address") or {}
        coords = addr.get("coordinates") or {}
        hair = u.get("hair") or {}
        bank = u.get("bank") or {}
        company = u.get("company") or {}
        company_addr = company.get("address") or {}
        crypto = u.get("crypto") or {}

        rows.append(
            (
                uid,
                u["username"],
                u["email"],
                pw_hash,
                role,
                is_admin,
                addr.get("address"),  # address column
                u.get("firstName"),
                u.get("lastName"),
                u.get("maidenName"),
                u.get("age"),
                u.get("gender"),
                u.get("phone"),
                parse_date(u.get("birthDate")),
                u.get("image"),
                u.get("bloodGroup"),
                u.get("height"),
                u.get("weight"),
                u.get("eyeColor"),
                hair.get("color"),
                hair.get("type"),
                u.get("ip"),
                u.get("macAddress"),
                u.get("userAgent"),
                u.get("university"),
                addr.get("city"),
                addr.get("state"),
                addr.get("stateCode"),
                addr.get("postalCode"),
                addr.get("country"),
                coords.get("lat"),
                coords.get("lng"),
                bank.get("cardExpire"),
                bank.get("cardNumber"),
                bank.get("cardType"),
                bank.get("currency"),
                bank.get("iban"),
                company.get("department"),
                company.get("name"),
                company.get("title"),
                company_addr.get("city"),
                company_addr.get("state"),
                company_addr.get("stateCode"),
                company_addr.get("country"),
                u.get("ein"),
                u.get("ssn"),
                crypto.get("coin"),
                crypto.get("wallet"),
                crypto.get("network"),
            )
        )

    cursor.executemany(
        """
        INSERT INTO users (
            id, username, email, password_hash, role, is_admin, address,
            first_name, last_name, maiden_name, age, gender, phone, birth_date, image_url,
            blood_group, height_cm, weight_kg, eye_color, hair_color, hair_type,
            ip, mac_address, user_agent, university,
            city, state, state_code, postal_code, country, lat, lng,
            bank_card_expire, bank_card_number, bank_card_type, bank_currency, bank_iban,
            company_department, company_name, company_title,
            company_city, company_state, company_state_code, company_country,
            ein, ssn, crypto_coin, crypto_wallet, crypto_network
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        )
        """,
        rows,
    )
    return credentials


def seed_products(cursor, products: list[dict], slug_to_cat_id: dict[str, int]) -> None:
    """194 product + 582 review (product тус бүрд 3)."""
    cursor.execute("DELETE FROM product_reviews")
    cursor.execute("DELETE FROM products")

    product_rows = []
    review_rows = []

    for p in products:
        pid = p["id"]
        cat_id = slug_to_cat_id.get(p.get("category"))
        dims = p.get("dimensions") or {}
        meta = p.get("meta") or {}

        product_rows.append(
            (
                pid,
                p["title"],
                p.get("description"),
                p["price"],
                cat_id,
                p.get("discountPercentage"),
                p.get("rating"),
                p.get("stock"),
                p.get("brand"),
                p.get("sku"),
                p.get("weight"),
                dims.get("width"),
                dims.get("height"),
                dims.get("depth"),
                p.get("warrantyInformation"),
                p.get("shippingInformation"),
                p.get("availabilityStatus"),
                p.get("returnPolicy"),
                p.get("minimumOrderQuantity"),
                meta.get("barcode"),
                meta.get("qrCode"),
                p.get("thumbnail"),
                p.get("tags") or [],
                p.get("images") or [],
                parse_dt(meta.get("createdAt")),
                parse_dt(meta.get("updatedAt")),
            )
        )

        for r in p.get("reviews") or []:
            review_rows.append(
                (
                    pid,
                    r.get("rating"),
                    r.get("comment"),
                    r.get("reviewerName"),
                    r.get("reviewerEmail"),
                    parse_dt(r.get("date")),
                )
            )

    cursor.executemany(
        """
        INSERT INTO products (
            id, name, description, price, category_id,
            discount_percentage, rating, stock, brand, sku, weight_grams,
            dim_width, dim_height, dim_depth,
            warranty_information, shipping_information, availability_status,
            return_policy, min_order_quantity, barcode, qr_code, thumbnail,
            tags, images, meta_created_at, meta_updated_at
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s
        )
        """,
        product_rows,
    )
    cursor.executemany(
        """
        INSERT INTO product_reviews (
            product_id, rating, comment, reviewer_name, reviewer_email, review_date
        ) VALUES (%s, %s, %s, %s, %s, %s)
        """,
        review_rows,
    )


def seed_cart_orders(cursor, carts: list[dict]) -> None:
    """dummyjson cart 1..208-ыг orders 1001..1208-т seed хийнэ.

    Detection anchor orders (101-106, 201-205) — тусад нь `seed_anchor_orders`-т seed.
    """
    for cart in carts:
        cart_id = cart["id"]
        order_id = cart_id + CART_ORDERS_OFFSET  # 1001..1208
        user_id = cart["userId"]

        cursor.execute(
            """
            INSERT INTO orders (
                id, user_id, status, total, discounted_total,
                total_products, total_quantity
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                order_id,
                user_id,
                "pending",
                cart.get("total", 0),
                cart.get("discountedTotal"),
                cart.get("totalProducts"),
                cart.get("totalQuantity"),
            ),
        )

        for prod in cart.get("products") or []:
            cursor.execute(
                """
                INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, line_total,
                    discount_percentage, discounted_line_total, thumbnail
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    order_id,
                    prod["id"],
                    prod["quantity"],
                    prod["price"],
                    prod.get("total"),
                    prod.get("discountPercentage"),
                    prod.get("discountedTotal"),
                    prod.get("thumbnail"),
                ),
            )


def seed_anchor_orders(cursor) -> None:
    """Detection anchor захиалгууд:
      - 101-105: victim (id=2), pending → BOLA PUT target
      - 201-205: victim (id=2), pending → BOLA DELETE target
      - 106:     attacker (id=1), paid → attacker control (BOLA target биш)

    Тус бүр 1-2 order_item — realistic products 1-6-с сонгоно.
    """
    anchor_orders = []
    for oid in BOLA_PUT_ORDERS:
        anchor_orders.append((oid, ANCHOR_VICTIM_ID, "pending", [(1, 2), (2, 1)]))
    for oid in BOLA_DELETE_ORDERS:
        anchor_orders.append((oid, ANCHOR_VICTIM_ID, "pending", [(3, 1), (4, 1)]))
    anchor_orders.append(
        (ATTACKER_CONTROL_ORDER, ANCHOR_ATTACKER_ID, "paid", [(5, 2), (6, 3)])
    )

    for oid, uid, status, items in anchor_orders:
        cursor.execute(
            "INSERT INTO orders (id, user_id, status) VALUES (%s, %s, %s)",
            (oid, uid, status),
        )
        total = 0.0
        for pid, qty in items:
            cursor.execute("SELECT price FROM products WHERE id = %s", (pid,))
            row = cursor.fetchone()
            unit_price = float(row[0]) if row else 0.0
            line_total = unit_price * qty
            total += line_total
            cursor.execute(
                """
                INSERT INTO order_items (
                    order_id, product_id, quantity, unit_price, line_total
                ) VALUES (%s, %s, %s, %s, %s)
                """,
                (oid, pid, qty, unit_price, line_total),
            )
        cursor.execute("UPDATE orders SET total = %s WHERE id = %s", (total, oid))


def seed_read_targets(cursor) -> None:
    """18 read target → `secrets` хүснэгт. Бүгд victim (owner_id=2)."""
    cursor.execute("DELETE FROM secrets")
    rows = []
    for i in range(1, 11):
        rows.append(
            (
                ANCHOR_VICTIM_ID,
                READ_MARKER,
                nonce("TGUN", i),
                f"READ_UNION_{i:02d}",
                "union",
            )
        )
    for i in range(1, 6):
        rows.append(
            (
                ANCHOR_VICTIM_ID,
                READ_MARKER,
                nonce("TGBO", i),
                f"READ_BOOL_{i:02d}",
                "bool",
            )
        )
    for i in range(1, 4):
        rows.append(
            (
                ANCHOR_VICTIM_ID,
                READ_MARKER,
                nonce("TGER", i),
                f"READ_ERR_{i:02d}",
                "error",
            )
        )
    cursor.executemany(
        "INSERT INTO secrets (owner_id, secret_value, secret_nonce, secret_label, vector) "
        "VALUES (%s, %s, %s, %s, %s)",
        rows,
    )


def seed_write_targets(cursor) -> None:
    """15 write target:
    - 5 BOLA PUT    (order_targets, orders 101-105)
    - 5 BOLA DELETE (order_targets, orders 201-205)
    - 5 Overposting (profile_targets, victim id=2)
    """
    cursor.execute("DELETE FROM order_targets")
    cursor.execute("DELETE FROM profile_targets")

    put_rows = [
        (
            order_id,
            WRITE_INITIAL,
            nonce("TGPU", i),
            f"WRITE_ORD_PUT_{i:02d}",
            "bola_put",
        )
        for i, order_id in enumerate(BOLA_PUT_ORDERS, start=1)
    ]
    del_rows = [
        (
            order_id,
            WRITE_INITIAL,
            nonce("TGDE", i),
            f"WRITE_ORD_DEL_{i:02d}",
            "bola_delete",
        )
        for i, order_id in enumerate(BOLA_DELETE_ORDERS, start=1)
    ]
    cursor.executemany(
        "INSERT INTO order_targets (order_id, target_value, target_nonce, target_label, vector) "
        "VALUES (%s, %s, %s, %s, %s)",
        put_rows + del_rows,
    )

    prof_rows = [
        (ANCHOR_VICTIM_ID, WRITE_INITIAL, nonce("TGOP", i), f"WRITE_PROF_{i:02d}")
        for i in range(1, 6)
    ]
    cursor.executemany(
        "INSERT INTO profile_targets (user_id, target_value, target_nonce, target_label) "
        "VALUES (%s, %s, %s, %s)",
        prof_rows,
    )


def sync_sequences(cursor) -> None:
    """SERIAL sequence-үүдийг max(id)-той sync хийнэ."""
    tables = [
        "users",
        "categories",
        "products",
        "product_reviews",
        "orders",
        "order_items",
        "secrets",
        "order_targets",
        "profile_targets",
        "target_snapshots",
    ]
    for table in tables:
        cursor.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
        )


# =============================================================================
# Main
# =============================================================================


def seed(cursor, snapshot: dict[str, list]) -> dict[int, str]:
    slug_to_cat_id = seed_categories(cursor, snapshot["categories"])
    credentials = seed_users(cursor, snapshot["users"])
    seed_products(cursor, snapshot["products"], slug_to_cat_id)
    seed_cart_orders(cursor, snapshot["carts"])
    seed_anchor_orders(cursor)
    seed_read_targets(cursor)
    seed_write_targets(cursor)
    sync_sequences(cursor)
    return credentials


def save_credentials(credentials: dict[int, str], users: list[dict]) -> None:
    """Cleartext PW-уудыг файлд хадгална (git-т commit хийгдэхгүй)."""
    payload = {
        "note": (
            "Deterministic strong passwords (SEED=42). Use these to log in as any user "
            "in the security-research testbed. NOT for real accounts."
        ),
        "users": [
            {
                "id": u["id"],
                "username": u["username"],
                "password": credentials[u["id"]],
                "role": (
                    "user"
                    if u["id"] in (ANCHOR_ATTACKER_ID, ANCHOR_VICTIM_ID)
                    else u["role"]
                ),
            }
            for u in users
        ],
    }
    CREDENTIALS_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--host", default=os.getenv("POSTGRES_HOST", "localhost"))
    p.add_argument("--port", default=int(os.getenv("POSTGRES_PORT", "5432")))
    p.add_argument("--user", default=os.getenv("POSTGRES_USER", "postgres"))
    p.add_argument("--password", default=os.getenv("POSTGRES_PASSWORD", "research123"))
    p.add_argument("--db", default=os.getenv("POSTGRES_DB", "shop"))
    args = p.parse_args()

    # Windows console-ыг UTF-8-ээр хэвлэх боломжтой болгоно
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    snapshot = load_snapshot()
    print(
        f"Snapshot: {len(snapshot['users'])} user, {len(snapshot['products'])} product, "
        f"{len(snapshot['carts'])} cart, {len(snapshot['categories'])} category"
    )

    dsn = (
        f"host={args.host} port={args.port} user={args.user} "
        f"password={args.password} dbname={args.db}"
    )
    print(f"Холбогдож байна: {args.host}:{args.port}/{args.db}")

    with closing(psycopg.connect(dsn)) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            credentials = seed(cur, snapshot)
        conn.commit()

    save_credentials(credentials, snapshot["users"])

    attacker_pw = credentials[ANCHOR_ATTACKER_ID]
    victim_pw = credentials[ANCHOR_VICTIM_ID]
    admin_pw = credentials[ANCHOR_ADMIN_ID]

    print("Seed амжилттай хийгдлээ.")
    print(f"  - 208 хэрэглэгч, бүгдэд деterministic strong PW (SEED=42, bcrypt hash)")
    print(f"  - Cleartext PW-ууд: {CREDENTIALS_FILE.relative_to(Path.cwd())}")
    print(f"  - 24 category, 194 product, 582 review")
    print(f"  - 208 realistic cart order (id 1001-1208) + 11 detection anchor order")
    print(f"  - 18 read + 15 write detection target")
    print()
    print("Anchor хэрэглэгчид (attack script-т ашиглана):")
    print(f"  attacker (id=1, emilys)   → PW={attacker_pw}")
    print(f"  victim   (id=2, michaelw) → PW={victim_pw}")
    print(f"  admin    (id=3, sophiab)  → PW={admin_pw}")
    print()
    print("Attack script (`attacks/common.py`) эдгээр PW-г .env-с уншина:")
    print(f"  SEED_ATTACKER_PASSWORD={attacker_pw}")
    print(f"  SEED_VICTIM_PASSWORD={victim_pw}")
    print(f"  SEED_ADMIN_PASSWORD={admin_pw}")


if __name__ == "__main__":
    main()
