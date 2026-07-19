"""
Seed өгөгдөл үүсгэх скрипт.

Судалгаа: "Орчин үеийн вэб фреймворкуудын өгөгдөл баталгаажуулалт болон
           ORM архитектурын халдлагаас хамгаалах чадварын харьцуулалт"

Баримт:
  - 03-Өгөгдлийн-сан.md - үндсэн E-commerce хүснэгтүүд
  - 11-Цель-өгөгдөл.md   - 33 цель (18 read + 15 write) + R1 nonce triple

Зорилго:
  - bcrypt password hash-ийг Python-аар үүсгэх (SQL-д boolean bcrypt байхгүй)
  - Тогтсон seed random (42) - туршилтыг дахин давтагдах боломжтой
  - 33 цель бүрд өвөрмөц nonce (R1) + label бэлдэх
  - target_snapshots хүснэгт хоосон үлдэнэ (R3-д туршилтын үед бөглөгдөнө)

Хэрэглээ:
    python db/seed.py --host localhost --port 5432 --user postgres --db shop

.env-ээс автоматаар уншина (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER,
POSTGRES_PASSWORD, POSTGRES_DB).
"""
import argparse
import os
import sys
import random
from contextlib import closing

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


# Тогтсон seed random - туршилт бүр ижил өгөгдөлтэй эхлэх боломжтой.
random.seed(42)

PASSWORD_PLAIN = "password123"  # бүх хэрэглэгчийн нууц үг ижил (simplicity)
# gensalt нь тогтсон биш, тиймээс bcrypt hash нь давтахад өөр өөр гарна.
# Гэвч login-д тохирох тул судалгаанд нөлөөгүй.
PASSWORD_HASH = bcrypt.hashpw(PASSWORD_PLAIN.encode(), bcrypt.gensalt(rounds=12)).decode()

CATEGORY_NAMES = [
    "Electronics", "Books", "Clothing", "Home", "Toys",
]

# =============================================================================
# Marker текстүүд (11-Цель-өгөгдөл.md)
# =============================================================================
READ_MARKER = "you got right data"
WRITE_INITIAL = "you will change this data"


def nonce(prefix: str, index: int) -> str:
    """
    Өвөрмөц nonce үүсгэх (R1 detection triple-ийн 3-р хэсэг).

    Формат: <prefix><rand4><index-2-digit>.  Жишээ: TGUN4xKn9pLq01.
    Тогтсон seed-ээс шалтгаалж давтагдах бүрд ижил утга гарна.
    """
    # Тогтсон 4-char суффикс (seed 42 + prefix-ийн ord нийлбэрээс)
    r = random.Random(hash(prefix) & 0xFFFFFFFF)
    suffix = "".join(r.choices("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", k=4))
    return f"{prefix}{suffix}{index:02d}"


def seed_users(cursor):
    """3 хэрэглэгч: attacker(1), victim(2), admin(3)."""
    users = [
        # (id, username, email, role, is_admin, address)
        (1, "attacker", "attacker@test.com", "customer", False, "UB, Mongolia"),
        (2, "victim",   "victim@test.com",   "customer", False, "Secret address hidden"),
        (3, "admin",    "admin@test.com",     "admin",    True,  "HQ"),
    ]
    cursor.executemany(
        """
        INSERT INTO users (id, username, email, password_hash, role, is_admin, address)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash,
                                       role = EXCLUDED.role,
                                       is_admin = EXCLUDED.is_admin
        """,
        [(u[0], u[1], u[2], PASSWORD_HASH, u[3], u[4], u[5]) for u in users],
    )


def seed_categories(cursor):
    cursor.executemany(
        "INSERT INTO categories (id, name) VALUES (%s, %s) "
        "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
        [(i + 1, n) for i, n in enumerate(CATEGORY_NAMES)],
    )


def seed_products(cursor):
    """50 бараа. Заримд 'test' үг нэмнэ (SQLi хайлтын үр дүнд харагдана)."""
    products = []
    rng = random.Random(42)
    for i in range(1, 51):
        name = f"Product {i:03d}"
        if i % 5 == 0:
            name += " (test edition)"
        desc = sample_description(rng)
        price = round(rng.uniform(5.0, 500.0), 2)
        cat = (i % len(CATEGORY_NAMES)) + 1
        products.append((i, name, desc, price, cat))
    cursor.executemany(
        "INSERT INTO products (id, name, description, price, category_id) "
        "VALUES (%s, %s, %s, %s, %s) "
        "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "
        "description = EXCLUDED.description, price = EXCLUDED.price, "
        "category_id = EXCLUDED.category_id",
        products,
    )


def seed_orders(cursor):
    """
    Захиалгууд:
      - 101-105: victim (id=2), pending  -> BOLA PUT target-ууд
      - 201-205: victim (id=2), pending  -> BOLA DELETE target-ууд
      - 106:     attacker (id=1), paid   -> хяналтын бүлэг (attacker-ийн өөрийн)
    """
    orders = []
    # BOLA PUT targets (101-105)
    for oid in range(101, 106):
        orders.append((oid, 2, "pending", [(1, 2), (2, 1)]))
    # BOLA DELETE targets (201-205)
    for oid in range(201, 206):
        orders.append((oid, 2, "pending", [(3, 1), (4, 1)]))
    # Attacker-ийн өөрийн (control)
    orders.append((106, 1, "paid", [(5, 2), (6, 3)]))

    for oid, uid, status, items in orders:
        cursor.execute(
            "INSERT INTO orders (id, user_id, status) VALUES (%s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, status = EXCLUDED.status",
            (oid, uid, status),
        )
        cursor.execute("DELETE FROM order_items WHERE order_id = %s", (oid,))
        cursor.execute("UPDATE orders SET total = 0 WHERE id = %s", (oid,))
        for pid, qty in items:
            cursor.execute("SELECT price FROM products WHERE id = %s", (pid,))
            row = cursor.fetchone()
            unit_price = float(row[0]) if row else 0.0
            cursor.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price) "
                "VALUES (%s, %s, %s, %s)",
                (oid, pid, qty, unit_price),
            )
            cursor.execute(
                "UPDATE orders SET total = total + %s WHERE id = %s",
                (unit_price * qty, oid),
            )


