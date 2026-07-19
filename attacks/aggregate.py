"""Халдлагын JSONL үр дүнг variant + impl-аар нэгтгэж summary.json үүсгэнэ.

Score model:
  ReadScore = reads_won / 18
  WriteScore = writes_won / 15
  Total     = (ReadScore + WriteScore) / 2
  Δ         = Total(beta) − Total(alpha)

Жин бүхий (severity-aware) WeightedTotal нь DELETE-т weight x2 ашиглана — ANOVA-д.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

RESULTS_DIR = Path(__file__).parent / "results"
SUMMARY_PATH = RESULTS_DIR / "summary.json"

READ_TOTAL = 18
WRITE_TOTAL = 15


def _load_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for file in RESULTS_DIR.glob("*.jsonl"):
        with file.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    return records


def _summarise(records: list[dict[str, Any]]) -> dict[str, Any]:
    # (variant, implementation) → per_target dict
    buckets: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {
            "reads_won": 0, "reads_total": READ_TOTAL,
            "writes_won_bola_get": 0,
            "writes_won_bola_put": 0,
            "writes_won_bola_delete": 0,
            "writes_won_overposting": 0,
            "writes_total": WRITE_TOTAL,
            "per_target": {},
        }
    )
    for r in records:
        key = (r["variant"], r["implementation"])
        bucket = buckets[key]
        vector = r.get("vector", r.get("attack"))
        result = r.get("result")
        # per_target — сүүлийн туршилтын result үлдэнэ (idempotency-ийн үед N=30 давталтад overwrite).
        bucket["per_target"][r["target_id"]] = result
        if result != "success":
            continue
        if vector in ("union", "bool", "error"):
            bucket["reads_won"] += 1
        elif vector == "bola_put":
            bucket["writes_won_bola_put"] += 1
        elif vector == "bola_delete":
            bucket["writes_won_bola_delete"] += 1
        elif vector == "overposting":
            bucket["writes_won_overposting"] += 1
        elif vector == "bola_get":
            bucket["writes_won_bola_get"] += 1

    summary_rows = []
    for (variant, impl), bucket in sorted(buckets.items()):
        writes_won = (
            bucket["writes_won_bola_put"]
            + bucket["writes_won_bola_delete"]
            + bucket["writes_won_overposting"]
        )
        reads = bucket["reads_won"]
        read_score = reads / READ_TOTAL
        write_score = writes_won / WRITE_TOTAL
        total = (read_score + write_score) / 2
        weighted_writes = (
            bucket["writes_won_bola_put"]
            + bucket["writes_won_bola_delete"] * 2
            + bucket["writes_won_overposting"]
        )
        weighted_total = (read_score + weighted_writes / 20) / 2
        summary_rows.append({
            "variant": variant,
            "implementation": impl,
            **{k: v for k, v in bucket.items() if k != "per_target"},
            "writes_won": writes_won,
            "read_score": round(read_score, 4),
            "write_score": round(write_score, 4),
            "total_score": round(total, 4),
            "weighted_total": round(weighted_total, 4),
        })

    # Delta = Total(beta) − Total(alpha) per variant
    by_variant: dict[str, dict[str, float]] = defaultdict(dict)
    for row in summary_rows:
        by_variant[row["variant"]][row["implementation"]] = row["total_score"]
    deltas = {
        variant: round(scores.get("beta", 0.0) - scores.get("alpha", 0.0), 4)
        for variant, scores in by_variant.items()
    }

    return {"rows": summary_rows, "deltas": deltas, "total_records": len(records)}


def main() -> int:
    records = _load_records()
    if not records:
        print("attacks/results/ хоосон байна.")
        return 1
    summary = _summarise(records)
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"summary -> {SUMMARY_PATH}")
    for row in summary["rows"]:
        print(
            f"  {row['variant']:<12} {row['implementation']:<5} "
            f"reads={row['reads_won']:>2}/{READ_TOTAL} "
            f"writes={row['writes_won']:>2}/{WRITE_TOTAL} "
            f"total={row['total_score']:.3f}"
        )
    print("\nΔ = β − α:")
    for variant, delta in summary["deltas"].items():
        print(f"  {variant:<12} Δ = {delta:+.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
