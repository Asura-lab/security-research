"""6 backend бүрд GET /health илгээж баталгаажуулах.

Амжилтгүй бол exit code 1 — халдлагын script-үүд эхлэхээс өмнө шалгуур.
"""

from __future__ import annotations

import sys

from common import VariantClient, load_variants


def main() -> int:
    failures = 0
    for variant in load_variants():
        client = VariantClient(variant, timeout_s=5.0)
        try:
            r = client.health()
            if r.status_code == 200 and r.json().get("status") == "ok":
                print(f"[OK]   {variant.name:<12} — {variant.base_url}")
            else:
                print(f"[FAIL] {variant.name:<12} — status={r.status_code}")
                failures += 1
        except Exception as exc:  # noqa: BLE001
            print(f"[FAIL] {variant.name:<12} — {exc}")
            failures += 1
        finally:
            client.close()
    if failures:
        print(f"\n{failures} / 6 backend амьсгаа авахгүй байна.")
        return 1
    print("\n6/6 backend амьд.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
