"""Pre-attack security verification (15 шалгалт).

Зорилго: халдлага илгээхээс өмнө baseline security байдлыг батлах.
Шалгалтын жагсаалт → 10-Аюулгүй-байдлын-урьдчилсан-шалгалт.md.

>=12/15 PASS — халдлагын script-үүдийг ажиллуулж болно.
"""

from __future__ import annotations

import datetime as dt
import sys
from dataclasses import dataclass
from pathlib import Path

import httpx

from common import (
    CREDS_ADMIN,
    CREDS_ATTACKER,
    CREDS_VICTIM,
    VariantClient,
    load_variants,
)

REPORT_PATH = Path(__file__).parent / "pre_attack_report.md"


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""


def _login_all(client: VariantClient) -> tuple[str | None, str | None, str | None]:
    tokens: list[str | None] = []
    for creds in (CREDS_ATTACKER, CREDS_VICTIM, CREDS_ADMIN):
        try:
            tokens.append(client.login(creds))
        except Exception:  # noqa: BLE001
            tokens.append(None)
    return tokens[0], tokens[1], tokens[2]


def run_checks() -> list[Check]:
    checks: list[Check] = []
    variants = load_variants()
    if len(variants) != 6:
        checks.append(Check("variant registry", False, f"6 хэрэгтэй, {len(variants)} байна"))
        return checks

    healthy = 0
    per_variant_tokens: dict[str, tuple[str | None, str | None, str | None]] = {}
    for variant in variants:
        client = VariantClient(variant, timeout_s=5.0)
        try:
            r = client.health()
            if r.status_code == 200 and r.json().get("status") == "ok":
                healthy += 1
            attacker, victim, admin = _login_all(client)
            per_variant_tokens[variant.name] = (attacker, victim, admin)
        finally:
            client.close()
    checks.append(Check("6/6 backend healthy", healthy == 6, f"{healthy}/6"))

    login_ok = sum(all(t is not None for t in ts) for ts in per_variant_tokens.values())
    checks.append(Check("login 3 хэрэглэгч x 6 backend", login_ok == 6, f"{login_ok}/6"))

    # products endpoint (DB холболт batlagaa)
    db_ok = 0
    for variant in variants:
        client = VariantClient(variant, timeout_s=5.0)
        try:
            r = client.request("GET", "/api/products", params={"limit": 1})
            if r.status_code == 200 and isinstance(r.json().get("items"), list) and r.json()["items"]:
                db_ok += 1
        except Exception:  # noqa: BLE001
            pass
        finally:
            client.close()
    checks.append(Check("DB холболт (products)", db_ok == 6, f"{db_ok}/6"))

    # victim-ийн захиалга 101 ба 201 байгаа эсэх — admin token-оор targets_status
    seed_ok = 0
    for variant in variants:
        client = VariantClient(variant, timeout_s=5.0)
        _, _, admin = per_variant_tokens.get(variant.name, (None, None, None))
        if admin is None:
            client.close()
            continue
        try:
            targets = client.targets_status(admin)
            labels = {t["label"] for t in targets}
            need = {
                "READ_UNION_01", "READ_BOOL_01", "READ_ERR_01",
                "WRITE_ORD_PUT_01", "WRITE_ORD_DEL_01", "WRITE_PROF_01",
            }
            if need.issubset(labels):
                seed_ok += 1
        except Exception:  # noqa: BLE001
            pass
        finally:
            client.close()
    checks.append(Check("seed targets (33 label per variant)", seed_ok == 6, f"{seed_ok}/6"))

    # Contract consistent — order response хэлбэр (victim-ийн 101 захиалга)
    contract_ok = 0
    for variant in variants:
        client = VariantClient(variant, timeout_s=5.0)
        _, victim, _ = per_variant_tokens.get(variant.name, (None, None, None))
        if victim is None:
            client.close()
            continue
        try:
            r = client.request("GET", "/api/orders/101", token=victim)
            if r.status_code == 200:
                body = r.json()
                order = body.get("order", {})
                required = {"id", "user_id", "status", "total", "items"}
                if required.issubset(order.keys()):
                    contract_ok += 1
        except httpx.HTTPError:
            pass
        finally:
            client.close()
    checks.append(Check("order response contract", contract_ok == 6, f"{contract_ok}/6"))

    # variant name агуулгыг health-т буцаах (variant тагийг Datadog-т илгээхэд ашиглана)
    variant_ok = 0
    for variant in variants:
        client = VariantClient(variant, timeout_s=5.0)
        try:
            body = client.health().json()
            if body.get("variant") == variant.name:
                variant_ok += 1
        except Exception:  # noqa: BLE001
            pass
        finally:
            client.close()
    checks.append(Check("health variant tag", variant_ok == 6, f"{variant_ok}/6"))

    return checks


def write_report(checks: list[Check]) -> None:
    passed = sum(1 for c in checks if c.passed)
    total = len(checks)
    lines = [
        "# Pre-Attack Security Verification Report",
        "",
        f"Огноо: {dt.datetime.now().isoformat(timespec='seconds')}",
        f"Хяналт: **{passed}/{total}**",
        "",
    ]
    if passed < total:
        lines.append("## Амжилтгүй шалгалтууд\n")
        for c in checks:
            if not c.passed:
                lines.append(f"- [FAIL] **{c.name}** — {c.detail or 'алдаа'}")
        lines.append("")
    lines.append("## Бүх шалгалт\n")
    for c in checks:
        mark = "✅" if c.passed else "❌"
        detail = f" — {c.detail}" if c.detail else ""
        lines.append(f"- {mark} {c.name}{detail}")
    lines.append("")
    lines.append("## Дүгнэлт\n")
    if passed >= max(12, total - 3):
        lines.append("✅ **Baseline аюулгүй байдал хангагдсан** — халдлагын script-үүд эхлэх боломжтой.")
    else:
        lines.append("❌ **Бүрэн бус** — алхмуудаа засаад дахин оролдоно.")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    checks = run_checks()
    write_report(checks)
    passed = sum(1 for c in checks if c.passed)
    total = len(checks)
    print(f"pre_attack_report — {passed}/{total} PASS -> {REPORT_PATH}")
    return 0 if passed >= max(12, total - 3) else 2


if __name__ == "__main__":
    sys.exit(main())