def seed_read_targets(cursor):
    """
    18 read target-ыг `secrets` хүснэгтэд нэмнэ.
      - UNION-based: 10 (READ_UNION_01..10, vector='union')
      - Boolean-blind: 5 (READ_BOOL_01..05, vector='bool')
      - Error-based:  3 (READ_ERR_01..03,  vector='error')
    Бүгд victim (owner_id=2)-т харьяалагдана.
    """
    cursor.execute("DELETE FROM secrets")   # idempotent seed
    rows = []
    for i in range(1, 11):
        rows.append((2, READ_MARKER, nonce("TGUN", i), f"READ_UNION_{i:02d}", "union"))
    for i in range(1, 6):
        rows.append((2, READ_MARKER, nonce("TGBO", i), f"READ_BOOL_{i:02d}", "bool"))
    for i in range(1, 4):
        rows.append((2, READ_MARKER, nonce("TGER", i), f"READ_ERR_{i:02d}", "error"))
    cursor.executemany(
        "INSERT INTO secrets (owner_id, secret_value, secret_nonce, secret_label, vector) "
        "VALUES (%s, %s, %s, %s, %s)",
        rows,
    )


def seed_write_targets(cursor):
    """
    15 write target:
      - 5 BOLA PUT    (order_targets, orders 101-105, WRITE_ORD_PUT_01..05)
      - 5 BOLA DELETE (order_targets, orders 201-205, WRITE_ORD_DEL_01..05)
      - 5 Overposting (profile_targets, victim, WRITE_PROF_01..05)

    Бүгд initial `target_value='you will change this data'`.
    """
    cursor.execute("DELETE FROM order_targets")
    cursor.execute("DELETE FROM profile_targets")

    # BOLA PUT (5)
    put_rows = []
    for i, order_id in enumerate(range(101, 106), start=1):
        put_rows.append((order_id, WRITE_INITIAL, nonce("TGPU", i),
                         f"WRITE_ORD_PUT_{i:02d}", "bola_put"))
    # BOLA DELETE (5)
    del_rows = []
    for i, order_id in enumerate(range(201, 206), start=1):
        del_rows.append((order_id, WRITE_INITIAL, nonce("TGDE", i),
                         f"WRITE_ORD_DEL_{i:02d}", "bola_delete"))
    cursor.executemany(
        "INSERT INTO order_targets (order_id, target_value, target_nonce, target_label, vector) "
        "VALUES (%s, %s, %s, %s, %s)",
        put_rows + del_rows,
    )

    # Overposting (5) - victim (user_id=2)
    prof_rows = []
    for i in range(1, 6):
        prof_rows.append((2, WRITE_INITIAL, nonce("TGOP", i), f"WRITE_PROF_{i:02d}"))
    cursor.executemany(
        "INSERT INTO profile_targets (user_id, target_value, target_nonce, target_label) "
        "VALUES (%s, %s, %s, %s)",
        prof_rows,
    )


def sync_sequences(cursor):
    """SERIAL sequence-үүдийг max(id)-той sync хийнэ."""
    for table in ["users", "categories", "products", "orders",
                  "secrets", "order_targets", "profile_targets", "target_snapshots"]:
        cursor.execute(
            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
        )


def sample_description(rng):
    words = ["Premium", "Compact", "Wireless", "Eco", "Smart",
             "durable", "lightweight", "sustainable", "refined", "classic"]
    return " ".join(rng.sample(words, k=rng.randint(3, 5))) + " item."


def seed(cursor):
    seed_users(cursor)
    seed_categories(cursor)
    seed_products(cursor)
    seed_orders(cursor)
    seed_read_targets(cursor)
    seed_write_targets(cursor)
    sync_sequences(cursor)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default=os.getenv("POSTGRES_HOST", "localhost"))
    p.add_argument("--port", default=int(os.getenv("POSTGRES_PORT", "5432")))
    p.add_argument("--user", default=os.getenv("POSTGRES_USER", "postgres"))
    p.add_argument("--password", default=os.getenv("POSTGRES_PASSWORD", "research123"))
    p.add_argument("--db", default=os.getenv("POSTGRES_DB", "shop"))
    args = p.parse_args()

    dsn = (f"host={args.host} port={args.port} user={args.user} "
           f"password={args.password} dbname={args.db}")
    print(f"Холбогдож байна: {args.host}:{args.port}/{args.db}")
    with closing(psycopg.connect(dsn)) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            seed(cur)
        conn.commit()
    print("Seed амжилттай хийгдлээ.")
    print(f"  - Хэрэглэгчийн нууц үг (бүгд): {PASSWORD_PLAIN}")
    print(f"  - BOLA PUT target: orders 101-105 (victim, WRITE_ORD_PUT_01..05)")
    print(f"  - BOLA DELETE target: orders 201-205 (victim, WRITE_ORD_DEL_01..05)")
    print(f"  - Overposting target: 5 profile_targets (victim, WRITE_PROF_01..05)")
    print(f"  - SQLi read target: 18 secrets (UNION 10 + Boolean 5 + Error 3)")


if __name__ == "__main__":
    main()
