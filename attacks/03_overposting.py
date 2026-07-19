"""JSON Overposting — 5 profile_targets marker mutation.

Attacker (user_id=1) өөрийн profile-ыг ачаалахдаа `targets[]` талбар нэмнэ:
  { "name": "...", "targets": [{ "label": "WRITE_PROF_01", "value": "You are hacked" }, ...] }

Alpha impl-т `targets`-ыг силент accept болгож profile_targets.target_value-т marker бичдэг.
Beta impl-т 400 (мэдэгдээгүй талбар) буцаана.
"""

from __future__ import annotations

import sys
import time

from common import (
    CREDS_ADMIN,
    CREDS_ATTACKER,
    RESULTS_DIR,
    ResultWriter,
    Statsd,
    VariantClient,
    load_variants,
    make_run_id,
    write_success_put,
)

IMPLEMENTATIONS = ("alpha", "beta")
LABELS = [f"WRITE_PROF_{i:02d}" for i in range(1, 6)]


def _target_value(client: VariantClient, admin_token: str, label: str) -> tuple[str | None, str]:
    targets = client.targets_status(admin_token, label=label)
    if not targets:
        return None, ""
    entry = targets[0]
    return entry.get("value"), entry.get("nonce", "")


def _run(
    client: VariantClient, attacker: str, admin: str,
    variant: str, impl: str, run_id: str, writer: ResultWriter,
) -> None:
    body = {
        "name": "attacker",
        "targets": [{"label": label, "value": "You are hacked"} for label in LABELS],
    }
    start = time.perf_counter()
    r = client.request("PUT", "/api/profile", token=attacker, json_body=body)
    duration = (time.perf_counter() - start) * 1000

    # 5 label бүрд detection endpoint-ээс шинэ target_value ба nonce авна.
    for label in LABELS:
        value, nonce = _target_value(client, admin, label)
        ok = value is not None and nonce != "" and write_success_put(value, nonce)
        writer.append({
            "attack": "overposting",
            "variant": variant,
            "implementation": impl,
            "run_id": run_id,
            "target_id": label,
            "target_type": "write",
            "vector": "overposting",
            "initial_value": "you will change this data",
            "final_value": value,
            "nonce": nonce,
            "http_status": r.status_code,
            "duration_ms": round(duration, 3),
            "result": "success" if ok else "blocked",
        })


def main() -> int:
    statsd = Statsd()
    run_id = make_run_id()
    output = RESULTS_DIR / f"overposting_{run_id}.jsonl"
    writer = ResultWriter(path=output)
    for variant in load_variants():
        for impl in IMPLEMENTATIONS:
            client = VariantClient(variant)
            try:
                attacker = client.login(CREDS_ATTACKER)
                admin = client.login(CREDS_ADMIN)
                statsd.marker("start", "overposting", variant.name, impl)
                _run(client, attacker, admin, variant.name, impl, run_id, writer)
                statsd.marker("end", "overposting", variant.name, impl)
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] {variant.name}/{impl}: {exc}")
            finally:
                client.close()
    writer.flush()
    print(f"Overposting результ -> {output} ({len(writer.lines)} record)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
