"""BOLA — 15 write target (5 GET disclosure + 5 PUT + 5 DELETE).

Attacker (user_id=1) нь victim (user_id=2)-ийн захиалгад хандах:
  - GET  /api/orders/101..105 — disclosure. Amжилттай = response body-т marker + label + nonce.
  - PUT  /api/orders/101..105 body={"status": "You are hacked"} — order_targets[bola_put] marker.
  - DELETE /api/orders/201..205 — order_targets[bola_delete] marker (target_snapshots-т үлдэнэ).

Detection нь бүх халдлагын дараа `/api/admin/targets/status`-оос shine target буцаана.
"""

from __future__ import annotations

import sys
import time
from typing import Iterable

from common import (
    CREDS_ADMIN,
    CREDS_ATTACKER,
    RESULTS_DIR,
    ResultWriter,
    Statsd,
    VariantClient,
    load_variants,
    make_run_id,
    write_success_delete,
    write_success_put,
)

IMPLEMENTATIONS = ("alpha", "beta")

PUT_ORDERS = list(range(101, 106))       # WRITE_ORD_PUT_01..05
DELETE_ORDERS = list(range(201, 206))    # WRITE_ORD_DEL_01..05
GET_ORDERS = list(range(101, 106))       # ижил PUT target-уудыг disclosure-т ашиглана


def _labels_to_nonce(client: VariantClient, admin_token: str) -> dict[str, str]:
    targets = client.targets_status(admin_token)
    return {t["label"]: t["nonce"] for t in targets}


def _target_value(
    client: VariantClient, admin_token: str, label: str
) -> tuple[str | None, bool]:
    """Detection endpoint-оос тухайн label-ийн одоогийн target_value + deleted flag."""
    targets = client.targets_status(admin_token, label=label)
    matches = [t for t in targets if t["label"] == label]
    if not matches:
        return None, False
    # BOLA DELETE-т deleted=true snapshot нь preferred.
    for t in matches:
        if t.get("deleted"):
            return t["value"], True
    return matches[0]["value"], False


def _do_get(
    client: VariantClient, attacker: str, admin: str,
    variant: str, impl: str, run_id: str, writer: ResultWriter,
    orders: Iterable[int],
) -> None:
    label_nonces = _labels_to_nonce(client, admin)
    for order_id in orders:
        label = f"WRITE_ORD_PUT_{order_id - 100:02d}"
        nonce = label_nonces.get(label, "")
        start = time.perf_counter()
        r = client.request("GET", f"/api/orders/{order_id}", token=attacker)
        duration = (time.perf_counter() - start) * 1000
        # Disclosure success: attacker-т буцаагдсан order.user_id != attacker-ийн ID (1).
        disclosure = False
        if r.status_code == 200:
            try:
                order = r.json().get("order", {})
                disclosure = order.get("user_id") == 2
            except Exception:  # noqa: BLE001
                pass
        writer.append({
            "attack": "bola_get",
            "variant": variant,
            "implementation": impl,
            "run_id": run_id,
            "target_id": label,
            "target_type": "read",
            "vector": "bola_get",
            "nonce": nonce,
            "http_status": r.status_code,
            "duration_ms": round(duration, 3),
            "result": "success" if disclosure else "blocked",
        })


def _do_put(
    client: VariantClient, attacker: str, admin: str,
    variant: str, impl: str, run_id: str, writer: ResultWriter,
    orders: Iterable[int],
) -> None:
    for order_id in orders:
        label = f"WRITE_ORD_PUT_{order_id - 100:02d}"
        start = time.perf_counter()
        r = client.request(
            "PUT", f"/api/orders/{order_id}", token=attacker,
            json_body={"status": "You are hacked"},
        )
        duration = (time.perf_counter() - start) * 1000
        value, _ = _target_value(client, admin, label)
        nonces = _labels_to_nonce(client, admin)
        nonce = nonces.get(label, "")
        ok = value is not None and nonce != "" and write_success_put(value, nonce)
        writer.append({
            "attack": "bola_put",
            "variant": variant,
            "implementation": impl,
            "run_id": run_id,
            "target_id": label,
            "target_type": "write",
            "vector": "bola_put",
            "initial_value": "you will change this data",
            "final_value": value,
            "nonce": nonce,
            "http_status": r.status_code,
            "duration_ms": round(duration, 3),
            "result": "success" if ok else "blocked",
        })


def _do_delete(
    client: VariantClient, attacker: str, admin: str,
    variant: str, impl: str, run_id: str, writer: ResultWriter,
    orders: Iterable[int],
) -> None:
    for order_id in orders:
        label = f"WRITE_ORD_DEL_{order_id - 200:02d}"
        start = time.perf_counter()
        r = client.request("DELETE", f"/api/orders/{order_id}", token=attacker)
        duration = (time.perf_counter() - start) * 1000
        value, deleted = _target_value(client, admin, label)
        nonces = _labels_to_nonce(client, admin)
        nonce = nonces.get(label, "")
        ok = value is not None and nonce != "" and deleted and write_success_delete(value, nonce)
        writer.append({
            "attack": "bola_delete",
            "variant": variant,
            "implementation": impl,
            "run_id": run_id,
            "target_id": label,
            "target_type": "write",
            "vector": "bola_delete",
            "initial_value": "you will change this data",
            "final_value": value,
            "nonce": nonce,
            "weight": 2,
            "http_status": r.status_code,
            "duration_ms": round(duration, 3),
            "result": "success" if ok else "blocked",
        })


def main() -> int:
    statsd = Statsd()
    run_id = make_run_id()
    output = RESULTS_DIR / f"bola_{run_id}.jsonl"
    writer = ResultWriter(path=output)

    for variant in load_variants():
        for impl in IMPLEMENTATIONS:
            client = VariantClient(variant)
            try:
                attacker = client.login(CREDS_ATTACKER)
                admin = client.login(CREDS_ADMIN)
                statsd.marker("start", "bola", variant.name, impl)
                _do_get(client, attacker, admin, variant.name, impl, run_id, writer, GET_ORDERS)
                _do_put(client, attacker, admin, variant.name, impl, run_id, writer, PUT_ORDERS)
                _do_delete(client, attacker, admin, variant.name, impl, run_id, writer, DELETE_ORDERS)
                statsd.marker("end", "bola", variant.name, impl)
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] {variant.name}/{impl}: {exc}")
            finally:
                client.close()
    writer.flush()
    print(f"BOLA результ -> {output} ({len(writer.lines)} record)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
