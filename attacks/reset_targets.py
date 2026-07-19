"""R3 idempotency — write target-уудыг initial marker руу буцаах.

Halдлагыг N=30 удаа давтахын өмнө write target бүр `you will change this data` төлөвт байх ёстой.
BOLA DELETE-т `target_snapshots`-ыг цэвэрлэж, устгагдсан order-ыг seed-ийн байдалаар сэргээнэ.

ПостgreSQL-руу шууд psycopg-аар холбогдоно (attacks-ын бусад скриптүүд backend-ийн API-аар л ажилладаг, харин reset нь дотоод админ ажил тул шууд DB).
"""

from __future__ import annotations

import argparse
import os
import sys

try:
    import psycopg
except ImportError:  # pragma: no cover
    print("psycopg суулгана уу: pip install 'psycopg[binary]'", file=sys.stderr)
    sys.exit(1)

INITIAL = "you will change this data"


def reset(dsn: str) -> None:
    with psycopg.connect(dsn, autocommit=False) as conn:
        with conn.cursor() as cur:
            # profile_targets, order_targets — target_value-ыг initial болгоно.
            cur.execute("UPDATE profile_targets SET target_value = %s", (INITIAL,))
            cur.execute("UPDATE order_targets SET target_value = %s", (INITIAL,))

            # BOLA DELETE-т устгагдсан order-ийг сэргээх.
            cur.execute(
                """SELECT DISTINCT ot.order_id
                   FROM order_targets ot
                   WHERE ot.vector = 'bola_delete'
                     AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = ot.order_id)"""
            )
            missing_orders = [row[0] for row in cur.fetchall()]
            for order_id in missing_orders:
                # seed.py-ийн 201-205 логик — victim (user_id=2), status='pending'
                cur.execute(
                    """INSERT INTO orders (id, user_id, status, total)
                       VALUES (%s, 2, 'pending', 0)
                       ON CONFLICT (id) DO NOTHING""",
                    (order_id,),
                )
            # target_snapshots-ыг зайлуулна — тэдгээр нь per-round хадгалагдана,
            # гэхдээ бид эхнээс нь эхлүүлье.
            cur.execute("DELETE FROM target_snapshots")
        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.getenv("POSTGRES_HOST", "localhost"))
    parser.add_argument("--port", default=int(os.getenv("POSTGRES_PORT", "5432")))
    parser.add_argument("--user", default=os.getenv("POSTGRES_USER", "postgres"))
    parser.add_argument("--password", default=os.getenv("POSTGRES_PASSWORD", "research123"))
    parser.add_argument("--db", default=os.getenv("POSTGRES_DB", "shop"))
    args = parser.parse_args()
    dsn = f"host={args.host} port={args.port} user={args.user} password={args.password} dbname={args.db}"
    reset(dsn)
    print("Target-ууд initial марkerд буцлаа.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
