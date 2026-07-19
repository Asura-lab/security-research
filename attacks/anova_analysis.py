"""2-way ANOVA — factor A = DB-access (Raw/ORM), factor B = хэл (TS/Python/Go).

Оролт: attacks/results/summary.json (aggregate.py-ийн үр дүн, N=1 наад зах нь).
         → N=30 давталттай бол script-ийг per-round-т ажиллуулж CSV-т append хийнэ.

Dependent variable: alpha_total (Total score α impl-т).
Есүүл: `statsmodels`-ийн `ols` + `anova_lm`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    import statsmodels.api as sm
    from statsmodels.formula.api import ols
except ImportError:  # pragma: no cover
    print("pip install statsmodels numpy pandas", file=sys.stderr)
    sys.exit(1)

SUMMARY_PATH = Path(__file__).parent / "results" / "summary.json"
CSV_PATH = Path(__file__).parent / "results" / "anova_input.csv"

LANG_MAP = {
    "nestjs": "TS",
    "fiber":  "Go",
    "fastapi": "Python",
}


def _load_rows() -> list[dict[str, object]]:
    if not SUMMARY_PATH.exists():
        print("summary.json алга — attacks/aggregate.py-ээ өмнө ажиллуулна уу.", file=sys.stderr)
        sys.exit(2)
    data = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    return data["rows"]


def _to_dataframe(rows: list[dict[str, object]]) -> pd.DataFrame:
    records = []
    for row in rows:
        if row["implementation"] != "alpha":
            continue
        variant = row["variant"]
        # "nestjs-raw" → lang=nestjs, access=raw
        lang_prefix, access = variant.split("-", 1)
        access = "ORM" if access.startswith("orm") else "Raw"
        records.append({
            "variant": variant,
            "lang": LANG_MAP.get(lang_prefix, lang_prefix),
            "access": access,
            "total": float(row["total_score"]),
        })
    return pd.DataFrame.from_records(records)


def run() -> int:
    df = _to_dataframe(_load_rows())
    if df.empty:
        print("alpha implementation-т өгөгдөл алга.")
        return 3
    df.to_csv(CSV_PATH, index=False)
    print(f"input -> {CSV_PATH}")
    print(df)

    # N=1 үед ANOVA replicate-гүй тул CSV бүрдүүлж, replicate байхад л ANOVA хийнэ.
    replicate_count = df.groupby(["lang", "access"]).size().min()
    if replicate_count < 2:
        print(
            "\nЖич: N=1 давталт — ANOVA хийхийн тулд attacks/loop.py-аа N>=2 удаа ажиллуулна уу."
        )
        return 0

    model = ols("total ~ C(access) + C(lang) + C(access):C(lang)", data=df).fit()
    table = sm.stats.anova_lm(model, typ=2)
    print("\n=== 2-way ANOVA ===")
    print(table.to_string())
    return 0


if __name__ == "__main__":
    sys.exit(run())
