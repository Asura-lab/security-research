"""N=30 давталттай халдлагын дараалал.

Алхам:
  1. reset_targets.py (state → initial marker)
  2. 01_sqli.py
  3. 02_bola.py
  4. 03_overposting.py

R7 warm-up: эхний 3 round хаяна (`--warmup 3`).
R7 N=30: `--rounds 30` default.

Жич: локал орчинд ~5-7 минут.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ATTACKS_DIR = Path(__file__).parent
SCRIPTS = (
    ATTACKS_DIR / "reset_targets.py",
    ATTACKS_DIR / "01_sqli.py",
    ATTACKS_DIR / "02_bola.py",
    ATTACKS_DIR / "03_overposting.py",
)


def _run_script(script: Path) -> int:
    print(f"→ {script.name}")
    return subprocess.call([sys.executable, str(script)])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rounds", type=int, default=30)
    parser.add_argument("--warmup", type=int, default=3)
    args = parser.parse_args()

    total = args.warmup + args.rounds
    started = time.time()
    for round_idx in range(1, total + 1):
        phase = "warmup" if round_idx <= args.warmup else "round"
        print(f"\n== {phase} {round_idx}/{total} ==")
        for script in SCRIPTS:
            rc = _run_script(script)
            if rc != 0:
                print(f"[FAIL] {script.name} → rc={rc}")
                return rc
    duration = time.time() - started
    print(f"\nDone in {duration:.1f}s ({total} rounds)")
    print("Одоо: python attacks/aggregate.py; python attacks/anova_analysis.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
